import { useQueryCache } from "@pinia/colada";
import { flushPromises, mount } from "@vue/test-utils";
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

async function mountView(url = "/clubes") {
  const router = createRouter({
    history: createWebHistory(),
    routes: [{ path: "/clubes", component: ClubsView }],
  });
  router.push(url);
  await router.isReady();

  const wrapper = mount(ClubsView, { global: { plugins: [router, i18n] } });
  await flushPromises();
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
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(listClubPlayersMock).toHaveBeenCalledWith("club-1");
    expect(wrapper.text()).toContain("Luis Gómez");
  });

  it("says the roster is loading instead of claiming the club is empty", async () => {
    listClubsMock.mockResolvedValue([CLUB]);
    listClubPlayersMock.mockReturnValue(new Promise(() => {}));

    const { wrapper } = await mountView();
    await selectClubByName(wrapper, CLUB.name);
    await flushPromises();

    expect(wrapper.text()).toContain("Cargando jugadores…");
    expect(wrapper.text()).not.toContain("Este club todavía no tiene jugadores");
  });

  it("keeps the selected club in the URL", async () => {
    listClubsMock.mockResolvedValue([CLUB]);
    listClubPlayersMock.mockResolvedValue([ROSTER_PLAYER]);

    const { wrapper } = await mountView();
    await selectClubByName(wrapper, CLUB.name);
    await flushPromises();

    expect(wrapper.vm.$router.currentRoute.value.query).toEqual({ club: "club-1" });
  });

  it("opens the club a shared link points to", async () => {
    listClubsMock.mockResolvedValue([CLUB]);
    listClubPlayersMock.mockResolvedValue([ROSTER_PLAYER]);

    const { wrapper } = await mountView("/clubes?club=club-1");
    await flushPromises();

    expect(listClubPlayersMock).toHaveBeenCalledWith("club-1");
    expect(wrapper.text()).toContain("Luis Gómez");
    expect(wrapper.get("li button[aria-pressed='true']").text()).toBe(CLUB.name);
  });

  it("shows the selected club's players even when an earlier club's roster answers last (F-B2)", async () => {
    const OTHER = { ...CLUB, id: "club-2", name: "Club Norte" };
    let answerFirst: (players: (typeof ROSTER_PLAYER)[]) => void = () => undefined;
    listClubsMock.mockResolvedValue([CLUB, OTHER]);
    listClubPlayersMock.mockImplementation((clubId) =>
      clubId === "club-1"
        ? new Promise((resolve) => (answerFirst = resolve))
        : Promise.resolve([{ ...ROSTER_PLAYER, playerId: "player-9", name: "Eva Ruiz" }]),
    );

    const { wrapper } = await mountView();
    await selectClubByName(wrapper, CLUB.name);
    await selectClubByName(wrapper, OTHER.name);
    await flushPromises();
    answerFirst([ROSTER_PLAYER]);
    await flushPromises();

    expect(wrapper.text()).toContain("Eva Ruiz");
    expect(wrapper.text()).not.toContain("Luis Gómez");
  });

  it("keeps a new name being typed when the list of clubs is read again in the background", async () => {
    listClubsMock.mockImplementation(async () => [{ ...CLUB }]);
    listClubPlayersMock.mockResolvedValue([]);
    const { wrapper } = await mountView();
    await selectClubByName(wrapper, CLUB.name);
    await flushPromises();
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Renombrar")!
      .trigger("click");
    await wrapper.get("#renameClubName").setValue("Club Ajedrez del Sur");

    await useQueryCache().invalidateQueries({ key: ["clubs"] });
    await flushPromises();

    expect(listClubsMock).toHaveBeenCalledTimes(2);
    expect((wrapper.get("#renameClubName").element as HTMLInputElement).value).toBe("Club Ajedrez del Sur");
  });

  it("creates a new club and selects it", async () => {
    listClubsMock.mockResolvedValue([]);
    createClubMock.mockResolvedValue(CLUB);
    listClubPlayersMock.mockResolvedValue([]);

    const { wrapper } = await mountView();

    await wrapper.get("#newClubName").setValue("Club Ajedrez Central");
    await wrapper.find("form").trigger("submit.prevent");
    await flushPromises();
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
        universityCode: "U123",
        program: "Sistemas",
        semester: 5,
      },
    ]);

    const { wrapper } = await mountView();
    await selectClubByName(wrapper, CLUB.name);
    await flushPromises();
    await wrapper.vm.$nextTick();

    await wrapper.get("#clubPlayerQuery").setValue("Luis");
    await new Promise((resolve) => setTimeout(resolve, 350));
    await wrapper.vm.$nextTick();

    expect(searchPlayersMock).toHaveBeenCalledWith("Luis");
    expect(wrapper.text()).toContain("Luis Gómez");
    expect(wrapper.get("[role='status']").text()).toBe("1 jugador encontrado");
    expect(wrapper.get("#clubPlayerQuery").attributes()).toMatchObject({ type: "search", autocomplete: "off" });
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
    await flushPromises();
    await wrapper.vm.$nextTick();

    const removeBtn = wrapper.findAll("button").find((btn) => btn.text() === "Quitar")!;
    await removeBtn.trigger("click");
    await wrapper.vm.$nextTick();
    expect(document.body.textContent).toContain("¿Quitar a Luis Gómez del club «Club Ajedrez Central»?");

    await clickConfirmDialogButton(answer);
    await flushPromises();

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
    await flushPromises();
    await wrapper.vm.$nextTick();

    const deleteBtn = wrapper.findAll("button").find((btn) => btn.text() === "Eliminar club")!;
    await deleteBtn.trigger("click");
    await wrapper.vm.$nextTick();
    await clickConfirmDialogButton("Eliminar club");
    await flushPromises();
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
    await flushPromises();
    await wrapper.vm.$nextTick();

    const deleteBtn = wrapper.findAll("button").find((btn) => btn.text() === "Eliminar club")!;
    await deleteBtn.trigger("click");
    await wrapper.vm.$nextTick();
    await clickConfirmDialogButton("Eliminar club");
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("No se puede eliminar un club con jugadores asignados");
  });
});
