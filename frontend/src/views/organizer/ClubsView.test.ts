import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import { i18n } from "../../i18n";
import { clickConfirmDialogButton, mountConfirmDialogHost } from "../../test-support/confirmDialog";
import ClubsView from "./ClubsView.vue";

vi.mock("../../services/players", () => ({
  searchPlayers: vi.fn(),
}));

vi.mock("../../services/clubs", () => ({
  listClubs: vi.fn(),
  createClub: vi.fn(),
  updateClub: vi.fn(),
  deleteClub: vi.fn(),
  listClubPlayers: vi.fn(),
  assignPlayerToClub: vi.fn(),
  removePlayerFromClub: vi.fn(),
}));

import { createClub, deleteClub, listClubPlayers, listClubs, removePlayerFromClub } from "../../services/clubs";
import { searchPlayers } from "../../services/players";

const listClubsMock = vi.mocked(listClubs);
const createClubMock = vi.mocked(createClub);
const deleteClubMock = vi.mocked(deleteClub);
const listClubPlayersMock = vi.mocked(listClubPlayers);
const removePlayerFromClubMock = vi.mocked(removePlayerFromClub);
const searchPlayersMock = vi.mocked(searchPlayers);

const CLUB = { id: "club-1", name: "Club Ajedrez Central", createdAt: "2026-09-17T00:00:00.000Z" };
const ROSTER_PLAYER = {
  playerId: "player-1",
  name: "Luis Gómez",
  universityCode: "U123",
  program: "Sistemas",
  semester: 5,
};

/**
 * Clicks the club-selection button for the given club name.
 *
 * @remarks
 * `wrapper.find("button")` alone would hit AppHeader's locale/theme toggle
 * buttons instead (they render before the page content).
 */
async function selectClubByName(wrapper: Awaited<ReturnType<typeof mountView>>["wrapper"], name: string) {
  const button = wrapper.findAll("li button").find((candidate) => candidate.text() === name);
  if (!button) {
    throw new Error(`No club button found for "${name}"`);
  }
  await button.trigger("click");
}

async function mountView() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [{ path: "/clubes", component: ClubsView }],
  });
  router.push("/clubes");
  await router.isReady();

  const wrapper = mount(ClubsView, { global: { plugins: [router, i18n] } });
  await new Promise((resolve) => setTimeout(resolve, 0));
  await wrapper.vm.$nextTick();
  return { wrapper };
}

describe("ClubsView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("shows an empty state when there are no clubs yet", async () => {
    listClubsMock.mockResolvedValue([]);

    const { wrapper } = await mountView();

    expect(wrapper.text()).toContain("Todavía no hay clubes registrados");
    expect(wrapper.text()).toContain("Selecciona un club para ver y administrar sus jugadores");
  });

  it("lists existing clubs and loads the selected club's roster", async () => {
    listClubsMock.mockResolvedValue([CLUB]);
    listClubPlayersMock.mockResolvedValue([
      { playerId: "player-1", name: "Luis Gómez", universityCode: "U123", program: "Sistemas", semester: 5 },
    ]);

    const { wrapper } = await mountView();
    expect(wrapper.text()).toContain("Club Ajedrez Central");

    await selectClubByName(wrapper, CLUB.name);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(listClubPlayersMock).toHaveBeenCalledWith("club-1");
    expect(wrapper.text()).toContain("Luis Gómez");
  });

  it("creates a new club and selects it", async () => {
    listClubsMock.mockResolvedValue([]);
    createClubMock.mockResolvedValue(CLUB);
    listClubPlayersMock.mockResolvedValue([]);

    const { wrapper } = await mountView();

    await wrapper.get("#newClubName").setValue("Club Ajedrez Central");
    await wrapper.find("form").trigger("submit.prevent");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(createClubMock).toHaveBeenCalledWith("Club Ajedrez Central");
    expect(listClubPlayersMock).toHaveBeenCalledWith("club-1");
    expect(wrapper.text()).toContain("Este club todavía no tiene jugadores");
  });

  it("shows an error when loading clubs fails", async () => {
    listClubsMock.mockRejectedValue(new Error("network error"));

    const { wrapper } = await mountView();

    expect(wrapper.text()).toContain("No se pudieron cargar los clubes");
  });

  it("searches and assigns a player to the selected club's roster", async () => {
    listClubsMock.mockResolvedValue([CLUB]);
    listClubPlayersMock.mockResolvedValue([]);
    searchPlayersMock.mockResolvedValue([
      {
        id: "player-1",
        name: "Luis Gómez",
        email: "luis@example.com",
        universityCode: "U123",
        program: "Sistemas",
        semester: 5,
      },
    ]);

    const { wrapper } = await mountView();
    await selectClubByName(wrapper, CLUB.name);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    await wrapper.get("#clubPlayerQuery").setValue("Luis");
    await new Promise((resolve) => setTimeout(resolve, 350));
    await wrapper.vm.$nextTick();

    expect(searchPlayersMock).toHaveBeenCalledWith("Luis");
    expect(wrapper.text()).toContain("Luis Gómez");
  });

  it.each([
    ["Quitar", true],
    ["Cancelar", false],
  ])("removes a player from the club only if the confirmation is accepted (%s)", async (answer, removed) => {
    listClubsMock.mockResolvedValue([CLUB]);
    listClubPlayersMock.mockResolvedValue([ROSTER_PLAYER]);
    removePlayerFromClubMock.mockResolvedValue(undefined);
    mountConfirmDialogHost();

    const { wrapper } = await mountView();
    await selectClubByName(wrapper, CLUB.name);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    const removeBtn = wrapper.findAll("button").find((btn) => btn.text() === "Quitar")!;
    await removeBtn.trigger("click");
    await wrapper.vm.$nextTick();
    expect(document.body.textContent).toContain("¿Quitar a Luis Gómez del club «Club Ajedrez Central»?");

    await clickConfirmDialogButton(answer);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(removePlayerFromClubMock).toHaveBeenCalledTimes(removed ? 1 : 0);
    if (removed) expect(removePlayerFromClubMock).toHaveBeenCalledWith("club-1", "player-1");
  });

  it("deletes the selected club after confirmation", async () => {
    listClubsMock.mockResolvedValue([CLUB]);
    listClubPlayersMock.mockResolvedValue([]);
    deleteClubMock.mockResolvedValue(undefined);
    mountConfirmDialogHost();

    const { wrapper } = await mountView();
    await selectClubByName(wrapper, CLUB.name);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    const deleteBtn = wrapper.findAll("button").find((btn) => btn.text() === "Eliminar club")!;
    await deleteBtn.trigger("click");
    await wrapper.vm.$nextTick();
    await clickConfirmDialogButton("Eliminar club");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(deleteClubMock).toHaveBeenCalledWith("club-1");
    expect(wrapper.text()).not.toContain("Club Ajedrez Central");
  });

  it("shows an error when a club can't be deleted (still has players)", async () => {
    listClubsMock.mockResolvedValue([CLUB]);
    listClubPlayersMock.mockResolvedValue([]);
    deleteClubMock.mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: "No se puede eliminar un club con jugadores asignados; quítalos primero" } },
    });
    mountConfirmDialogHost();

    const { wrapper } = await mountView();
    await selectClubByName(wrapper, CLUB.name);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    const deleteBtn = wrapper.findAll("button").find((btn) => btn.text() === "Eliminar club")!;
    await deleteBtn.trigger("click");
    await wrapper.vm.$nextTick();
    await clickConfirmDialogButton("Eliminar club");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("No se puede eliminar un club con jugadores asignados");
  });
});
