import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import { i18n } from "../../i18n";
import LiveTournamentsView from "./LiveTournamentsView.vue";

vi.mock("../../services/tournaments", () => ({ listLiveTournaments: vi.fn() }));

import { listLiveTournaments } from "../../services/tournaments";

async function mountView() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [{ path: "/:p(.*)*", component: { template: "<div />" } }],
  });
  const wrapper = mount(LiveTournamentsView, { global: { plugins: [router, i18n] } });
  await flushPromises();
  return wrapper;
}

const TOURNAMENT = {
  id: "t-1",
  name: "Liga Universitaria",
  startDate: "2026-09-19",
  endDate: "2026-09-26",
  status: "IN_PROGRESS" as const,
  format: "swiss",
  roundsCount: 5,
  timeControl: null,
  restrictedProgram: null,
  minimumSemester: null,
  byePoints: 1,
  organizerId: "org-1",
  tiebreakCriteria: [],
  createdAt: "2026-09-01T00:00:00.000Z",
};

describe("LiveTournamentsView (HU18)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("lists tournaments in play, each linking to its room", async () => {
    vi.mocked(listLiveTournaments).mockResolvedValue([TOURNAMENT]);

    const wrapper = await mountView();

    expect(wrapper.text()).toContain("Liga Universitaria");
    expect(wrapper.text()).toContain("En curso");
    expect(wrapper.find("a[href='/torneos/t-1/sala']").exists()).toBe(true);
  });

  it("shows an empty state, and the server's error when loading fails", async () => {
    vi.mocked(listLiveTournaments).mockResolvedValueOnce([]);
    expect((await mountView()).text()).toContain("No hay torneos en curso");

    vi.mocked(listLiveTournaments).mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { error: "Caído" } },
    });
    expect((await mountView()).text()).toContain("Caído");
  });
});
