import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import PlayerTournamentsView from "./PlayerTournamentsView.vue";

vi.mock("../services/torneos", () => ({
  crearTorneo: vi.fn(),
  obtenerTorneo: vi.fn(),
  configurarTorneo: vi.fn(),
  abrirInscripciones: vi.fn(),
  cerrarInscripciones: vi.fn(),
  inscribirJugador: vi.fn(),
  listarJugadoresInscritos: vi.fn(),
  listarMisTorneos: vi.fn(),
  listarTorneosDisponibles: vi.fn(),
  listarTorneosInscrito: vi.fn(),
}));

import { listarTorneosDisponibles, listarTorneosInscrito } from "../services/torneos";

const listarTorneosDisponiblesMock = vi.mocked(listarTorneosDisponibles);
const listarTorneosInscritoMock = vi.mocked(listarTorneosInscrito);

const TORNEO_DISPONIBLE = {
  id: "torneo-1",
  nombre: "Copa Abierta",
  fechaInicio: "2026-10-01",
  fechaFin: "2026-10-03",
  estado: "INSCRIPCIONES_ABIERTAS" as const,
  formato: "suizo",
  numeroRondas: null,
  ritmo: null,
  organizadorId: "org-1",
  criteriosDesempate: [],
  createdAt: "2026-09-17T00:00:00.000Z",
};

const TORNEO_INSCRITO = { ...TORNEO_DISPONIBLE, id: "torneo-2", nombre: "Copa Interna", estado: "CREADO" as const };

async function mountView() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [{ path: "/mis-torneos", component: PlayerTournamentsView }],
  });
  router.push("/mis-torneos");
  await router.isReady();

  const wrapper = mount(PlayerTournamentsView, { global: { plugins: [router] } });
  await new Promise((resolve) => setTimeout(resolve, 0));
  await wrapper.vm.$nextTick();
  return { wrapper };
}

describe("PlayerTournamentsView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("muestra estados vacíos cuando no hay disponibles ni inscripciones", async () => {
    listarTorneosDisponiblesMock.mockResolvedValue([]);
    listarTorneosInscritoMock.mockResolvedValue([]);

    const { wrapper } = await mountView();

    expect(wrapper.text()).toContain("Todavía no estás inscrito en ningún torneo");
    expect(wrapper.text()).toContain("No hay torneos con inscripción abierta");
  });

  it("lista los torneos disponibles y las inscripciones del jugador por separado", async () => {
    listarTorneosDisponiblesMock.mockResolvedValue([TORNEO_DISPONIBLE]);
    listarTorneosInscritoMock.mockResolvedValue([TORNEO_INSCRITO]);

    const { wrapper } = await mountView();

    expect(wrapper.text()).toContain("Copa Abierta");
    expect(wrapper.text()).toContain("Copa Interna");
  });

  it("muestra un error si falla la carga", async () => {
    listarTorneosDisponiblesMock.mockRejectedValue(new Error("network error"));
    listarTorneosInscritoMock.mockResolvedValue([]);

    const { wrapper } = await mountView();

    expect(wrapper.text()).toContain("No se pudieron cargar los torneos");
  });
});
