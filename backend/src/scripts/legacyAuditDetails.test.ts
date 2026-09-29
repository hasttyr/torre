import { describe, expect, it } from "vitest";

import { parseLegacyDetail, withMentions } from "./legacyAuditDetails";

const ANA = "7a1c3e5f-0000-4000-8000-000000000001";
const LUIS = "7a1c3e5f-0000-4000-8000-000000000002";

/** The names an old entry holds, as parseLegacyDetail found them. */
function namesIn(action: string, detail: string): string[] | undefined {
  return parseLegacyDetail(action, detail)?.names.map((span) => span.name);
}

// Entries written before audit details referenced people by id: the formats
// of each action, as the services wrote them then.
describe("parseLegacyDetail", () => {
  it("finds the person in an old role or account change", () => {
    expect(namesIn("ROLE_CHANGED", "Ana Torres (PLAYER -> COACH)")).toEqual(["Ana Torres"]);
    expect(namesIn("ACCOUNT_STATUS_CHANGED", "Ana Torres -> INACTIVE")).toEqual(["Ana Torres"]);
  });

  it("finds both players of a corrected result, and the game they played", () => {
    const parsed = parseLegacyDetail(
      "RESULT_CORRECTED",
      '"Copa Otoño", ronda 3, mesa 2 (Ana Torres – Luis Gómez): WHITE_WIN → DRAW — error de digitación',
    );

    expect(parsed).toMatchObject({ tournament: "Copa Otoño", round: 3, board: 2 });
    expect(parsed?.names.map((span) => span.name)).toEqual(["Ana Torres", "Luis Gómez"]);
  });

  it("finds both players of an adjusted pairing, with or without the rematch note", () => {
    const plain = 'Ronda 2 de "Copa Otoño": Ana Torres ↔ Luis Gómez — pidió cambio — por horario';
    const rematch = 'Ronda 2 de "Copa Otoño": Ana Torres ↔ Luis Gómez (repite un enfrentamiento previo) — pidió cambio';

    for (const detail of [plain, rematch]) {
      expect(parseLegacyDetail("PAIRING_ADJUSTED", detail)).toMatchObject({ tournament: "Copa Otoño", round: 2 });
      expect(namesIn("PAIRING_ADJUSTED", detail)).toEqual(["Ana Torres", "Luis Gómez"]);
    }
  });

  it("finds the withdrawn player and their tournament, with or without a reason", () => {
    expect(parseLegacyDetail("PLAYER_WITHDRAWN", 'Ana Torres de "Copa Otoño"')).toMatchObject({
      tournament: "Copa Otoño",
      names: [expect.objectContaining({ name: "Ana Torres" })],
    });
    expect(namesIn("PLAYER_WITHDRAWN", 'Ana Torres de "Copa Otoño" — viaje')).toEqual(["Ana Torres"]);
  });

  it("leaves alone entries already in today's form, actions that never named anyone, and text it doesn't know", () => {
    expect(parseLegacyDetail("ROLE_CHANGED", `{{user:${ANA}}} (PLAYER -> COACH)`)).toBeNull();
    expect(parseLegacyDetail("TOURNAMENT_FINISHED", '"Copa Otoño"')).toBeNull();
    expect(parseLegacyDetail("DASHBOARD_LAYOUT_CHANGED", "PLAYER: MY_RESULTS")).toBeNull();
    expect(parseLegacyDetail("ROLE_CHANGED", "cambio manual")).toBeNull();
  });
});

describe("withMentions", () => {
  it("puts each person's reference exactly where their name was, and nowhere else", () => {
    // The tournament carries the same name as a player: only the player's spot changes.
    const detail = '"Copa Ana Torres", ronda 1, mesa 1 (Ana Torres – Luis Gómez): WHITE_WIN → DRAW';
    const parsed = parseLegacyDetail("RESULT_CORRECTED", detail)!;

    expect(withMentions(detail, parsed.names, [ANA, LUIS])).toBe(
      `"Copa Ana Torres", ronda 1, mesa 1 ({{user:${ANA}}} – {{user:${LUIS}}}): WHITE_WIN → DRAW`,
    );
  });
});
