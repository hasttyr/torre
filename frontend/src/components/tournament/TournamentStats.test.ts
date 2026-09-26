import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

import { i18n } from "../../i18n";
import type { TournamentStats as Stats } from "../../services/rounds";
import TournamentStats from "./TournamentStats.vue";

const STATS: Stats = {
  tournamentId: "t-1",
  activePlayers: 9,
  withdrawnPlayers: 1,
  gamesPlayed: 8,
  byes: 1,
  whiteWins: 4,
  draws: 2,
  blackWins: 2,
  decisiveRate: 0.75,
  whiteScoreRate: 0.625,
  rounds: [
    { round: 1, whiteWins: 3, draws: 1, blackWins: 0, pending: 0 },
    { round: 2, whiteWins: 1, draws: 1, blackWins: 2, pending: 1 },
  ],
};

describe("TournamentStats (HU16)", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("shows the headline figures, withdrawals and a split per round, flagging pending games", () => {
    const wrapper = mount(TournamentStats, { props: { stats: STATS }, global: { plugins: [i18n] } });
    const text = wrapper.text();

    expect(text).toContain("9");
    expect(text).toContain("1 retirado");
    expect(text).toContain("75");
    expect(text).toContain("63");
    expect(text).toContain("4 blancas · 2 tablas · 2 negras");
    expect(text).toContain("Ronda 2 (falta 1)");
  });

  it("says so instead of drawing empty bars before any game", () => {
    const wrapper = mount(TournamentStats, {
      props: { stats: { ...STATS, gamesPlayed: 0, whiteWins: 0, draws: 0, blackWins: 0, rounds: [] } },
      global: { plugins: [i18n] },
    });

    expect(wrapper.text()).toContain("Todavía no hay partidas registradas");
    expect(wrapper.findAll("[role='img']")).toHaveLength(0);
  });
});
