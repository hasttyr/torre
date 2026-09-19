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
  nombre: "Copa Universitaria",
  fechaInicio: "2026-10-01",
  fechaFin: "2026-10-03",
  estado: "CREADO" as const,
  formato: "suizo",
  numeroRondas: null,
  ritmo: null,
  programaRestringido: null,
  semestreMinimo: null,
  organizadorId: "org-1",
  criteriosDesempate: [],
  createdAt: "2026-09-17T00:00:00.000Z",
};

describe("useTournamentsStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("create guarda el torneo devuelto y reinicia la lista de jugadores", async () => {
    createTournamentMock.mockResolvedValue(TOURNAMENT);
    const store = useTournamentsStore();

    const tournament = await store.create({ nombre: "Copa Universitaria", fechaInicio: "2026-10-01", fechaFin: "2026-10-03" });

    expect(tournament).toEqual(TOURNAMENT);
    expect(store.current).toEqual(TOURNAMENT);
    expect(store.enrolledPlayers).toEqual([]);
  });

  it("load trae el torneo y sus jugadores inscritos", async () => {
    getTournamentMock.mockResolvedValue(TOURNAMENT);
    listEnrolledPlayersMock.mockResolvedValue([
      { jugadorId: "j1", nombre: "Luis", codigoUniversitario: "U1", programa: "Sistemas", semestre: 5, inscritoEn: "2026-09-17" },
    ]);
    const store = useTournamentsStore();

    await store.load("torneo-1");

    expect(store.current).toEqual(TOURNAMENT);
    expect(store.enrolledPlayers).toHaveLength(1);
  });

  it("configure actualiza el torneo con la respuesta del backend", async () => {
    configureTournamentMock.mockResolvedValue({ ...TOURNAMENT, numeroRondas: 7, ritmo: "90+30" });
    const store = useTournamentsStore();

    await store.configure("torneo-1", { numeroRondas: 7, ritmo: "90+30" });

    expect(store.current?.numeroRondas).toBe(7);
    expect(store.current?.ritmo).toBe("90+30");
  });

  it("openRegistration y closeRegistration reflejan el nuevo estado", async () => {
    openRegistrationMock.mockResolvedValue({ ...TOURNAMENT, estado: "INSCRIPCIONES_ABIERTAS" });
    closeRegistrationMock.mockResolvedValue({ ...TOURNAMENT, estado: "INSCRIPCIONES_CERRADAS" });
    const store = useTournamentsStore();

    await store.openRegistration("torneo-1");
    expect(store.current?.estado).toBe("INSCRIPCIONES_ABIERTAS");

    await store.closeRegistration("torneo-1");
    expect(store.current?.estado).toBe("INSCRIPCIONES_CERRADAS");
  });

  it("enrollPlayer agrega el jugador a la lista", async () => {
    enrollPlayerMock.mockResolvedValue({
      jugadorId: "j1",
      nombre: "Luis",
      codigoUniversitario: "U1",
      programa: "Sistemas",
      semestre: 5,
      inscritoEn: "2026-09-17",
    });
    const store = useTournamentsStore();

    await store.enrollPlayer("torneo-1", "j1");

    expect(store.enrolledPlayers).toEqual([
      { jugadorId: "j1", nombre: "Luis", codigoUniversitario: "U1", programa: "Sistemas", semestre: 5, inscritoEn: "2026-09-17" },
    ]);
  });

  it("loadMyTournaments guarda el listado del organizador", async () => {
    listMyTournamentsMock.mockResolvedValue([TOURNAMENT]);
    const store = useTournamentsStore();

    await store.loadMyTournaments();

    expect(store.mine).toEqual([TOURNAMENT]);
  });

  it("loadPlayerTournaments guarda disponibles e inscritos", async () => {
    listAvailableTournamentsMock.mockResolvedValue([TOURNAMENT]);
    listEnrolledTournamentsMock.mockResolvedValue([{ ...TOURNAMENT, id: "torneo-2" }]);
    const store = useTournamentsStore();

    await store.loadPlayerTournaments();

    expect(store.available).toEqual([TOURNAMENT]);
    expect(store.enrolled).toEqual([{ ...TOURNAMENT, id: "torneo-2" }]);
  });
});
