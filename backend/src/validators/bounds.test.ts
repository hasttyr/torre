import type { ZodType } from "zod";
import { describe, expect, it } from "vitest";

import { confirmPasswordResetSchema, loginSchema, registerSchema } from "./auth.schemas";
import { assignPlayerSchema, createClubSchema, updateClubSchema } from "./clubs.schemas";
import { linkPlayerSchema } from "./coaches.schemas";
import { correctResultSchema, swapPlayersSchema } from "./rounds.schemas";
import { configureTournamentSchema, createTournamentSchema, withdrawPlayerSchema } from "./tournaments.schemas";
import { dataRequestSchema, updateProfileSchema } from "./users.schemas";

// B-D3: nothing a client sends is stored, rendered in PDFs or shown in the
// UI without a size limit. Each case is valid except for one field just
// over its limit.
const over = (max: number) => "a".repeat(max + 1);
const UUID = "3f2b8c1e-6a4d-4e2f-9b7a-1c5d8e9f0a2b";

const coach = {
  name: "Ana Torres",
  email: "ana@example.com",
  password: "password123",
  role: "COACH",
  acceptDataPolicy: true,
};
const player = { ...coach, role: "PLAYER", universityCode: "U100", program: "Sistemas", semester: 3 };
const tournament = { name: "Copa", startDate: "2026-10-01", endDate: "2026-10-02" };

const cases: [string, ZodType, Record<string, unknown>][] = [
  ["a name", registerSchema, { ...coach, name: over(100) }],
  ["an email", registerSchema, { ...coach, email: `${over(244)}@example.com` }],
  ["a password", registerSchema, { ...coach, password: over(128) }],
  ["a university code", registerSchema, { ...player, universityCode: over(30) }],
  ["a program", registerSchema, { ...player, program: over(100) }],
  ["a login email", loginSchema, { email: `${over(244)}@example.com`, password: "x" }],
  ["a login password", loginSchema, { email: "ana@example.com", password: over(128) }],
  ["a new password", confirmPasswordResetSchema, { token: "t", newPassword: over(128) }],
  ["a reset token", confirmPasswordResetSchema, { token: over(128), newPassword: "password123" }],
  ["a profile name", updateProfileSchema, { name: over(100) }],
  ["a profile university code", updateProfileSchema, { universityCode: over(30) }],
  ["a profile program", updateProfileSchema, { program: over(100) }],
  ["a club name", createClubSchema, { name: over(100) }],
  ["a new club name", updateClubSchema, { name: over(100) }],
  ["a tournament name", createTournamentSchema, { ...tournament, name: over(100) }],
  ["a tournament format", createTournamentSchema, { ...tournament, format: over(30) }],
  ["a time control", configureTournamentSchema, { timeControl: over(50) }],
  ["a restricted program", configureTournamentSchema, { restrictedProgram: over(100) }],
  ["a withdrawal reason", withdrawPlayerSchema, { reason: over(500) }],
  ["a correction reason", correctResultSchema, { value: "1-0", reason: over(500) }],
  ["an adjustment reason", swapPlayersSchema, { playerAId: UUID, playerBId: UUID, reason: over(500) }],
  ["a suppression reason", dataRequestSchema, { type: "SUPPRESSION", reason: over(500) }],
];

describe("input bounds", () => {
  it.each(cases)("refuses %s over its maximum length", (_label, schema, input) => {
    expect(schema.safeParse(input).success).toBe(false);
  });

  it("accepts a value right at its maximum", () => {
    expect(createClubSchema.safeParse({ name: "a".repeat(100) }).success).toBe(true);
  });

  it.each([
    ["a club member", assignPlayerSchema],
    ["a coached player", linkPlayerSchema],
  ])("identifies %s by a player id like every other request", (_label, schema) => {
    expect(schema.safeParse({ playerId: "player-1" }).success).toBe(false);
    expect(schema.safeParse({ playerId: UUID }).success).toBe(true);
  });
});
