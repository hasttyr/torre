import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import { i18n } from "../../i18n";
import type { Round, Standings } from "../../services/rounds";
import type { Tournament } from "../../services/tournaments";
import { clickConfirmDialogButton, mountConfirmDialogHost } from "../../test-support/confirmDialog";
import RoundManager from "./RoundManager.vue";

vi.mock("../../services/rounds", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/rounds")>()),
  listRounds: vi.fn(),
  getStandings: vi.fn(),
  getTournamentStats: vi.fn(),
  generateRound: vi.fn(),
  publishRound: vi.fn(),
  swapPlayers: vi.fn(),
  discardRound: vi.fn(),
}));
vi.mock("../../services/tournaments", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/tournaments")>()),
  getTournament: vi.fn(),
  finishTournament: vi.fn(),
}));

import {
  generateRound,
  getStandings,
  getTournamentStats,
  listRounds,
  publishRound,
  swapPlayers,
} from "../../services/rounds";
import { finishTournament, getTournament } from "../../services/tournaments";

// The live channel: the test plays the server, firing the events a room gets.
const { socketHandlers } = vi.hoisted(() => ({ socketHandlers: new Map<string, () => void>() }));
vi.mock("../../services/socket", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/socket")>()),
  getSocket: vi.fn(async () => ({
    connected: true,
    on: vi.fn((event: string, handler: () => void) => socketHandlers.set(event, handler)),
    off: vi.fn(),
    connect: vi.fn(),
  })),
  joinTournamentRoom: vi.fn(),
  leaveTournamentRoom: vi.fn(),
}));

import { joinTournamentRoom } from "../../services/socket";

const TOURNAMENT: Tournament = {
  id: "t-1",
  name: "Copa",
  startDate: "2026-10-01",
  endDate: "2026-10-03",
  status: "REGISTRATION_CLOSED",
  format: "swiss",
  roundsCount: 2,
  timeControl: null,
  restrictedProgram: null,
  minimumSemester: null,
  byePoints: 1,
  organizerId: "org-1",
  tiebreakCriteria: [],
  createdAt: "2026-09-01T00:00:00.000Z",
};

const STANDINGS: Standings = {
  tournamentId: "t-1",
  pending: false,
  roundsCompleted: 0,
  tiebreaks: [],
  rows: [],
  viewerPlayerId: null,
};

function round(number: number, status: Round["status"], results: (string | null)[] = [null]): Round {
  return {
    id: `r-${number}`,
    number,
    status,
    createdAt: "2026-10-01T00:00:00.000Z",
    matches: results.map((result, index) => ({
      id: `m-${number}-${index}`,
      board: index + 1,
      status: "SCHEDULED",
      white: { playerId: `w${index}`, name: `Blanca ${index}` },
      black: { playerId: `b${index}`, name: `Negra ${index}` },
      result: result as Round["matches"][number]["result"],
      isBye: false,
    })),
  };
}

async function mountManager(tournament: Tournament = TOURNAMENT) {
  vi.mocked(getTournament).mockResolvedValue(tournament);
  const router = createRouter({
    history: createWebHistory(),
    routes: [{ path: "/:p(.*)*", component: { template: "<div />" } }],
  });
  mountConfirmDialogHost();
  const wrapper = mount(RoundManager, { props: { tournamentId: "t-1" }, global: { plugins: [router, i18n] } });
  await flushPromises();
  return wrapper;
}

const button = (wrapper: Awaited<ReturnType<typeof mountManager>>, text: string) =>
  wrapper.findAll("button").find((candidate) => candidate.text().startsWith(text));

