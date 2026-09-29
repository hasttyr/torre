import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { i18n } from "../../i18n";
import type { PlayerSearchResult } from "../../services/players";
import PlayerSearchPicker from "./PlayerSearchPicker.vue";

vi.mock("../../services/players", () => ({ searchPlayers: vi.fn() }));

import { searchPlayers } from "../../services/players";

const LUIS: PlayerSearchResult = {
  id: "p-luis",
  name: "Luis Gómez",
  universityCode: "U1",
  program: "Sistemas",
  semester: 5,
};
const EVA: PlayerSearchResult = { ...LUIS, id: "p-eva", name: "Eva Ruiz" };

function mountPicker(options: { pick?: (player: PlayerSearchResult) => Promise<boolean>; disabled?: boolean } = {}) {
  return mount(PlayerSearchPicker, {
    props: {
      id: "clubPlayerQuery",
      label: "Buscar jugador",
      placeholder: "Nombre o código",
      actionLabel: "Asignar",
      addedLabel: "Ya está en el club",
      isAdded: (player: PlayerSearchResult) => player.id === EVA.id,
      busy: false,
      pick: options.pick ?? vi.fn(async () => true),
      disabled: options.disabled ?? false,
    },
    global: { plugins: [i18n] },
  });
}

async function typeAndWait(wrapper: ReturnType<typeof mountPicker>, text: string) {
  await wrapper.get("input").setValue(text);
  await vi.advanceTimersByTimeAsync(300);
  await flushPromises();
}

const actionFor = (wrapper: ReturnType<typeof mountPicker>, name: string) =>
  wrapper
    .findAll("li")
    .find((item) => item.text().includes(name))!
    .get("button");

describe("PlayerSearchPicker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("finds players once the user stops typing, each with the page's action", async () => {
    vi.mocked(searchPlayers).mockResolvedValue([LUIS]);
    const wrapper = mountPicker();

    await typeAndWait(wrapper, "Luis");

    expect(searchPlayers).toHaveBeenCalledWith("Luis");
    expect(wrapper.get("label").attributes("for")).toBe("clubPlayerQuery");
    expect(actionFor(wrapper, "Luis Gómez").text()).toBe("Asignar");
  });

  it("marks who's already added, and doesn't offer the action for them", async () => {
    vi.mocked(searchPlayers).mockResolvedValue([LUIS, EVA]);
    const wrapper = mountPicker();

    await typeAndWait(wrapper, "a");

    expect(actionFor(wrapper, "Eva Ruiz").text()).toBe("Ya está en el club");
    expect(actionFor(wrapper, "Eva Ruiz").attributes("disabled")).toBeDefined();
  });

  it("clears the search once the chosen player was added", async () => {
    vi.mocked(searchPlayers).mockResolvedValue([LUIS]);
    const pick = vi.fn(async () => true);
    const wrapper = mountPicker({ pick });
    await typeAndWait(wrapper, "Luis");

    await actionFor(wrapper, "Luis Gómez").trigger("click");
    await flushPromises();

    expect(pick).toHaveBeenCalledWith(LUIS);
    expect((wrapper.get("input").element as HTMLInputElement).value).toBe("");
  });

  it("keeps the search when adding failed, to try again", async () => {
    vi.mocked(searchPlayers).mockResolvedValue([LUIS]);
    const wrapper = mountPicker({ pick: vi.fn(async () => false) });
    await typeAndWait(wrapper, "Luis");

    await actionFor(wrapper, "Luis Gómez").trigger("click");
    await flushPromises();

    expect((wrapper.get("input").element as HTMLInputElement).value).toBe("Luis");
  });

  it("says so when nobody matches", async () => {
    vi.mocked(searchPlayers).mockResolvedValue([]);
    const wrapper = mountPicker();

    await typeAndWait(wrapper, "zzz");

    expect(wrapper.get("ul").text()).toBe("Ningún jugador coincide.");
  });

  it("can't be used while the page doesn't allow adding anyone", async () => {
    const wrapper = mountPicker({ disabled: true });

    expect(wrapper.get("input").attributes("disabled")).toBeDefined();
    expect(wrapper.find("ul").exists()).toBe(false);
  });
});
