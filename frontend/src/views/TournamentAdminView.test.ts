import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import { i18n } from "../i18n";
import TournamentAdminView from "./TournamentAdminView.vue";

vi.mock("../services/tournaments", () => ({
  createTournament: vi.fn(),
  getTournament: vi.fn(),
  configureTournament: vi.fn(),
  openRegistration: vi.fn(),
  closeRegistration: vi.fn(),
  enrollPlayer: vi.fn(),
  listEnrolledPlayers: vi.fn(),
}));

vi.mock("../services/players", () => ({
  searchPlayers: vi.fn(),
}));

import {
  openRegistration,
  closeRegistration,
  configureTournament,
  enrollPlayer,
  listEnrolledPlayers,
  getTournament,
} from "../services/tournaments";
import { searchPlayers } from "../services/players";

const getTournamentMock = vi.mocked(getTournament);
const listEnrolledPlayersMock = vi.mocked(listEnrolledPlayers);
const configureTournamentMock = vi.mocked(configureTournament);
const openRegistrationMock = vi.mocked(openRegistration);
const closeRegistrationMock = vi.mocked(closeRegistration);
const enrollPlayerMock = vi.mocked(enrollPlayer);
const searchPlayersMock = vi.mocked(searchPlayers);

const CREATED_TOURNAMENT = {
  id: "tournament-1",
  name: "Copa Universitaria",
  startDate: "2026-10-01",
  endDate: "2026-10-03",
  status: "CREATED" as const,
  format: "swiss",
  roundsCount: null,
  timeControl: null,
  restrictedProgram: null,
  minimumSemester: null,
  organizerId: "org-1",
  tiebreakCriteria: [],
  createdAt: "2026-09-17T00:00:00.000Z",
};

async function mountView() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [{ path: "/torneos/:id", component: TournamentAdminView }],
  });
  router.push("/torneos/tournament-1");
  await router.isReady();

  const wrapper = mount(TournamentAdminView, { global: { plugins: [router, i18n] } });
  await new Promise((resolve) => setTimeout(resolve, 0));
  await wrapper.vm.$nextTick();
  return { wrapper, router };
}

describe("TournamentAdminView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    listEnrolledPlayersMock.mockResolvedValue([]);
    searchPlayersMock.mockResolvedValue([]);
  });

  it("loads and shows the tournament with its status", async () => {
    getTournamentMock.mockResolvedValue(CREATED_TOURNAMENT);

    const { wrapper } = await mountView();

    expect(wrapper.text()).toContain("Copa Universitaria");
    expect(wrapper.text()).toContain("Preliminar");
  });

  it("enables opening registration only when the tournament is in CREATED", async () => {
    getTournamentMock.mockResolvedValue(CREATED_TOURNAMENT);

    const { wrapper } = await mountView();

    const openBtn = wrapper.findAll("button").find((btn) => btn.text() === "Abrir inscripciones")!;
    expect(openBtn.attributes("disabled")).toBeUndefined();

    const closeBtn = wrapper.findAll("button").find((btn) => btn.text() === "Cerrar inscripciones")!;
    expect(closeBtn.attributes("disabled")).toBeDefined();
  });

  it("opens registration and reflects the new state (HU06)", async () => {
    getTournamentMock.mockResolvedValue(CREATED_TOURNAMENT);
    openRegistrationMock.mockResolvedValue({ ...CREATED_TOURNAMENT, status: "REGISTRATION_OPEN" });

    const { wrapper } = await mountView();

    const openBtn = wrapper.findAll("button").find((btn) => btn.text() === "Abrir inscripciones")!;
    await openBtn.trigger("click");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(openRegistrationMock).toHaveBeenCalledWith("tournament-1");
    expect(wrapper.text()).toContain("Inscripciones abiertas");
  });

  it("blocks the player search field when registration is not open", async () => {
    getTournamentMock.mockResolvedValue(CREATED_TOURNAMENT);

    const { wrapper } = await mountView();

    const playerQueryInput = wrapper.get("#playerQuery");
    expect(playerQueryInput.attributes("disabled")).toBeDefined();
  });

  it("searches and shows results as you type (debounced)", async () => {
    getTournamentMock.mockResolvedValue({ ...CREATED_TOURNAMENT, status: "REGISTRATION_OPEN" });
    searchPlayersMock.mockResolvedValue([
      {
        id: "j1",
        name: "Luis Gómez",
        email: "luis@example.com",
        universityCode: "U1",
        program: "Sistemas",
        semester: 5,
      },
    ]);

    const { wrapper } = await mountView();

    await wrapper.get("#playerQuery").setValue("Luis");
    await new Promise((resolve) => setTimeout(resolve, 350));
    await wrapper.vm.$nextTick();

    expect(searchPlayersMock).toHaveBeenCalledWith("Luis");
    expect(wrapper.text()).toContain("Luis Gómez");
  });

  it("enrolls a player chosen from the search results (HU07)", async () => {
    getTournamentMock.mockResolvedValue({ ...CREATED_TOURNAMENT, status: "REGISTRATION_OPEN" });
    searchPlayersMock.mockResolvedValue([
      {
        id: "j1",
        name: "Luis Gómez",
        email: "luis@example.com",
        universityCode: "U1",
        program: "Sistemas",
        semester: 5,
      },
    ]);
    enrollPlayerMock.mockResolvedValue({
      playerId: "j1",
      name: "Luis Gómez",
      universityCode: "U1",
      program: "Sistemas",
      semester: 5,
      enrolledAt: "2026-09-17",
    });

    const { wrapper } = await mountView();

    await wrapper.get("#playerQuery").setValue("Luis");
    await new Promise((resolve) => setTimeout(resolve, 350));
    await wrapper.vm.$nextTick();

    const enrollBtn = wrapper.findAll("button").find((btn) => btn.text() === "Inscribir")!;
    await enrollBtn.trigger("click");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(enrollPlayerMock).toHaveBeenCalledWith("tournament-1", "j1");
    expect(wrapper.text()).toContain("Luis Gómez");
  });

  it("disables editing tiebreaks once it's no longer in preliminary state", async () => {
    getTournamentMock.mockResolvedValue({ ...CREATED_TOURNAMENT, status: "REGISTRATION_OPEN" });

    const { wrapper } = await mountView();

    const tiebreaksInput = wrapper.get("#tiebreaks");
    expect(tiebreaksInput.attributes("disabled")).toBeDefined();
  });

  it("saves the tournament configuration (HU05)", async () => {
    getTournamentMock.mockResolvedValue(CREATED_TOURNAMENT);
    configureTournamentMock.mockResolvedValue({ ...CREATED_TOURNAMENT, roundsCount: 7, timeControl: "90+30" });

    const { wrapper } = await mountView();

    await wrapper.get("#roundsCount").setValue("7");
    await wrapper.get("#timeControl").setValue("90+30");
    await wrapper.get(".config-form").trigger("submit.prevent");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(configureTournamentMock).toHaveBeenCalledWith(
      "tournament-1",
      expect.objectContaining({ roundsCount: 7, timeControl: "90+30" }),
    );
    expect(wrapper.text()).toContain("Configuración guardada");
  });

  it("does not call closeRegistration when the tournament is not in REGISTRATION_OPEN", async () => {
    getTournamentMock.mockResolvedValue(CREATED_TOURNAMENT);

    const { wrapper } = await mountView();

    const closeBtn = wrapper.findAll("button").find((btn) => btn.text() === "Cerrar inscripciones")!;
    await closeBtn.trigger("click");

    expect(closeRegistrationMock).not.toHaveBeenCalled();
  });
});
