import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import { i18n } from "../i18n";
import DashboardView from "./DashboardView.vue";

vi.mock("../services/tournaments", () => ({
  createTournament: vi.fn(),
  getTournament: vi.fn(),
  configureTournament: vi.fn(),
  openRegistration: vi.fn(),
  closeRegistration: vi.fn(),
  enrollPlayer: vi.fn(),
  listEnrolledPlayers: vi.fn(),
  listMyTournaments: vi.fn(),
}));

import { listMyTournaments } from "../services/tournaments";

const listMyTournamentsMock = vi.mocked(listMyTournaments);

async function mountView() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: "/torneos", component: DashboardView },
      { path: "/torneos/nuevo", component: { template: "<div />" } },
      { path: "/torneos/:id", component: { template: "<div />" } },
    ],
  });
  router.push("/torneos");
  await router.isReady();

  const wrapper = mount(DashboardView, { global: { plugins: [router, i18n] } });
  await new Promise((resolve) => setTimeout(resolve, 0));
  await wrapper.vm.$nextTick();
  return { wrapper, router };
}

describe("DashboardView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("shows an empty state when the organizer has no tournaments", async () => {
    listMyTournamentsMock.mockResolvedValue([]);

    const { wrapper } = await mountView();

    expect(wrapper.text()).toContain("Todavía no administras ningún torneo");
  });

  it("lists the organizer's tournaments with their status", async () => {
    listMyTournamentsMock.mockResolvedValue([
      {
        id: "torneo-1",
        nombre: "Copa Universitaria",
        fechaInicio: "2026-10-01",
        fechaFin: "2026-10-03",
        estado: "INSCRIPCIONES_ABIERTAS",
        formato: "suizo",
        numeroRondas: null,
        ritmo: null,
  programaRestringido: null,
  semestreMinimo: null,
        organizadorId: "org-1",
        criteriosDesempate: [],
        createdAt: "2026-09-17T00:00:00.000Z",
      },
    ]);

    const { wrapper } = await mountView();

    expect(wrapper.text()).toContain("Copa Universitaria");
    expect(wrapper.text()).toContain("Inscripciones abiertas");
  });

  it("navigates to the tournament panel when clicking the card", async () => {
    listMyTournamentsMock.mockResolvedValue([
      {
        id: "torneo-1",
        nombre: "Copa Universitaria",
        fechaInicio: "2026-10-01",
        fechaFin: "2026-10-03",
        estado: "CREADO",
        formato: "suizo",
        numeroRondas: null,
        ritmo: null,
  programaRestringido: null,
  semestreMinimo: null,
        organizadorId: "org-1",
        criteriosDesempate: [],
        createdAt: "2026-09-17T00:00:00.000Z",
      },
    ]);

    const { wrapper, router } = await mountView();

    await wrapper.get(".tournament-card").trigger("click");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(router.currentRoute.value.path).toBe("/torneos/torneo-1");
  });
});
