import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import { i18n } from "../i18n";
import DashboardView from "./DashboardView.vue";

vi.mock("../services/torneos", () => ({
  crearTorneo: vi.fn(),
  obtenerTorneo: vi.fn(),
  configurarTorneo: vi.fn(),
  abrirInscripciones: vi.fn(),
  cerrarInscripciones: vi.fn(),
  inscribirJugador: vi.fn(),
  listarJugadoresInscritos: vi.fn(),
  listarMisTorneos: vi.fn(),
}));

import { listarMisTorneos } from "../services/torneos";

const listarMisTorneosMock = vi.mocked(listarMisTorneos);

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

  it("muestra un estado vacío cuando el organizador no tiene torneos", async () => {
    listarMisTorneosMock.mockResolvedValue([]);

    const { wrapper } = await mountView();

    expect(wrapper.text()).toContain("Todavía no administras ningún torneo");
  });

  it("lista los torneos del organizador con su estado", async () => {
    listarMisTorneosMock.mockResolvedValue([
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

  it("navega al panel del torneo al hacer click en la tarjeta", async () => {
    listarMisTorneosMock.mockResolvedValue([
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
