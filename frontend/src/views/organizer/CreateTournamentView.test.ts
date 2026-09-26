import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import { i18n } from "../../i18n";
import { clickConfirmDialogButton, mountConfirmDialogHost } from "../../test-support/confirmDialog";
import CreateTournamentView from "./CreateTournamentView.vue";

vi.mock("../../services/tournaments", () => ({
  createTournament: vi.fn(),
  getTournament: vi.fn(),
  configureTournament: vi.fn(),
  openRegistration: vi.fn(),
  closeRegistration: vi.fn(),
  enrollPlayer: vi.fn(),
  listEnrolledPlayers: vi.fn(),
}));

import { createTournament } from "../../services/tournaments";

const createTournamentMock = vi.mocked(createTournament);

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

  // attachTo: a failed submit moves focus, which jsdom only tracks for attached nodes.
  const wrapper = mount(CreateTournamentView, { global: { plugins: [router, i18n] }, attachTo: document.body });
  return { wrapper, router };
}

enableAutoUnmount(afterEach);

/** Mounts the view through <RouterView>, as the app does: route-leave guards only run there. */
async function mountRouted() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: "/torneos/nuevo", component: CreateTournamentView },
      { path: "/torneos/:id", component: { template: "<div />" } },
    ],
  });
  await router.push("/torneos/nuevo");
  const wrapper = mount({ template: "<RouterView />" }, { global: { plugins: [router, i18n] } });
  await flushPromises();
  return { wrapper, router };
}

describe("CreateTournamentView — leaving with unsaved changes", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("asks before throwing away a half-filled form", async () => {
    mountConfirmDialogHost();
    const { wrapper, router } = await mountRouted();

    await wrapper.find("#name").setValue("Copa Universitaria");
    const navigation = router.push("/torneos/otro");
    await flushPromises();
    await clickConfirmDialogButton("Cancelar");
    await navigation;

    expect(router.currentRoute.value.path).toBe("/torneos/nuevo");
  });

  it("doesn't ask once the tournament is created", async () => {
    mountConfirmDialogHost();
    createTournamentMock.mockResolvedValue({ id: "tournament-1" } as never);
    const { wrapper, router } = await mountRouted();

    await wrapper.find("#name").setValue("Copa Universitaria");
    await setDateField(wrapper, "startDate", "2026-10-01");
    await setDateField(wrapper, "endDate", "2026-10-03");
    await wrapper.find("form").trigger("submit.prevent");
    await flushPromises();

    expect(document.querySelector("[role='alertdialog']")).toBeNull();
    expect(router.currentRoute.value.path).toBe("/torneos/tournament-1");
  });
});

describe("CreateTournamentView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("shows validation errors and does not call the backend with empty fields", async () => {
    const { wrapper } = await mountView();

    await wrapper.find("form").trigger("submit.prevent");

    expect(wrapper.text()).toContain("El nombre debe tener al menos 2 caracteres");
    expect(createTournamentMock).not.toHaveBeenCalled();
  });

  it("marks the fields with errors, dates included, and takes the user to the first one", async () => {
    const { wrapper } = await mountView();

    await wrapper.find("#name").setValue("Copa Universitaria");
    await wrapper.find("form").trigger("submit.prevent");
    await flushPromises();

    expect(wrapper.get("#name").attributes("aria-invalid")).toBeUndefined();
    expect(wrapper.get("#startDate").attributes("aria-invalid")).toBe("true");
    expect(wrapper.get("#endDate").attributes("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(wrapper.get("#startDate").element);
  });

  it("keeps tournament fields out of autofill suggestions", async () => {
    const { wrapper } = await mountView();

    expect(wrapper.get("#name").attributes()).toMatchObject({ name: "name", autocomplete: "off" });
    expect(wrapper.get("#format").attributes()).toMatchObject({ name: "format", autocomplete: "off" });
    expect(wrapper.get("#startDate").attributes()).toMatchObject({ name: "startDate", autocomplete: "off" });
  });

  it("creates the tournament and navigates to its admin panel", async () => {
    createTournamentMock.mockResolvedValue({
      id: "tournament-1",
      name: "Copa Universitaria",
      startDate: "2026-10-01",
      endDate: "2026-10-03",
      status: "CREATED",
      format: "swiss",
      roundsCount: null,
      timeControl: null,
      restrictedProgram: null,
      minimumSemester: null,
      byePoints: 1,
      organizerId: "org-1",
      tiebreakCriteria: [],
      createdAt: "2026-09-17T00:00:00.000Z",
    });

    const { wrapper, router } = await mountView();

    await wrapper.find("#name").setValue("Copa Universitaria");
    await setDateField(wrapper, "startDate", "2026-10-01");
    await setDateField(wrapper, "endDate", "2026-10-03");
    await wrapper.find("form").trigger("submit.prevent");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(createTournamentMock).toHaveBeenCalledWith({
      name: "Copa Universitaria",
      startDate: "2026-10-01",
      endDate: "2026-10-03",
      format: "swiss",
    });
    expect(router.currentRoute.value.path).toBe("/torneos/tournament-1");
  });

  it("rejects when the end date is earlier than the start date", async () => {
    const { wrapper } = await mountView();

    await wrapper.find("#name").setValue("Copa Universitaria");
    await setDateField(wrapper, "startDate", "2026-10-05");
    await setDateField(wrapper, "endDate", "2026-10-01");
    await wrapper.find("form").trigger("submit.prevent");

    expect(wrapper.text()).toContain("La fecha de fin no puede ser anterior a la fecha de inicio");
    expect(createTournamentMock).not.toHaveBeenCalled();
  });
});
