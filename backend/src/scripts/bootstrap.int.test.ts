import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../app";
import { prisma } from "../config/prisma";
import { createUser, resetDatabase } from "../testing/testDatabase";
import { bootstrap, bootstrapFromEnvironment } from "./bootstrap";

const app = createApp();

const ADMIN = { name: "Ana Admin", email: "ana@uni.edu", password: "una-clave-larga-1" };

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("bootstrap (a new database)", () => {
  it("creates the role catalog, each role's dashboard and an administrator who can sign in", async () => {
    // A freshly migrated database: not even the roles exist.
    await prisma.role.deleteMany();

    const result = await bootstrap(prisma, ADMIN);

    expect(result).toEqual({ administratorCreated: true });
    expect((await prisma.role.findMany()).map((role) => role.name).sort()).toEqual([
      "ADMINISTRATOR",
      "ARBITER",
      "COACH",
      "ORGANIZER",
      "PLAYER",
    ]);
    const dashboards = await prisma.roleWidget.findMany({ select: { role: { select: { name: true } } } });
    expect(new Set(dashboards.map((widget) => widget.role.name))).toEqual(
      new Set(["PLAYER", "COACH", "ARBITER", "ORGANIZER"]),
    );
    const login = await request(app).post("/api/auth/login").send({ email: ADMIN.email, password: ADMIN.password });
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe("ADMINISTRATOR");
  });

  it("can run again: it creates no second administrator and keeps what was configured", async () => {
    await bootstrap(prisma, ADMIN);
    await prisma.roleWidget.deleteMany({ where: { role: { name: "ARBITER" }, widgetKey: "TOP_PLAYERS" } });

    const again = await bootstrap(prisma, { ...ADMIN, email: "otra@uni.edu" });

    expect(again).toEqual({ administratorCreated: false });
    expect(await prisma.user.count({ where: { role: { name: "ADMINISTRATOR" } } })).toBe(1);
    expect(await prisma.roleWidget.count({ where: { role: { name: "ARBITER" }, widgetKey: "TOP_PLAYERS" } })).toBe(0);
  });

  it("never turns an existing account into the administrator", async () => {
    await createUser(prisma, "PLAYER", { email: ADMIN.email });

    await expect(bootstrap(prisma, ADMIN)).rejects.toMatchObject({ code: "EMAIL_TAKEN" });
    expect(await prisma.user.count({ where: { role: { name: "ADMINISTRATOR" } } })).toBe(0);
  });

  it("refuses a password that doesn't meet the registration rules", async () => {
    await expect(bootstrap(prisma, { ...ADMIN, password: "corta" })).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    expect(await prisma.user.count()).toBe(0);
  });
});

describe("npm run bootstrap", () => {
  const ENVIRONMENT = { ADMIN_NAME: ADMIN.name, ADMIN_EMAIL: ADMIN.email, ADMIN_PASSWORD: ADMIN.password };

  it("reads the administrator from the environment, and says what it did", async () => {
    await expect(bootstrapFromEnvironment(prisma, ENVIRONMENT)).resolves.toBe(
      "Roles and dashboards ready; administrator ana@uni.edu created.",
    );
    await expect(bootstrapFromEnvironment(prisma, ENVIRONMENT)).resolves.toBe(
      "Roles and dashboards ready; an active administrator already exists, so none was created.",
    );
  });

  it("refuses to run without the administrator's details", async () => {
    await expect(bootstrapFromEnvironment(prisma, {})).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });
});
