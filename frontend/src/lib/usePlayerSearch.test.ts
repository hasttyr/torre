import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";

import { i18n } from "../i18n";
import { usePlayerSearch } from "./usePlayerSearch";

vi.mock("../services/players", () => ({ searchPlayers: vi.fn() }));

import { searchPlayers } from "../services/players";

const LUIS = {
  id: "p1",
  name: "Luis Gómez",
  email: "luis@example.com",
  universityCode: "U1",
  program: "Sistemas",
  semester: 5,
};

enableAutoUnmount(afterEach);

function mountSearch() {
  let search!: ReturnType<typeof usePlayerSearch>;
  mount(
    defineComponent({
      setup() {
        search = usePlayerSearch();
        return () => h("div");
      },
    }),
    { global: { plugins: [i18n] } },
  );
  return search;
}

describe("usePlayerSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks the server once the user stops typing, and announces what it found", async () => {
    vi.mocked(searchPlayers).mockResolvedValue([LUIS]);
    const search = mountSearch();

    search.query.value = "Lu";
    search.query.value = "Luis";
    await flushPromises();
    expect(search.pending.value).toBe(true);
    expect(search.status.value).toBe("");
    expect(searchPlayers).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(300);

    expect(searchPlayers).toHaveBeenCalledOnce();
    expect(searchPlayers).toHaveBeenCalledWith("Luis");
    expect(search.results.value).toEqual([LUIS]);
    expect(search.status.value).toBe("1 jugador encontrado");
  });

  it("says when nothing matches, and goes quiet when the query is cleared", async () => {
    vi.mocked(searchPlayers).mockResolvedValue([]);
    const search = mountSearch();

    search.query.value = "zzz";
    await vi.advanceTimersByTimeAsync(300);
    expect(search.status.value).toBe("Ningún jugador coincide");

    search.reset();
    await flushPromises();
    expect(search.results.value).toEqual([]);
    expect(search.status.value).toBe("");
  });

  it("keeps the newest query's results when an older, slower answer arrives last", async () => {
    let answerFirst!: (players: (typeof LUIS)[]) => void;
    vi.mocked(searchPlayers)
      .mockImplementationOnce(() => new Promise((resolve) => (answerFirst = resolve)))
      .mockResolvedValueOnce([]);
    const search = mountSearch();

    search.query.value = "Lu";
    await vi.advanceTimersByTimeAsync(300);
    search.query.value = "Zoe";
    await vi.advanceTimersByTimeAsync(300);
    answerFirst([LUIS]);
    await flushPromises();

    expect(search.results.value).toEqual([]);
    expect(search.status.value).toBe("Ningún jugador coincide");
  });

  it("drops an answer that arrives after the box was cleared", async () => {
    let answer!: (players: (typeof LUIS)[]) => void;
    vi.mocked(searchPlayers).mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
    const search = mountSearch();

    search.query.value = "Luis";
    await vi.advanceTimersByTimeAsync(300);
    search.reset();
    answer([LUIS]);
    await flushPromises();

    expect(search.results.value).toEqual([]);
    expect(search.pending.value).toBe(false);
  });

  it("treats a failed search as no results", async () => {
    vi.mocked(searchPlayers).mockRejectedValue(new Error("down"));
    const search = mountSearch();

    search.query.value = "Luis";
    await vi.advanceTimersByTimeAsync(300);

    expect(search.results.value).toEqual([]);
    expect(search.pending.value).toBe(false);
  });
});
