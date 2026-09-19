import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import { i18n } from "../i18n";
import PlayerTournamentsView from "./PlayerTournamentsView.vue";

vi.mock("../services/tournaments", () => ({
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

import { listAvailableTournaments, listEnrolledTournaments } from "../services/tournaments";

const listAvailableTournamentsMock = vi.mocked(listAvailableTournaments);
const listEnrolledTournamentsMock = vi.mocked(listEnrolledTournaments);

const AVAILABLE_TOURNAMENT = {
  id: "torneo-1",
  nombre: "Copa Abierta",
  fechaInicio: "2026-10-01",
  fechaFin: "2026-10-03",
  estado: "INSCRIPCIONES_ABIERTAS" as const,
  formato: "suizo",
  numeroRondas: null,
  ritmo: null,
  programaRestringido: null,
  semestreMinimo: null,
  organizadorId: "org-1",
  criteriosDesempate: [],
  createdAt: "2026-09-17T00:00:00.000Z",
};

const ENROLLED_TOURNAMENT = { ...AVAILABLE_TOURNAMENT, id: "torneo-2", nombre: "Copa Interna", estado: "CREADO" as const };

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

  it("shows an error when loading fails", async () => {
    listAvailableTournamentsMock.mockRejectedValue(new Error("network error"));
    listEnrolledTournamentsMock.mockResolvedValue([]);

    const { wrapper } = await mountView();

    expect(wrapper.text()).toContain("No se pudieron cargar los torneos");
  });
});
