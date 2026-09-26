import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import { i18n } from "../../i18n";
import PlayerTournamentsView from "./PlayerTournamentsView.vue";

vi.mock("../../services/tournaments", () => ({
  createTournament: vi.fn(),
  getTournament: vi.fn(),
  configureTournament: vi.fn(),
  openRegistration: vi.fn(),
  closeRegistration: vi.fn(),
  enrollPlayer: vi.fn(),
  listEnrolledPlayers: vi.fn(),
  listMyTournaments: vi.fn(),
  listAvailableTournaments: vi.fn(),
  listEnrolledTournaments: vi.fn(),
}));

import { listAvailableTournaments, listEnrolledTournaments } from "../../services/tournaments";

const listAvailableTournamentsMock = vi.mocked(listAvailableTournaments);
const listEnrolledTournamentsMock = vi.mocked(listEnrolledTournaments);

const AVAILABLE_TOURNAMENT = {
  id: "tournament-1",
  name: "Copa Abierta",
  startDate: "2026-10-01",
  endDate: "2026-10-03",
  status: "REGISTRATION_OPEN" as const,
  format: "swiss",
  roundsCount: null,
  timeControl: null,
  restrictedProgram: null,
  minimumSemester: null,
  byePoints: 1,
  organizerId: "org-1",
  tiebreakCriteria: [],
  createdAt: "2026-09-17T00:00:00.000Z",
};

const ENROLLED_TOURNAMENT = {
  ...AVAILABLE_TOURNAMENT,
  id: "tournament-2",
  name: "Copa Interna",
  status: "CREATED" as const,
};

async function mountView() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [{ path: "/mis-torneos", component: PlayerTournamentsView }],
  });
  router.push("/mis-torneos");
  await router.isReady();

  const wrapper = mount(PlayerTournamentsView, { global: { plugins: [router, i18n] } });
  await new Promise((resolve) => setTimeout(resolve, 0));
  await wrapper.vm.$nextTick();
  return { wrapper };
}

describe("PlayerTournamentsView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("outlines the page as one title, two sections and a tournament under each", async () => {
    listAvailableTournamentsMock.mockResolvedValue([AVAILABLE_TOURNAMENT]);
    listEnrolledTournamentsMock.mockResolvedValue([ENROLLED_TOURNAMENT]);

    const { wrapper } = await mountView();

    const outline = wrapper.findAll("h1, h2, h3").map((heading) => `${heading.element.tagName} ${heading.text()}`);
    expect(outline).toEqual([
      "H1 Torneos",
      "H2 Mis inscripciones",
      "H3 Copa Interna",
      "H2 Torneos disponibles",
      "H3 Copa Abierta",
    ]);
  });

  it("shows empty states when there are no available tournaments or registrations", async () => {
    listAvailableTournamentsMock.mockResolvedValue([]);
    listEnrolledTournamentsMock.mockResolvedValue([]);

    const { wrapper } = await mountView();

    expect(wrapper.text()).toContain("Todavía no estás inscrito en ningún torneo");
    expect(wrapper.text()).toContain("No hay torneos con inscripción abierta");
  });

  it("lists available tournaments and the player's registrations separately", async () => {
    listAvailableTournamentsMock.mockResolvedValue([AVAILABLE_TOURNAMENT]);
    listEnrolledTournamentsMock.mockResolvedValue([ENROLLED_TOURNAMENT]);

    const { wrapper } = await mountView();

    expect(wrapper.text()).toContain("Copa Abierta");
    expect(wrapper.text()).toContain("Copa Interna");
  });

  it("shows an error when loading fails, with a way to try again", async () => {
    listAvailableTournamentsMock.mockRejectedValue(new Error("network error"));
    listEnrolledTournamentsMock.mockResolvedValue([]);

    const { wrapper } = await mountView();

    const alert = wrapper.get("[role='alert']");
    expect(alert.text()).toContain("No se pudieron cargar los torneos");
    expect(alert.get("button").text()).toBe("Reintentar");
  });
});

describe("PlayerTournamentsView in Colombia (UTC-5)", () => {
  const originalTimeZone = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = "America/Bogota";
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.TZ = originalTimeZone;
  });

  it("shows a tournament's own dates, not the previous day", async () => {
    listAvailableTournamentsMock.mockResolvedValue([
      { ...AVAILABLE_TOURNAMENT, startDate: "2026-10-15T00:00:00.000Z", endDate: "2026-10-17T00:00:00.000Z" },
    ]);
    listEnrolledTournamentsMock.mockResolvedValue([]);

    const { wrapper } = await mountView();

    expect(wrapper.text()).toMatch(/15 oct/);
    expect(wrapper.text()).toMatch(/17 oct/);
    expect(wrapper.text()).not.toMatch(/14 oct/);
  });

  it("links an enrolled tournament in play to its live room (HU18), and not one still in registration", async () => {
    listAvailableTournamentsMock.mockResolvedValue([]);
    listEnrolledTournamentsMock.mockResolvedValue([
      { ...ENROLLED_TOURNAMENT, id: "t-live", status: "IN_PROGRESS" },
      { ...ENROLLED_TOURNAMENT, id: "t-open", status: "REGISTRATION_OPEN" },
    ]);

    const { wrapper } = await mountView();

    expect(wrapper.find("a[href='/torneos/t-live/sala']").exists()).toBe(true);
    expect(wrapper.find("a[href='/torneos/t-open/sala']").exists()).toBe(false);
  });
});
