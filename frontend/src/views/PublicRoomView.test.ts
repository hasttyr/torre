import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import { i18n } from "../i18n";
import type { PublicRoom } from "../services/tournaments";
import PublicRoomView from "./PublicRoomView.vue";

vi.mock("../services/tournaments", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/tournaments")>()),
  getPublicRoom: vi.fn(),
}));

import { getPublicRoom } from "../services/tournaments";

const ID = "3f2b8c1e-6a4d-4e2f-9b7a-1c5d8e9f0a2b";

function room(overrides: Partial<PublicRoom["tournament"]> = {}): PublicRoom {
  return {
    tournament: {
      id: ID,
      name: "Copa Primavera",
      startDate: "2026-10-01",
      endDate: "2026-10-03",
      status: "IN_PROGRESS",
      format: "swiss",
      roundsCount: 3,
      timeControl: "15+10",
      restrictedProgram: null,
      minimumSemester: null,
      ...overrides,
    },
    rounds: [
      {
        number: 1,
        status: "STANDINGS_UPDATED",
        matches: [{ board: 1, white: "Ana Ruiz", black: "Beto Gil", result: "1-0", isBye: false }],
      },
      {
        number: 2,
        status: "RECORDING_RESULTS",
        matches: [
          { board: 1, white: "Beto Gil", black: "Carla Díaz", result: null, isBye: false },
          { board: 2, white: "Ana Ruiz", black: null, result: "1-0", isBye: true },
        ],
      },
    ],
    standings: {
      pending: true,
      roundsCompleted: 1,
      tiebreaks: ["BUCHHOLZ"],
      rows: [
        { rank: 1, name: "Ana Ruiz", score: 2, buchholz: 0, buchholzCut1: 0, sonnebornBerger: 0, withdrawn: false },
        { rank: 2, name: "Beto Gil", score: 0, buchholz: 2, buchholzCut1: 0, sonnebornBerger: 0, withdrawn: false },
      ],
    },
  };
}

async function mountView() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: "/sala-publica/:id", component: PublicRoomView },
      { path: "/:any(.*)", component: { template: "<div />" } },
    ],
  });
  router.push(`/sala-publica/${ID}`);
  await router.isReady();
  const wrapper = mount(PublicRoomView, { global: { plugins: [router, i18n] } });
  await flushPromises();
  return wrapper;
}

// #140: a tournament's room, as anyone sees it without signing in.
describe("PublicRoomView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the latest round's boards and the standings, by name", async () => {
    vi.mocked(getPublicRoom).mockResolvedValue(room());

    const wrapper = await mountView();
    const latest = wrapper.get("section[aria-labelledby='public-round-heading']");

    expect(wrapper.get("h1").text()).toBe("Copa Primavera");
    expect(latest.text()).toContain("Ronda 2");
    expect(latest.text()).toContain("Carla Díaz");
    expect(wrapper.get("section[aria-labelledby='public-standings-heading'] tbody").text()).toContain("Ana Ruiz");
    expect(wrapper.text()).toContain("solo nombres y resultados deportivos");
  });

  it("keeps earlier rounds folded below", async () => {
    vi.mocked(getPublicRoom).mockResolvedValue(room());

    const earlier = (await mountView()).findAll("details");

    expect(earlier).toHaveLength(1);
    expect(earlier[0]!.text()).toContain("Ronda 1");
  });

  it("says so when no round is published yet", async () => {
    vi.mocked(getPublicRoom).mockResolvedValue({ ...room(), rounds: [] });

    expect((await mountView()).text()).toContain("Todavía no hay rondas publicadas");
  });

  it("refreshes itself every minute while the tournament is being played", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    vi.mocked(getPublicRoom).mockResolvedValue(room());
    await mountView();

    vi.advanceTimersByTime(60_000);
    await flushPromises();

    expect(getPublicRoom).toHaveBeenCalledTimes(2);
  });

  it("stops refreshing once the tournament is finished", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    vi.mocked(getPublicRoom).mockResolvedValue(room({ status: "FINISHED" }));
    const wrapper = await mountView();

    vi.advanceTimersByTime(120_000);
    await flushPromises();

    expect(getPublicRoom).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain("Torneo terminado");
  });

  it("offers to try again when the room can't be loaded", async () => {
    vi.mocked(getPublicRoom).mockRejectedValue(new Error("offline"));

    expect((await mountView()).text()).toContain("No se pudo cargar la sala");
  });
});
