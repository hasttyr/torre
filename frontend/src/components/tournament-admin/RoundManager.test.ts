import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import { i18n } from "../../i18n";
import type { Round, Standings } from "../../services/rounds";
import type { Tournament } from "../../services/tournaments";
import { useTournamentsStore } from "../../stores/tournaments";
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

const STANDINGS: Standings = { tournamentId: "t-1", pending: false, roundsCompleted: 0, tiebreaks: [], rows: [] };

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
  useTournamentsStore().current = tournament;
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
});