describe("RoundManager", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.mocked(getTournamentStats).mockResolvedValue({
      tournamentId: "t-1",
      activePlayers: 4,
      withdrawnPlayers: 0,
      gamesPlayed: 1,
      byes: 1,
      whiteWins: 0,
      draws: 0,
      blackWins: 1,
      decisiveRate: 1,
      whiteScoreRate: 0,
      rounds: [{ round: 1, whiteWins: 0, draws: 0, blackWins: 1, pending: 1 }],
    });
    document.body.innerHTML = "";
    vi.mocked(getStandings).mockResolvedValue(STANDINGS);
  });

  it("follows the tournament live: a result an arbiter records shows up without reloading", async () => {
    vi.mocked(listRounds)
      .mockResolvedValueOnce([round(1, "RECORDING_RESULTS", [null])])
      .mockResolvedValue([round(1, "STANDINGS_UPDATED", ["1-0"])]);
    const wrapper = await mountManager({ ...TOURNAMENT, status: "IN_PROGRESS" });
    expect(wrapper.text()).toContain("falta registrar 1 resultado");
    expect(joinTournamentRoom).toHaveBeenCalledWith(expect.anything(), "t-1");

    socketHandlers.get("match.result.recorded")!();
    await vi.waitFor(() => expect(listRounds).toHaveBeenCalledTimes(2));
    await flushPromises();

    expect(wrapper.text()).not.toContain("falta registrar");
  });

  it("offers to generate round 1 once registration is closed", async () => {
    vi.mocked(listRounds)
      .mockResolvedValueOnce([])
      .mockResolvedValue([round(1, "GENERATED")]);
    vi.mocked(generateRound).mockResolvedValue(round(1, "GENERATED"));

    const wrapper = await mountManager();
    await button(wrapper, "Generar ronda 1")!.trigger("click");
    await flushPromises();

    expect(generateRound).toHaveBeenCalledWith("t-1");
    expect(wrapper.text()).toContain("Ronda 1 en borrador");
  });

  it("publishes the draft only after confirming", async () => {
    vi.mocked(listRounds).mockResolvedValue([round(1, "GENERATED")]);
    vi.mocked(publishRound).mockResolvedValue(round(1, "RECORDING_RESULTS"));

    const wrapper = await mountManager();
    await button(wrapper, "Publicar ronda 1")!.trigger("click");
    await flushPromises();
    expect(publishRound).not.toHaveBeenCalled();

    await clickConfirmDialogButton("Publicar");
    await flushPromises();
    expect(publishRound).toHaveBeenCalledWith("r-1");
  });

  it("sends a manual adjustment with its reason (HU29)", async () => {
    vi.mocked(listRounds).mockResolvedValue([round(1, "GENERATED", [null, null])]);
    vi.mocked(swapPlayers).mockResolvedValue(round(1, "GENERATED", [null, null]));

    const wrapper = await mountManager();
    await wrapper.get("#swapPlayerA").setValue("b0");
    await wrapper.get("#swapPlayerB").setValue("w1");
    await wrapper.get("#swapReason").setValue("Mismo club");
    await wrapper.get("form").trigger("submit.prevent");
    await flushPromises();

    expect(swapPlayers).toHaveBeenCalledWith("r-1", { playerAId: "b0", playerBId: "w1", reason: "Mismo club" });
  });

  it("reports the results still missing and doesn't offer another round meanwhile", async () => {
    vi.mocked(listRounds).mockResolvedValue([round(1, "RECORDING_RESULTS", ["1-0", null, null])]);

    const wrapper = await mountManager({ ...TOURNAMENT, status: "IN_PROGRESS" });

    expect(wrapper.text()).toContain("faltan registrar 2 resultados");
    expect(button(wrapper, "Generar ronda")).toBeUndefined();
  });

  it("offers to finish once every round is recorded (HU17)", async () => {
    vi.mocked(listRounds).mockResolvedValue([
      round(1, "STANDINGS_UPDATED", ["1-0"]),
      round(2, "STANDINGS_UPDATED", ["0-1"]),
    ]);
    vi.mocked(finishTournament).mockResolvedValue({ ...TOURNAMENT, status: "FINISHED" });

    const wrapper = await mountManager({ ...TOURNAMENT, status: "IN_PROGRESS" });
    await button(wrapper, "Finalizar torneo")!.trigger("click");
    await flushPromises();
    await clickConfirmDialogButton("Finalizar torneo");
    await flushPromises();

    expect(finishTournament).toHaveBeenCalledWith("t-1");
  });

  it("announces a finished tournament's final standings", async () => {
    vi.mocked(listRounds).mockResolvedValue([round(1, "STANDINGS_UPDATED", ["1-0"])]);

    const wrapper = await mountManager({ ...TOURNAMENT, status: "FINISHED" });

    expect(wrapper.get("[role='status']").text()).toContain("Torneo finalizado");
  });

  it("shows the server's reason when an action is refused", async () => {
    vi.mocked(listRounds).mockResolvedValue([]);
    vi.mocked(generateRound).mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: "No existe un emparejamiento que evite repetir enfrentamientos" } },
    });

    const wrapper = await mountManager();
    await button(wrapper, "Generar ronda 1")!.trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("No existe un emparejamiento");
  });

  // RN-02 / HU08: no pairing avoids a rematch; the organizer may authorize
  // one, as a manual adjustment that says why (RN-09).
  describe("when no pairing avoids a rematch", () => {
    async function refusedRound2() {
      vi.mocked(listRounds).mockResolvedValue([round(1, "STANDINGS_UPDATED", ["1-0"])]);
      vi.mocked(generateRound).mockRejectedValueOnce({
        isAxiosError: true,
        response: { data: { code: "PAIRING_IMPOSSIBLE", params: { number: 2 } } },
      });
      const wrapper = await mountManager({ ...TOURNAMENT, status: "IN_PROGRESS" });
      await button(wrapper, "Generar ronda 2")!.trigger("click");
      await flushPromises();
      return wrapper;
    }

    it("offers to generate it authorizing a rematch, with its reason", async () => {
      vi.mocked(generateRound).mockResolvedValue(round(2, "GENERATED", [null]));
      const wrapper = await refusedRound2();

      await wrapper.get("#rematchReason").setValue("  Quedan dos jugadores  ");
      await wrapper.get("[data-test='rematch-form']").trigger("submit.prevent");
      await flushPromises();

      expect(generateRound).toHaveBeenLastCalledWith("t-1", { reason: "Quedan dos jugadores" });
    });

    it("asks for the reason before authorizing it (RN-09)", async () => {
      const wrapper = await refusedRound2();

      await wrapper.get("[data-test='rematch-form']").trigger("submit.prevent");
      await flushPromises();

      expect(generateRound).toHaveBeenCalledTimes(1);
      expect(wrapper.text()).toContain("Indica el motivo de la revancha (RN-09).");
    });

    it("isn't offered for any other refusal", async () => {
      vi.mocked(listRounds).mockResolvedValue([]);
      vi.mocked(generateRound).mockRejectedValue({
        isAxiosError: true,
        response: { data: { code: "NOT_ENOUGH_PLAYERS" } },
      });
      const wrapper = await mountManager();
      await button(wrapper, "Generar ronda 1")!.trigger("click");
      await flushPromises();

      expect(wrapper.find("#rematchReason").exists()).toBe(false);
    });
  });

  // No draft is created: the organizer needs to know how to go on from here.
  it("says how to go on when no pairing avoids a rematch", async () => {
    vi.mocked(listRounds).mockResolvedValue([round(1, "STANDINGS_UPDATED", ["1-0"])]);
    vi.mocked(generateRound).mockRejectedValue({
      isAxiosError: true,
      response: { data: { code: "PAIRING_IMPOSSIBLE", params: { number: 2 }, error: "No existe" } },
    });

    const wrapper = await mountManager({ ...TOURNAMENT, status: "IN_PROGRESS" });
    await button(wrapper, "Generar ronda 2")!.trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("ronda 2");
    expect(wrapper.text()).toContain("Número de rondas");
    expect(wrapper.text()).toContain("Finalizar torneo");
    expect(wrapper.text()).toContain("retira");
  });
});
