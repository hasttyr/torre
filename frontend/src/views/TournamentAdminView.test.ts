import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import TournamentAdminView from "./TournamentAdminView.vue";

vi.mock("../services/torneos", () => ({
  crearTorneo: vi.fn(),
  obtenerTorneo: vi.fn(),
  configurarTorneo: vi.fn(),
  abrirInscripciones: vi.fn(),
  cerrarInscripciones: vi.fn(),
  inscribirJugador: vi.fn(),
  listarJugadoresInscritos: vi.fn(),
}));

vi.mock("../services/jugadores", () => ({
  buscarJugadores: vi.fn(),
}));

import {
  abrirInscripciones,
  cerrarInscripciones,
  configurarTorneo,
  inscribirJugador,
  listarJugadoresInscritos,
  obtenerTorneo,
} from "../services/torneos";
import { buscarJugadores } from "../services/jugadores";

const obtenerTorneoMock = vi.mocked(obtenerTorneo);
const listarJugadoresInscritosMock = vi.mocked(listarJugadoresInscritos);
const configurarTorneoMock = vi.mocked(configurarTorneo);
const abrirInscripcionesMock = vi.mocked(abrirInscripciones);
const cerrarInscripcionesMock = vi.mocked(cerrarInscripciones);
const inscribirJugadorMock = vi.mocked(inscribirJugador);
const buscarJugadoresMock = vi.mocked(buscarJugadores);

const TORNEO_CREADO = {
  id: "torneo-1",
  nombre: "Copa Universitaria",
  fechaInicio: "2026-10-01",
  fechaFin: "2026-10-03",
  estado: "CREADO" as const,
  formato: "suizo",
  numeroRondas: null,
  ritmo: null,
  organizadorId: "org-1",
  criteriosDesempate: [],
  createdAt: "2026-09-17T00:00:00.000Z",
};

async function mountView() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [{ path: "/torneos/:id", component: TournamentAdminView }],
  });
  router.push("/torneos/torneo-1");
  await router.isReady();

  const wrapper = mount(TournamentAdminView, { global: { plugins: [router] } });
  await new Promise((resolve) => setTimeout(resolve, 0));
  await wrapper.vm.$nextTick();
  return { wrapper, router };
}

