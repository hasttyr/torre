import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import { i18n } from "../../i18n";
import CoachPlayersView from "./CoachPlayersView.vue";

vi.mock("../../services/players", () => ({
  searchPlayers: vi.fn(),
}));

vi.mock("../../services/coaches", () => ({
  linkPlayer: vi.fn(),
  listLinkedPlayers: vi.fn(),
  unlinkPlayer: vi.fn(),
  listCoachTournaments: vi.fn(),
}));

import { listCoachTournaments, listLinkedPlayers } from "../../services/coaches";

const listLinkedPlayersMock = vi.mocked(listLinkedPlayers);
const listCoachTournamentsMock = vi.mocked(listCoachTournaments);

const LINKED_PLAYER = {
  playerId: "player-1",
  name: "Luis Gómez",
  universityCode: "U123",
  program: "Sistemas",
  semester: 5,
  linkedAt: "2026-09-17T00:00:00.000Z",
};

const COACH_TOURNAMENT = {
  id: "tournament-1",
  name: "Copa Universitaria",
  startDate: "2026-10-01",
  endDate: "2026-10-03",
  status: "REGISTRATION_OPEN" as const,
  format: "swiss",
  roundsCount: null,
  timeControl: null,
  restrictedProgram: null,
  minimumSemester: null,
  organizerId: "org-1",
  tiebreakCriteria: [],
  createdAt: "2026-09-17T00:00:00.000Z",
  myPlayers: [{ playerId: "player-1", name: "Luis Gómez" }],
};

async function mountView() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [{ path: "/mis-jugadores", component: CoachPlayersView }],
  });
  router.push("/mis-jugadores");
  await router.isReady();

  const wrapper = mount(CoachPlayersView, { global: { plugins: [router, i18n] } });
  await new Promise((resolve) => setTimeout(resolve, 0));
  await wrapper.vm.$nextTick();
  return { wrapper };
}

describe("CoachPlayersView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("shows empty states when there are no linked players or tournaments", async () => {
    listLinkedPlayersMock.mockResolvedValue([]);
    listCoachTournamentsMock.mockResolvedValue([]);

    const { wrapper } = await mountView();

    expect(wrapper.text()).toContain("Todavía no estás vinculado con ningún jugador");
    expect(wrapper.text()).toContain("Ninguno de tus jugadores vinculados está inscrito en un torneo todavía");
  });

  it("lists the tournaments where the coach's players are enrolled", async () => {
    listLinkedPlayersMock.mockResolvedValue([LINKED_PLAYER]);
    listCoachTournamentsMock.mockResolvedValue([COACH_TOURNAMENT]);

    const { wrapper } = await mountView();

    expect(wrapper.text()).toContain("Copa Universitaria");
    expect(wrapper.text()).toContain("Luis Gómez");
  });

  it("shows an error when loading fails", async () => {
    listLinkedPlayersMock.mockRejectedValue(new Error("network error"));
    listCoachTournamentsMock.mockResolvedValue([]);

    const { wrapper } = await mountView();

    expect(wrapper.text()).toContain("No se pudieron cargar tus jugadores vinculados");
  });
});
