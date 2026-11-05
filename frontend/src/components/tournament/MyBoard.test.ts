import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import { i18n } from "../../i18n";
import type { Round } from "../../services/rounds";
import MyBoard from "./MyBoard.vue";

const seat = (playerId: string, name: string) => ({ playerId, name });

const ROUND = {
  id: "round-3",
  number: 3,
  status: "RECORDING_RESULTS",
  createdAt: "2026-10-01T00:00:00.000Z",
  matches: [
    {
      id: "m-1",
      board: 1,
      status: "SCHEDULED",
      white: seat("ana", "Ana Torres"),
      black: seat("beto", "Beto Ruiz"),
      result: null,
      isBye: false,
    },
    {
      id: "m-2",
      board: 2,
      status: "SCHEDULED",
      white: seat("caro", "Caro Díaz"),
      black: null,
      result: "BYE",
      isBye: true,
    },
  ],
} as unknown as Round;

const mountBoard = (playerId: string | null) =>
  mount(MyBoard, { props: { round: ROUND, playerId }, global: { plugins: [i18n] } });

// The player who opens the room finds their game without scanning the boards.
describe("MyBoard", () => {
  it("tells a player their board, color and opponent in the round in play", () => {
    expect(mountBoard("ana").text()).toBe("Tu partida · Ronda 3Mesa 1 · blancas contra Beto Ruiz");
    expect(mountBoard("beto").text()).toBe("Tu partida · Ronda 3Mesa 1 · negras contra Ana Torres");
  });

  it("tells a player with the bye that they rest this round", () => {
    expect(mountBoard("caro").text()).toBe("Tu partida · Ronda 3Descansas: tienes el bye de esta ronda.");
  });

  it("shows nothing to someone not paired in the round, or not playing at all", () => {
    expect(mountBoard("dani").html()).toBe("<!--v-if-->");
    expect(mountBoard(null).html()).toBe("<!--v-if-->");
  });

  it("is announced as a region, to find it with a screen reader", () => {
    expect(mountBoard("ana").get("section").attributes("aria-label")).toBe("Tu partida · Ronda 3");
  });
});