describe("TournamentAdminView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    listarJugadoresInscritosMock.mockResolvedValue([]);
    buscarJugadoresMock.mockResolvedValue([]);
  });

  it("carga y muestra el torneo con su estado", async () => {
    obtenerTorneoMock.mockResolvedValue(TORNEO_CREADO);

    const { wrapper } = await mountView();

    expect(wrapper.text()).toContain("Copa Universitaria");
    expect(wrapper.text()).toContain("Preliminar");
  });

  it("habilita abrir inscripciones solo cuando el torneo está en CREADO", async () => {
    obtenerTorneoMock.mockResolvedValue(TORNEO_CREADO);

    const { wrapper } = await mountView();

    const abrirBtn = wrapper.findAll("button").find((btn) => btn.text() === "Abrir inscripciones")!;
    expect(abrirBtn.attributes("disabled")).toBeUndefined();

    const cerrarBtn = wrapper.findAll("button").find((btn) => btn.text() === "Cerrar inscripciones")!;
    expect(cerrarBtn.attributes("disabled")).toBeDefined();
  });

  it("abre inscripciones y refleja el nuevo estado (HU06)", async () => {
    obtenerTorneoMock.mockResolvedValue(TORNEO_CREADO);
    abrirInscripcionesMock.mockResolvedValue({ ...TORNEO_CREADO, estado: "INSCRIPCIONES_ABIERTAS" });

    const { wrapper } = await mountView();

    const abrirBtn = wrapper.findAll("button").find((btn) => btn.text() === "Abrir inscripciones")!;
    await abrirBtn.trigger("click");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(abrirInscripcionesMock).toHaveBeenCalledWith("torneo-1");
    expect(wrapper.text()).toContain("Inscripciones abiertas");
  });

  it("bloquea el campo de búsqueda de jugador cuando las inscripciones no están abiertas", async () => {
    obtenerTorneoMock.mockResolvedValue(TORNEO_CREADO);

    const { wrapper } = await mountView();

    const jugadorInput = wrapper.get("#jugadorQuery");
    expect(jugadorInput.attributes("disabled")).toBeDefined();
  });

  it("busca y muestra resultados a medida que se escribe (debounced)", async () => {
    obtenerTorneoMock.mockResolvedValue({ ...TORNEO_CREADO, estado: "INSCRIPCIONES_ABIERTAS" });
    buscarJugadoresMock.mockResolvedValue([
      { id: "j1", nombre: "Luis Gómez", email: "luis@example.com", codigoUniversitario: "U1", programa: "Sistemas", semestre: 5 },
    ]);

    const { wrapper } = await mountView();

    await wrapper.get("#jugadorQuery").setValue("Luis");
    await new Promise((resolve) => setTimeout(resolve, 350));
    await wrapper.vm.$nextTick();

    expect(buscarJugadoresMock).toHaveBeenCalledWith("Luis");
    expect(wrapper.text()).toContain("Luis Gómez");
  });

  it("inscribe un jugador elegido de los resultados de búsqueda (HU07)", async () => {
    obtenerTorneoMock.mockResolvedValue({ ...TORNEO_CREADO, estado: "INSCRIPCIONES_ABIERTAS" });
    buscarJugadoresMock.mockResolvedValue([
      { id: "j1", nombre: "Luis Gómez", email: "luis@example.com", codigoUniversitario: "U1", programa: "Sistemas", semestre: 5 },
    ]);
    inscribirJugadorMock.mockResolvedValue({
      jugadorId: "j1",
      nombre: "Luis Gómez",
      codigoUniversitario: "U1",
      programa: "Sistemas",
      semestre: 5,
      inscritoEn: "2026-09-17",
    });

    const { wrapper } = await mountView();

    await wrapper.get("#jugadorQuery").setValue("Luis");
    await new Promise((resolve) => setTimeout(resolve, 350));
    await wrapper.vm.$nextTick();

    const inscribirBtn = wrapper.findAll("button").find((btn) => btn.text() === "Inscribir")!;
    await inscribirBtn.trigger("click");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(inscribirJugadorMock).toHaveBeenCalledWith("torneo-1", "j1");
    expect(wrapper.text()).toContain("Luis Gómez");
  });

  it("deshabilita la edición de desempates si ya no está en estado preliminar", async () => {
    obtenerTorneoMock.mockResolvedValue({ ...TORNEO_CREADO, estado: "INSCRIPCIONES_ABIERTAS" });

    const { wrapper } = await mountView();

    const desempatesInput = wrapper.get("#desempates");
    expect(desempatesInput.attributes("disabled")).toBeDefined();
  });

  it("guarda la configuración del torneo (HU05)", async () => {
    obtenerTorneoMock.mockResolvedValue(TORNEO_CREADO);
    configurarTorneoMock.mockResolvedValue({ ...TORNEO_CREADO, numeroRondas: 7, ritmo: "90+30" });

    const { wrapper } = await mountView();

    await wrapper.get("#numeroRondas").setValue("7");
    await wrapper.get("#ritmo").setValue("90+30");
    await wrapper.get(".config-form").trigger("submit.prevent");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(configurarTorneoMock).toHaveBeenCalledWith(
      "torneo-1",
      expect.objectContaining({ numeroRondas: 7, ritmo: "90+30" }),
    );
    expect(wrapper.text()).toContain("Configuración guardada");
  });

  it("no llama a cerrarInscripciones cuando el torneo no está en INSCRIPCIONES_ABIERTAS", async () => {
    obtenerTorneoMock.mockResolvedValue(TORNEO_CREADO);

    const { wrapper } = await mountView();

    const cerrarBtn = wrapper.findAll("button").find((btn) => btn.text() === "Cerrar inscripciones")!;
    await cerrarBtn.trigger("click");

    expect(cerrarInscripcionesMock).not.toHaveBeenCalled();
  });
});
