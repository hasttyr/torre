import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import { i18n } from "../i18n";
import PublicTournamentsView from "./PublicTournamentsView.vue";

vi.mock("../services/tournaments", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/tournaments")>()),
  listPublicTournaments: vi.fn(),
}));

import { listPublicTournaments } from "../services/tournaments";

const OPEN = {
  id: "t-1",
  name: "Copa Central de Apertura",
  startDate: "2026-12-01",
  endDate: "2026-12-03",
  status: "REGISTRATION_OPEN" as const,
  format: "swiss",
  roundsCount: 5,
  timeControl: "90+30",
  restrictedProgram: "Ingeniería de Sistemas",
  minimumSemester: 3,
};

async function mountView() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: "/torneos-abiertos", component: PublicTournamentsView },
      { path: "/:any(.*)", component: { template: "<div />" } },
    ],
  });
  router.push("/torneos-abiertos");
  await router.isReady();
  const wrapper = mount(PublicTournamentsView, { global: { plugins: [router, i18n] } });
  await flushPromises();
  return wrapper;
}

// HU25 / RF17: what a visitor sees without signing in.
describe("PublicTournamentsView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("lists the tournaments open for registration, with their rounds, time control and who may join", async () => {
    vi.mocked(listPublicTournaments).mockResolvedValue([OPEN]);

    const card = (await mountView()).get("main li");

    expect(card.text()).toContain("Copa Central de Apertura");
    expect(card.text()).toContain("5 rondas");
    expect(card.text()).toContain("90+30");
    expect(card.text()).toContain("Ingeniería de Sistemas");
    expect(card.text()).toContain("semestre 3");
  });

  it("invites the visitor to sign in or create an account to enroll", async () => {
    vi.mocked(listPublicTournaments).mockResolvedValue([OPEN]);

    const links = (await mountView()).findAll("main a").map((link) => link.attributes("href"));

    expect(links).toEqual(expect.arrayContaining(["/login", "/registro"]));
  });

  it("says so when no tournament is open", async () => {
    vi.mocked(listPublicTournaments).mockResolvedValue([]);

    expect((await mountView()).text()).toContain("No hay torneos con inscripción abierta");
  });

  it("offers to try again when the list can't be loaded", async () => {
    vi.mocked(listPublicTournaments).mockRejectedValue(new Error("offline"));

    expect((await mountView()).text()).toContain("No se pudieron cargar los torneos");
  });
});
