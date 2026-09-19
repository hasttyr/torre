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
  id: "torneo-1",
  nombre: "Copa Universitaria",
  fechaInicio: "2026-10-01",
  fechaFin: "2026-10-03",
  estado: "CREADO" as const,
  formato: "suizo",
  numeroRondas: null,
  ritmo: null,
  programaRestringido: null,
  semestreMinimo: null,
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

  it("carga y muestra el torneo con su estado", async () => {
    getTournamentMock.mockResolvedValue(CREATED_TOURNAMENT);

    const { wrapper } = await mountView();

    expect(wrapper.text()).toContain("Copa Universitaria");
    expect(wrapper.text()).toContain("Preliminar");
  });

  it("habilita abrir inscripciones solo cuando el torneo está en CREADO", async () => {
    getTournamentMock.mockResolvedValue(CREATED_TOURNAMENT);

    const { wrapper } = await mountView();

    const openBtn = wrapper.findAll("button").find((btn) => btn.text() === "Abrir inscripciones")!;
    expect(openBtn.attributes("disabled")).toBeUndefined();

    const closeBtn = wrapper.findAll("button").find((btn) => btn.text() === "Cerrar inscripciones")!;
    expect(closeBtn.attributes("disabled")).toBeDefined();
  });

  it("abre inscripciones y refleja el nuevo estado (HU06)", async () => {
    getTournamentMock.mockResolvedValue(CREATED_TOURNAMENT);
    openRegistrationMock.mockResolvedValue({ ...CREATED_TOURNAMENT, estado: "INSCRIPCIONES_ABIERTAS" });

    const { wrapper } = await mountView();

    const openBtn = wrapper.findAll("button").find((btn) => btn.text() === "Abrir inscripciones")!;
    await openBtn.trigger("click");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(openRegistrationMock).toHaveBeenCalledWith("torneo-1");
    expect(wrapper.text()).toContain("Inscripciones abiertas");
  });

  it("bloquea el campo de búsqueda de jugador cuando las inscripciones no están abiertas", async () => {
    getTournamentMock.mockResolvedValue(CREATED_TOURNAMENT);

    const { wrapper } = await mountView();

    const playerQueryInput = wrapper.get("#playerQuery");
    expect(playerQueryInput.attributes("disabled")).toBeDefined();
  });

  it("busca y muestra resultados a medida que se escribe (debounced)", async () => {
    getTournamentMock.mockResolvedValue({ ...CREATED_TOURNAMENT, estado: "INSCRIPCIONES_ABIERTAS" });
    searchPlayersMock.mockResolvedValue([
      { id: "j1", nombre: "Luis Gómez", email: "luis@example.com", codigoUniversitario: "U1", programa: "Sistemas", semestre: 5 },
    ]);

    const { wrapper } = await mountView();

    await wrapper.get("#playerQuery").setValue("Luis");
    await new Promise((resolve) => setTimeout(resolve, 350));
    await wrapper.vm.$nextTick();

    expect(searchPlayersMock).toHaveBeenCalledWith("Luis");
    expect(wrapper.text()).toContain("Luis Gómez");
  });

  it("inscribe un jugador elegido de los resultados de búsqueda (HU07)", async () => {
    getTournamentMock.mockResolvedValue({ ...CREATED_TOURNAMENT, estado: "INSCRIPCIONES_ABIERTAS" });
    searchPlayersMock.mockResolvedValue([
      { id: "j1", nombre: "Luis Gómez", email: "luis@example.com", codigoUniversitario: "U1", programa: "Sistemas", semestre: 5 },
    ]);
    enrollPlayerMock.mockResolvedValue({
      jugadorId: "j1",
      nombre: "Luis Gómez",
      codigoUniversitario: "U1",
      programa: "Sistemas",
      semestre: 5,
      inscritoEn: "2026-09-17",
    });

    const { wrapper } = await mountView();

    await wrapper.get("#playerQuery").setValue("Luis");
    await new Promise((resolve) => setTimeout(resolve, 350));
    await wrapper.vm.$nextTick();

    const enrollBtn = wrapper.findAll("button").find((btn) => btn.text() === "Inscribir")!;
    await enrollBtn.trigger("click");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(enrollPlayerMock).toHaveBeenCalledWith("torneo-1", "j1");
    expect(wrapper.text()).toContain("Luis Gómez");
  });

  it("deshabilita la edición de desempates si ya no está en estado preliminar", async () => {
    getTournamentMock.mockResolvedValue({ ...CREATED_TOURNAMENT, estado: "INSCRIPCIONES_ABIERTAS" });

    const { wrapper } = await mountView();

    const tiebreaksInput = wrapper.get("#desempates");
    expect(tiebreaksInput.attributes("disabled")).toBeDefined();
  });

  it("guarda la configuración del torneo (HU05)", async () => {
    getTournamentMock.mockResolvedValue(CREATED_TOURNAMENT);
    configureTournamentMock.mockResolvedValue({ ...CREATED_TOURNAMENT, numeroRondas: 7, ritmo: "90+30" });

    const { wrapper } = await mountView();

    await wrapper.get("#numeroRondas").setValue("7");
    await wrapper.get("#ritmo").setValue("90+30");
    await wrapper.get(".config-form").trigger("submit.prevent");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(configureTournamentMock).toHaveBeenCalledWith(
      "torneo-1",
      expect.objectContaining({ numeroRondas: 7, ritmo: "90+30" }),
    );
    expect(wrapper.text()).toContain("Configuración guardada");
  });

  it("no llama a closeRegistration cuando el torneo no está en INSCRIPCIONES_ABIERTAS", async () => {
    getTournamentMock.mockResolvedValue(CREATED_TOURNAMENT);

    const { wrapper } = await mountView();

    const closeBtn = wrapper.findAll("button").find((btn) => btn.text() === "Cerrar inscripciones")!;
    await closeBtn.trigger("click");

    expect(closeRegistrationMock).not.toHaveBeenCalled();
  });
});
