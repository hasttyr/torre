import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import { i18n } from "../../i18n";
import type { Round } from "../../services/rounds";
import type { Tournament } from "../../services/tournaments";
import { useAuthStore } from "../../stores/auth";
import TournamentLiveView from "./TournamentLiveView.vue";

const { socketMock } = vi.hoisted(() => ({
  socketMock: { connected: true, on: vi.fn(), off: vi.fn(), connect: vi.fn(), emit: vi.fn() },
}));

vi.mock("../../services/socket", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/socket")>()),
  getSocket: vi.fn(() => Promise.resolve(socketMock)),
  joinTournamentRoom: vi.fn(),
  leaveTournamentRoom: vi.fn(),
}));
vi.mock("../../services/rounds", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/rounds")>()),
  listRounds: vi.fn(),
  getStandings: vi.fn(),
  getTournamentStats: vi.fn(),
  recordResult: vi.fn(),
  correctResult: vi.fn(),
  downloadStandingsPdf: vi.fn(),
  downloadPairingsPdf: vi.fn(),
}));
vi.mock("../../lib/download", () => ({ saveFile: vi.fn() }));
vi.mock("../../services/tournaments", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/tournaments")>()),
  getTournament: vi.fn(),
}));

import {
  correctResult,
  downloadPairingsPdf,
  downloadStandingsPdf,
  getStandings,
  getTournamentStats,
  listRounds,
  recordResult,
} from "../../services/rounds";
import { saveFile } from "../../lib/download";
import { joinTournamentRoom } from "../../services/socket";
import { getTournament } from "../../services/tournaments";

const TOURNAMENT: Tournament = {
  id: "t-1",
  name: "Liga Universitaria",
  startDate: "2026-09-19",
  endDate: "2026-09-26",
  status: "IN_PROGRESS",
  format: "swiss",
  roundsCount: 5,
  timeControl: null,
  restrictedProgram: null,
  minimumSemester: null,
  byePoints: 1,
  organizerId: "org-1",
  tiebreakCriteria: [],
  createdAt: "2026-09-01T00:00:00.000Z",
};

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
    {
      id: "m-2",
      board: 2,
      status: "FINISHED",
      white: { playerId: "p3", name: "Sofía Martínez" },
      black: { playerId: "p4", name: "Juan Herrera" },
      result: "0-1",
      isBye: false,
    },
    {
      id: "m-3",
      board: 3,
      status: "FINISHED",
      white: { playerId: "p5", name: "Diego Ramírez" },
      black: null,
      result: "BYE",
      isBye: true,
    },
  ],
};

function signIn(role: string, id = "user-1"): void {
  useAuthStore().user = {
    id,
    name: "Test",
    email: "t@example.com",
    status: "ACTIVE",
    role,
    createdAt: "2026-01-01T00:00:00.000Z",
    dataConsent: { accepted: true, date: "2026-01-01T00:00:00.000Z", version: "2026-08-01" },
  } as ReturnType<typeof useAuthStore>["user"];
}

const SECOND_ROUND: Round = {
  ...ROUND,
  id: "r-2",
  number: 2,
  matches: [{ ...ROUND.matches[0], id: "m-9", white: { playerId: "p9", name: "Marta Ríos" } }],
};

async function mountRoom(url = "/torneos/t-1/sala") {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: "/torneos/:id/sala", component: TournamentLiveView },
      { path: "/torneos/:id", component: { template: "<div />" } },
    ],
  });
  router.push(url);
  await router.isReady();
  // attachTo: arrow-key navigation between round tabs moves real focus.
  const wrapper = mount(TournamentLiveView, { global: { plugins: [router, i18n] }, attachTo: document.body });
  await flushPromises();
  return wrapper;
}

enableAutoUnmount(afterEach);

