import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "../app";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn().mockResolvedValue({ id: "user-1", email: "ana@example.com", status: "ACTIVE" }) },
    passwordResetRequest: { create: vi.fn() },
  },
}));

vi.mock("../config/prisma", () => ({ prisma: prismaMock }));
// Production without a mail provider (config/mailer.ts): no way to send a link.
vi.mock("../config/mailer", () => ({ resetLinkSender: null }));

describe("POST /api/auth/password/forgot without a mail provider", () => {
  it("says recovery isn't available, the same for every email, and makes no reset link", async () => {
    const log = vi.spyOn(console, "log");
    const app = createApp();

    for (const email of ["ana@example.com", "nadie@example.com"]) {
      const response = await request(app).post("/api/auth/password/forgot").send({ email });

      expect(response.status).toBe(503);
      expect(response.body.code).toBe("PASSWORD_RESET_UNAVAILABLE");
    }
    expect(prismaMock.passwordResetRequest.create).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });
});
