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
});