describe("TournamentLiveView", () => {
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
    vi.mocked(getTournament).mockResolvedValue(TOURNAMENT);
    vi.mocked(listRounds).mockResolvedValue([ROUND]);
    vi.mocked(getStandings).mockResolvedValue({
      tournamentId: "t-1",
      pending: true,
      roundsCompleted: 0,
      tiebreaks: ["Buchholz"],
      rows: [
        {
          rank: 1,
          playerId: "p4",
          name: "Juan Herrera",
          score: 1,
          buchholz: 0,
          buchholzCut1: 0,
          sonnebornBerger: 0,
          withdrawn: false,
        },
      ],
    });
  });

  it("shows pairings, byes and provisional standings to a player, read-only, and joins the live room", async () => {
    signIn("PLAYER");

    const wrapper = await mountRoom();

    expect(joinTournamentRoom).toHaveBeenCalledWith(socketMock, "t-1");
    expect(wrapper.text()).toContain("Ana Torres");
    expect(wrapper.text()).toContain("descansa esta ronda");
    expect(wrapper.text()).toContain("Clasificación provisional");
    expect(wrapper.find("[aria-label='Ganan blancas']").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Corregir");
  });

  it("switches between published rounds with keyboard-operable tabs, the pairings being the selected tab's panel", async () => {
    signIn("PLAYER");
    vi.mocked(listRounds).mockResolvedValue([ROUND, SECOND_ROUND]);

    const wrapper = await mountRoom();
    const roundTab = (label: string) => wrapper.findAll("[role='tab']").find((node) => node.text() === label)!;
    const visiblePanel = () => wrapper.get("[role='tabpanel']:not([hidden])");
    expect(roundTab("R2").attributes("aria-selected")).toBe("true");
    expect(visiblePanel().text()).toContain("Marta Ríos");

    await roundTab("R2").trigger("keydown", { key: "ArrowLeft" });
    await flushPromises();

    expect(roundTab("R1").attributes("aria-selected")).toBe("true");
    const panel = visiblePanel();
    expect(panel.attributes("aria-labelledby")).toBe(roundTab("R1").attributes("id"));
    expect(panel.text()).toContain("Ana Torres");
  });

  it("keeps an older round picked on purpose in the URL; the newest one needs no param", async () => {
    signIn("PLAYER");
    vi.mocked(listRounds).mockResolvedValue([ROUND, SECOND_ROUND]);
    const wrapper = await mountRoom();
    const roundTab = (label: string) => wrapper.findAll("[role='tab']").find((node) => node.text() === label)!;
    const query = () => wrapper.vm.$router.currentRoute.value.query;

    await roundTab("R1").trigger("mousedown");
    await flushPromises();
    expect(query()).toEqual({ ronda: "1" });

    await roundTab("R2").trigger("mousedown");
    await flushPromises();
    expect(query()).toEqual({});
  });

  it("opens the round a shared link points to", async () => {
    signIn("PLAYER");
    vi.mocked(listRounds).mockResolvedValue([ROUND, SECOND_ROUND]);

    const wrapper = await mountRoom("/torneos/t-1/sala?ronda=1");

    expect(wrapper.get("[role='tabpanel']:not([hidden])").text()).toContain("Ana Torres");
  });

  it("lets an arbiter record a pending game in one tap (HU10)", async () => {
    signIn("ARBITER");
    vi.mocked(recordResult).mockResolvedValue();

    const wrapper = await mountRoom();
    await wrapper.get("[data-match='m-1'] [aria-label='Tablas']").trigger("click");
    await flushPromises();

    expect(recordResult).toHaveBeenCalledWith("m-1", "1/2-1/2");
  });

  it("makes a correction an explicit step with its reason (HU11)", async () => {
    signIn("ARBITER");
    vi.mocked(correctResult).mockResolvedValue();

    const wrapper = await mountRoom();
    const board = () => wrapper.get("[data-match='m-2']");
    await board()
      .findAll("button")
      .find((button) => button.text() === "Corregir")!
      .trigger("click");
    await board().get("[aria-label='Ganan blancas']").trigger("click");
    await board().get("input").setValue("Planilla mal transcrita");
    await board()
      .findAll("button")
      .find((button) => button.text() === "Guardar corrección")!
      .trigger("click");
    await flushPromises();

    expect(correctResult).toHaveBeenCalledWith("m-2", "1-0", "Planilla mal transcrita");
  });

  it("stops offering result entry once the tournament is finished (HU17)", async () => {
    signIn("ARBITER");
    vi.mocked(getTournament).mockResolvedValue({ ...TOURNAMENT, status: "FINISHED" });

    const wrapper = await mountRoom();

    expect(wrapper.find("[aria-label='Tablas']").exists()).toBe(false);
  });

  it("offers the organizer who owns it a way back to the admin panel", async () => {
    signIn("ORGANIZER", "org-1");

    const wrapper = await mountRoom();

    expect(wrapper.find("a[href='/torneos/t-1']").exists()).toBe(true);
    expect(wrapper.find("[data-match='m-1'] [aria-label='Tablas']").exists()).toBe(true);
  });
});

