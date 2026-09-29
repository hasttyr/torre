import bcrypt from "bcryptjs";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../app";
import { prisma } from "../config/prisma";
import { createUser, resetDatabase, TEST_PASSWORD } from "../testing/testDatabase";
import { legacyPasswordHashesCommand } from "./legacyPasswordHashes";

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

// bcryptjs stays only to verify the hashes made before scrypt (B-S6): this
// says how many are left, so it's clear when the dependency can go.
describe("legacy password hashes", () => {
  it("counts the accounts still on bcrypt, until their owners sign in again", async () => {
    await createUser(prisma, "ORGANIZER");
    const old = await createUser(prisma, "PLAYER");
    await prisma.user.update({ where: { id: old.id }, data: { passwordHash: bcrypt.hashSync(TEST_PASSWORD, 4) } });

    expect(await legacyPasswordHashesCommand(prisma)).toMatch(/^1 account still has a bcrypt password hash/);

    await request(createApp()).post("/api/auth/login").send({ email: old.email, password: TEST_PASSWORD }).expect(200);

    expect(await legacyPasswordHashesCommand(prisma)).toMatch(
      /^No bcrypt password hashes left: bcryptjs can be removed/,
    );
  });
});
