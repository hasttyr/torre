import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

import { i18n } from "../../i18n";
import type { Standings } from "../../services/rounds";
import StandingsTable from "./StandingsTable.vue";

const STANDINGS = {
  pending: false,
  tiebreaks: ["BUCHHOLZ"],
  rows: [
    {
      playerId: "p1",
      rank: 1,
      name: "Ana Torres",
      withdrawn: false,
      score: 3.5,
      buchholz: 9,
      buchholzCut1: 7.5,
      sonnebornBerger: 8.25,
    },
  ],
} as unknown as Standings;

describe("StandingsTable", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("spells out every abbreviated column for screen readers, and explains it on hover", () => {
    const wrapper = mount(StandingsTable, { props: { standings: STANDINGS }, global: { plugins: [i18n] } });

    const headers = wrapper.findAll("th");
    expect(headers.every((th) => th.attributes("scope") === "col")).toBe(true);
    // What a screen reader announces for each column (the visible abbreviation is hidden from it).
    const spoken = headers.map((th) => (th.find(".sr-only").exists() ? th.get(".sr-only").text() : th.text()));
    expect(spoken).toEqual(["Posición", "Jugador", "Puntos", "Buchholz", "Buchholz Cortado 1", "Sonneborn-Berger"]);
    const abbreviations = wrapper.findAll("abbr");
    expect(abbreviations.map((abbr) => [abbr.text(), abbr.attributes("title")])).toEqual([
      ["Pts", "Puntos"],
      ["BH", "Buchholz"],
      ["BC1", "Buchholz Cortado 1"],
      ["SB", "Sonneborn-Berger"],
    ]);
    expect(abbreviations.every((abbr) => abbr.attributes("aria-hidden") === "true")).toBe(true);
  });

  it("shows each tiebreak with two decimals", () => {
    const wrapper = mount(StandingsTable, { props: { standings: STANDINGS }, global: { plugins: [i18n] } });

    expect(wrapper.findAll("tbody td").map((td) => td.text())).toEqual(["1", "Ana Torres", "3,5", "9", "7,5", "8,25"]);
  });
});
