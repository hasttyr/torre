import type { Prisma } from "../generated/prisma/client";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../app";
import { prisma } from "../config/prisma";
import { assertAnotherAdministratorRemains } from "../services/users.service";
import { bearer, createUser, resetDatabase } from "../testing/testDatabase";

const app = createApp();

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

const activeAdmins = () => prisma.user.count({ where: { status: "ACTIVE", role: { name: "ADMINISTRATOR" } } });

describe("there is always an active administrator", () => {
  it("the only administrator can't demote themselves", async () => {
    const admin = await createUser(prisma, "ADMINISTRATOR");

    const response = await request(app)
      .patch(`/api/users/${admin.id}/role`)
      .set(bearer(admin))
      .send({ role: "ORGANIZER" });

    expect(response.status).toBe(409);
    expect(await activeAdmins()).toBe(1);
  });

  it("an administrator can hand over the role while another one remains", async () => {
    const admin = await createUser(prisma, "ADMINISTRATOR");
    const other = await createUser(prisma, "ADMINISTRATOR");

    await request(app).patch(`/api/users/${other.id}/role`).set(bearer(admin)).send({ role: "COACH" }).expect(200);

    expect(await activeAdmins()).toBe(1);
  });

  it("the last administrator can't delete their own account through a data-rights request", async () => {
    const admin = await createUser(prisma, "ADMINISTRATOR");

    const response = await request(app)
      .post("/api/users/me/data-requests")
      .set(bearer(admin))
      .send({ type: "SUPPRESSION" });

    expect(response.status).toBe(409);
    expect(await activeAdmins()).toBe(1);
  });

  it("two administrators demoting each other at the same moment leave one of them in place", async () => {
    const first = await createUser(prisma, "ADMINISTRATOR");
    const second = await createUser(prisma, "ADMINISTRATOR");

    const responses = await Promise.all([
      request(app).patch(`/api/users/${second.id}/role`).set(bearer(first)).send({ role: "COACH" }),
      request(app).patch(`/api/users/${first.id}/role`).set(bearer(second)).send({ role: "COACH" }),
    ]);

    // The loser is refused either by the lock (409) or, if the winner committed
    // first, because it no longer holds an administrator's session (401).
    const statuses = responses.map((response) => response.status);
    expect(statuses.filter((status) => status === 200)).toHaveLength(1);
    expect(statuses.filter((status) => status === 409 || status === 401)).toHaveLength(1);
    expect(await activeAdmins()).toBe(1);
  });

  it("serializes concurrent demotions on the administrators' rows, so both can't pass the check", async () => {
    const first = await createUser(prisma, "ADMINISTRATOR");
    const second = await createUser(prisma, "ADMINISTRATOR");
    let firstChecked!: () => void;
    const afterFirstCheck = new Promise<void>((resolve) => (firstChecked = resolve));
    const demote = (tx: Prisma.TransactionClient, userId: string) =>
      tx.user.update({ where: { id: userId }, data: { role: { connect: { name: "COACH" } } } });

    const outcomes = await Promise.allSettled([
      prisma.$transaction(async (tx) => {
        await assertAnotherAdministratorRemains(tx, first.id);
        firstChecked();
        // Still uncommitted when the other transaction runs its own check.
        await new Promise((resolve) => setTimeout(resolve, 300));
        await demote(tx, first.id);
      }),
      afterFirstCheck.then(() =>
        prisma.$transaction(async (tx) => {
          await assertAnotherAdministratorRemains(tx, second.id);
          await demote(tx, second.id);
        }),
      ),
    ]);

    expect(outcomes.map((outcome) => outcome.status)).toEqual(["fulfilled", "rejected"]);
    expect(outcomes[1]).toMatchObject({ reason: { status: 409 } });
    expect(await activeAdmins()).toBe(1);
  });
});
