import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

import { i18n } from "../../i18n";
import type { Standings } from "../../services/rounds";
import TournamentPodium from "./TournamentPodium.vue";

const row = (rank: number, playerId: string, name: string, score: number) => ({
  rank,
  playerId,
  name,
  score,
  buchholz: 0,
  buchholzCut1: 0,
  sonnebornBerger: 0,
  withdrawn: false,
});

const standings = (viewerPlayerId: string | null, rows = 4): Standings => ({
  tournamentId: "t-1",
  pending: false,
  roundsCompleted: 3,
  tiebreaks: [],
  rows: [
    row(1, "a", "Ana Torres", 3),
    row(2, "b", "Beto Ruiz", 2.5),
    row(3, "c", "Caro Díaz", 1.5),
    row(4, "d", "Dani Gil", 0),
  ].slice(0, rows),
  viewerPlayerId,
});

const mountPodium = (value: Standings) =>
  mount(TournamentPodium, { props: { standings: value }, global: { plugins: [i18n] } });

describe("TournamentPodium", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("names the first three in order, each with their place and points", () => {
    const places = mountPodium(standings(null))
      .findAll("ol > li")
      .map((li) =>
        li
          .findAll(":scope > *")
          .map((part) => part.text())
          .filter(Boolean)
          .join(" "),
      );

    // The champion first for a screen reader, though shown in the middle.
    expect(places).toEqual([
      "1 Primer lugar Ana Torres 3 pts",
      "2 Segundo lugar Beto Ruiz 2,5 pts",
      "3 Tercer lugar Caro Díaz 1,5 pts",
    ]);
  });

  // UC13: a tie no tiebreak resolved is a shared place, on the podium too.
  it("shows a shared place as the place it is", () => {
    const tied = standings(null);
    tied.rows = [row(1, "a", "Ana Torres", 3), row(1, "b", "Beto Ruiz", 3), row(3, "c", "Caro Díaz", 1.5)];

    const places = mountPodium(tied)
      .findAll("ol > li")
      .map((li) => li.findAll(":scope > span").map((part) => part.text())[0]);

    expect(places).toEqual(["1", "1", "3"]);
    expect(mountPodium(tied).text()).not.toContain("Segundo lugar");
  });

  it("tells a player where they finished", () => {
    expect(mountPodium(standings("d")).get("[data-test='podium-viewer']").text()).toBe(
      "Terminaste en el puesto 4 de 4.",
    );
    expect(mountPodium(standings("a")).get("[data-test='podium-viewer']").text()).toBe("Ganaste el torneo.");
  });

  it("says nothing of a place to someone who didn't play", () => {
    expect(mountPodium(standings(null)).find("[data-test='podium-viewer']").exists()).toBe(false);
  });

  it("shows only the steps there are players for", () => {
    expect(mountPodium(standings(null, 2)).findAll("ol > li")).toHaveLength(2);
  });
});
