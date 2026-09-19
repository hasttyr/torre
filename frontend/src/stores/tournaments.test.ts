import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/tournaments", () => ({
  createTournament: vi.fn(),
  getTournament: vi.fn(),
  configureTournament: vi.fn(),
  openRegistration: vi.fn(),
  closeRegistration: vi.fn(),
  enrollPlayer: vi.fn(),
  listEnrolledPlayers: vi.fn(),
  listMyTournaments: vi.fn(),
  listAvailableTournaments: vi.fn(),
  listEnrolledTournaments: vi.fn(),
}));

import {
  closeRegistration,
  configureTournament,
  createTournament,
  enrollPlayer,
  listEnrolledPlayers,
  listAvailableTournaments,
  listEnrolledTournaments,
  listMyTournaments,
  openRegistration,
  getTournament,
} from "../services/tournaments";
import { useTournamentsStore } from "./tournaments";

const createTournamentMock = vi.mocked(createTournament);
const getTournamentMock = vi.mocked(getTournament);
const configureTournamentMock = vi.mocked(configureTournament);
const openRegistrationMock = vi.mocked(openRegistration);
const closeRegistrationMock = vi.mocked(closeRegistration);
const enrollPlayerMock = vi.mocked(enrollPlayer);
const listEnrolledPlayersMock = vi.mocked(listEnrolledPlayers);
const listMyTournamentsMock = vi.mocked(listMyTournaments);
const listAvailableTournamentsMock = vi.mocked(listAvailableTournaments);
const listEnrolledTournamentsMock = vi.mocked(listEnrolledTournaments);

const TOURNAMENT = {
  id: "torneo-1",
  name: "Copa Universitaria",
  startDate: "2026-10-01",
  endDate: "2026-10-03",
  status: "CREADO" as const,
  format: "suizo",
  roundsCount: null,
  timeControl: null,
  restrictedProgram: null,
  minimumSemester: null,
  organizerId: "org-1",
  tiebreakCriteria: [],
  createdAt: "2026-09-17T00:00:00.000Z",
};

describe("useTournamentsStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("create stores the returned tournament and resets the player list", async () => {
    createTournamentMock.mockResolvedValue(TOURNAMENT);
    const store = useTournamentsStore();

    const tournament = await store.create({ name: "Copa Universitaria", startDate: "2026-10-01", endDate: "2026-10-03" });

    expect(tournament).toEqual(TOURNAMENT);
    expect(store.current).toEqual(TOURNAMENT);
    expect(store.enrolledPlayers).toEqual([]);
  });

  it("load fetches the tournament and its enrolled players", async () => {
    getTournamentMock.mockResolvedValue(TOURNAMENT);
    listEnrolledPlayersMock.mockResolvedValue([
      { playerId: "j1", name: "Luis", universityCode: "U1", program: "Sistemas", semester: 5, enrolledAt: "2026-09-17" },
    ]);
    const store = useTournamentsStore();

    await store.load("torneo-1");

    expect(store.current).toEqual(TOURNAMENT);
    expect(store.enrolledPlayers).toHaveLength(1);
  });

  it("configure updates the tournament with the backend's response", async () => {
    configureTournamentMock.mockResolvedValue({ ...TOURNAMENT, roundsCount: 7, timeControl: "90+30" });
    const store = useTournamentsStore();

    await store.configure("torneo-1", { roundsCount: 7, timeControl: "90+30" });

    expect(store.current?.roundsCount).toBe(7);
    expect(store.current?.timeControl).toBe("90+30");
  });

  it("openRegistration and closeRegistration reflect the new state", async () => {
    openRegistrationMock.mockResolvedValue({ ...TOURNAMENT, status: "INSCRIPCIONES_ABIERTAS" });
    closeRegistrationMock.mockResolvedValue({ ...TOURNAMENT, status: "INSCRIPCIONES_CERRADAS" });
    const store = useTournamentsStore();

    await store.openRegistration("torneo-1");
    expect(store.current?.status).toBe("INSCRIPCIONES_ABIERTAS");

    await store.closeRegistration("torneo-1");
    expect(store.current?.status).toBe("INSCRIPCIONES_CERRADAS");
  });

  it("enrollPlayer adds the player to the list", async () => {
    enrollPlayerMock.mockResolvedValue({
      playerId: "j1",
      name: "Luis",
      universityCode: "U1",
      program: "Sistemas",
      semester: 5,
      enrolledAt: "2026-09-17",
    });
    const store = useTournamentsStore();

    await store.enrollPlayer("torneo-1", "j1");

    expect(store.enrolledPlayers).toEqual([
      { playerId: "j1", name: "Luis", universityCode: "U1", program: "Sistemas", semester: 5, enrolledAt: "2026-09-17" },
    ]);
  });

  it("loadMyTournaments stores the organizer's listing", async () => {
    listMyTournamentsMock.mockResolvedValue([TOURNAMENT]);
    const store = useTournamentsStore();

    await store.loadMyTournaments();

    expect(store.mine).toEqual([TOURNAMENT]);
  });

  it("loadPlayerTournaments stores available and enrolled tournaments", async () => {
    listAvailableTournamentsMock.mockResolvedValue([TOURNAMENT]);
    listEnrolledTournamentsMock.mockResolvedValue([{ ...TOURNAMENT, id: "torneo-2" }]);
    const store = useTournamentsStore();

    await store.loadPlayerTournaments();

    expect(store.available).toEqual([TOURNAMENT]);
    expect(store.enrolled).toEqual([{ ...TOURNAMENT, id: "torneo-2" }]);
  });
});