describe("TournamentLiveView — official documents and statistics", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.mocked(getTournament).mockResolvedValue(TOURNAMENT);
    vi.mocked(listRounds).mockResolvedValue([ROUND]);
    vi.mocked(getStandings).mockResolvedValue({
      tournamentId: "t-1",
      pending: false,
      roundsCompleted: 1,
      tiebreaks: [],
      rows: [
        {
          rank: 1,
          playerId: "p4",
          name: "Juan Herrera",
          score: 1,
          buchholz: 0,
          buchholzCut1: 0,
          sonnebornBerger: 0,
          withdrawn: false,
        },
      ],
    });
    vi.mocked(getTournamentStats).mockResolvedValue({
      tournamentId: "t-1",
      activePlayers: 5,
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
  });

  const exportButtons = (wrapper: Awaited<ReturnType<typeof mountRoom>>) =>
    wrapper.findAll("button").filter((button) => button.text().includes("(PDF)"));

  it("shows the tournament's statistics to everyone (HU16)", async () => {
    signIn("PLAYER");

    const wrapper = await mountRoom();

    expect(wrapper.text()).toContain("Estadísticas del torneo");
    expect(wrapper.text()).toContain("Partidas decisivas");
  });

  it("offers the PDF exports only to officials (HU30)", async () => {
    signIn("PLAYER");
    expect(exportButtons(await mountRoom())).toHaveLength(0);

    signIn("ARBITER");
    expect(exportButtons(await mountRoom()).map((button) => button.text())).toEqual([
      "Clasificación (PDF)",
      "Ronda 1 (PDF)",
    ]);
  });

  it("still lets officials export once the tournament is finished", async () => {
    signIn("ARBITER");
    vi.mocked(getTournament).mockResolvedValue({ ...TOURNAMENT, status: "FINISHED" });

    expect(exportButtons(await mountRoom())).toHaveLength(2);
  });

  it("downloads the file the server generated", async () => {
    signIn("ORGANIZER", "org-1");
    const pdf = new Blob(["%PDF-"], { type: "application/pdf" });
    vi.mocked(downloadStandingsPdf).mockResolvedValue(pdf);
    vi.mocked(downloadPairingsPdf).mockResolvedValue(pdf);

    const wrapper = await mountRoom();
    const [standings, round] = exportButtons(wrapper);
    await standings.trigger("click");
    await round.trigger("click");
    await flushPromises();

    expect(downloadStandingsPdf).toHaveBeenCalledWith("t-1");
    expect(downloadPairingsPdf).toHaveBeenCalledWith("r-1");
    expect(saveFile).toHaveBeenCalledWith(pdf, "clasificacion.pdf");
    expect(saveFile).toHaveBeenCalledWith(pdf, "ronda-1.pdf");
  });

  it("explains a failed export without leaving the room", async () => {
    signIn("ARBITER");
    vi.mocked(downloadStandingsPdf).mockRejectedValue(new Error("network"));

    const wrapper = await mountRoom();
    await exportButtons(wrapper)[0].trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("No se pudo generar el PDF");
  });
});
