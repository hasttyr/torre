import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import { i18n } from "../i18n";
import CreateTournamentView from "./CreateTournamentView.vue";

vi.mock("../services/torneos", () => ({
  crearTorneo: vi.fn(),
  obtenerTorneo: vi.fn(),
  configurarTorneo: vi.fn(),
  abrirInscripciones: vi.fn(),
  cerrarInscripciones: vi.fn(),
  inscribirJugador: vi.fn(),
  listarJugadoresInscritos: vi.fn(),
}));

import { crearTorneo } from "../services/torneos";

const crearTorneoMock = vi.mocked(crearTorneo);

// DateField (Vue Datepicker) parsea el texto tipeado y confirma con blur
// (applyOnBlur), no con cada evento input como un <input type="date"> nativo.
async function setDateField(wrapper: ReturnType<typeof mount>, id: string, isoDate: string): Promise<void> {
  const [year, month, day] = isoDate.split("-");
  await wrapper.get(`#${id}`).setValue(`${day}/${month}/${year}`);
  await wrapper.get(`#${id}`).trigger("blur");
}

async function mountView() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: "/torneos/nuevo", component: { template: "<div />" } },
      { path: "/torneos/:id", component: { template: "<div />" } },
    ],
  });
  router.push("/torneos/nuevo");
  await router.isReady();

  const wrapper = mount(CreateTournamentView, { global: { plugins: [router, i18n] } });
  return { wrapper, router };
}

describe("CreateTournamentView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("muestra errores de validación y no llama al backend con campos vacíos", async () => {
    const { wrapper } = await mountView();

    await wrapper.find("form").trigger("submit.prevent");

    expect(wrapper.text()).toContain("El nombre debe tener al menos 2 caracteres");
    expect(crearTorneoMock).not.toHaveBeenCalled();
  });

  it("crea el torneo y navega a su panel de administración", async () => {
    crearTorneoMock.mockResolvedValue({
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
    });

    const { wrapper, router } = await mountView();

    await wrapper.find("#nombre").setValue("Copa Universitaria");
    await setDateField(wrapper, "fechaInicio", "2026-10-01");
    await setDateField(wrapper, "fechaFin", "2026-10-03");
    await wrapper.find("form").trigger("submit.prevent");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(crearTorneoMock).toHaveBeenCalledWith({
      nombre: "Copa Universitaria",
      fechaInicio: "2026-10-01",
      fechaFin: "2026-10-03",
      formato: "suizo",
    });
    expect(router.currentRoute.value.path).toBe("/torneos/torneo-1");
  });

  it("rechaza cuando la fecha de fin es anterior a la de inicio", async () => {
    const { wrapper } = await mountView();

    await wrapper.find("#nombre").setValue("Copa Universitaria");
    await setDateField(wrapper, "fechaInicio", "2026-10-05");
    await setDateField(wrapper, "fechaFin", "2026-10-01");
    await wrapper.find("form").trigger("submit.prevent");

    expect(wrapper.text()).toContain("La fecha de fin no puede ser anterior a la fecha de inicio");
    expect(crearTorneoMock).not.toHaveBeenCalled();
  });
});
