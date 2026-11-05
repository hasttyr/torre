import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import { i18n } from "../../i18n";
import type { Round } from "../../services/rounds";
import PairingsTable from "./PairingsTable.vue";

const ROUND: Round = {
  id: "r-1",
  number: 1,
  status: "RECORDING_RESULTS",
  createdAt: "2026-09-19T00:00:00.000Z",
  matches: [
    {
      id: "m-1",
      board: 1,
      status: "SCHEDULED",
      white: { playerId: "p1", name: "Ana Torres" },
      black: { playerId: "p2", name: "Luis Gómez" },
      result: null,
      isBye: false,
    },
  ],
};

describe("PairingsTable", () => {
  it("tells each player's color in text, not only with the color swatch", () => {
    const wrapper = mount(PairingsTable, { props: { round: ROUND }, global: { plugins: [i18n] } });
    const board = wrapper.get("[data-match='m-1']");

    expect(board.text()).toMatch(/Ana Torres.*Blancas.*Luis Gómez.*Negras/);
    // An aria-label on a role-less <span> is ignored by screen readers.
    expect(board.findAll("span[aria-label]")).toHaveLength(0);
  });

  // Decision 011: a forfeit shows in FIDE notation, and says who didn't show up.
  it("shows a forfeit with its notation, and explains it on hover", () => {
    const forfeit = {
      ...ROUND,
      matches: [{ ...ROUND.matches[0]!, status: "FINISHED" as const, result: "0F-1F" as const }],
    };
    const wrapper = mount(PairingsTable, { props: { round: forfeit }, global: { plugins: [i18n] } });

    const result = wrapper.get("[data-match='m-1']").find("span[title^='Sin jugar']");
    expect(result.text()).toBe("0F – 1F");
    expect(result.attributes("title")).toContain("las blancas no se presentaron");
  });
});
