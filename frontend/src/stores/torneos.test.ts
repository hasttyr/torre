import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/torneos", () => ({
  crearTorneo: vi.fn(),
  obtenerTorneo: vi.fn(),
  configurarTorneo: vi.fn(),
  abrirInscripciones: vi.fn(),
  cerrarInscripciones: vi.fn(),
  inscribirJugador: vi.fn(),
  listarJugadoresInscritos: vi.fn(),
  listarMisTorneos: vi.fn(),
  listarTorneosDisponibles: vi.fn(),
  listarTorneosInscrito: vi.fn(),
}));

import {
  abrirInscripciones,
  cerrarInscripciones,
  configurarTorneo,
  crearTorneo,
  inscribirJugador,
  listarJugadoresInscritos,
  listarMisTorneos,
  listarTorneosDisponibles,
  listarTorneosInscrito,
  obtenerTorneo,
} from "../services/torneos";
import { useTorneosStore } from "./torneos";

const crearTorneoMock = vi.mocked(crearTorneo);
const obtenerTorneoMock = vi.mocked(obtenerTorneo);
const configurarTorneoMock = vi.mocked(configurarTorneo);
const abrirInscripcionesMock = vi.mocked(abrirInscripciones);
const cerrarInscripcionesMock = vi.mocked(cerrarInscripciones);
const inscribirJugadorMock = vi.mocked(inscribirJugador);
const listarJugadoresInscritosMock = vi.mocked(listarJugadoresInscritos);
const listarMisTorneosMock = vi.mocked(listarMisTorneos);
const listarTorneosDisponiblesMock = vi.mocked(listarTorneosDisponibles);
const listarTorneosInscritoMock = vi.mocked(listarTorneosInscrito);

const TORNEO = {
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

describe("useTorneosStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("crear guarda el torneo devuelto y reinicia la lista de jugadores", async () => {
    crearTorneoMock.mockResolvedValue(TORNEO);
    const store = useTorneosStore();

    const torneo = await store.crear({ nombre: "Copa Universitaria", fechaInicio: "2026-10-01", fechaFin: "2026-10-03" });

    expect(torneo).toEqual(TORNEO);
    expect(store.actual).toEqual(TORNEO);
    expect(store.jugadoresInscritos).toEqual([]);
  });

  it("cargar trae el torneo y sus jugadores inscritos", async () => {
    obtenerTorneoMock.mockResolvedValue(TORNEO);
    listarJugadoresInscritosMock.mockResolvedValue([
      { jugadorId: "j1", nombre: "Luis", codigoUniversitario: "U1", programa: "Sistemas", semestre: 5, inscritoEn: "2026-09-17" },
    ]);
    const store = useTorneosStore();

    await store.cargar("torneo-1");

    expect(store.actual).toEqual(TORNEO);
    expect(store.jugadoresInscritos).toHaveLength(1);
  });

  it("configurar actualiza el torneo con la respuesta del backend", async () => {
    configurarTorneoMock.mockResolvedValue({ ...TORNEO, numeroRondas: 7, ritmo: "90+30" });
    const store = useTorneosStore();

    await store.configurar("torneo-1", { numeroRondas: 7, ritmo: "90+30" });

    expect(store.actual?.numeroRondas).toBe(7);
    expect(store.actual?.ritmo).toBe("90+30");
  });

  it("abrirInscripciones y cerrarInscripciones reflejan el nuevo estado", async () => {
    abrirInscripcionesMock.mockResolvedValue({ ...TORNEO, estado: "INSCRIPCIONES_ABIERTAS" });
    cerrarInscripcionesMock.mockResolvedValue({ ...TORNEO, estado: "INSCRIPCIONES_CERRADAS" });
    const store = useTorneosStore();

    await store.abrirInscripciones("torneo-1");
    expect(store.actual?.estado).toBe("INSCRIPCIONES_ABIERTAS");

    await store.cerrarInscripciones("torneo-1");
    expect(store.actual?.estado).toBe("INSCRIPCIONES_CERRADAS");
  });

  it("inscribirJugador agrega el jugador a la lista", async () => {
    inscribirJugadorMock.mockResolvedValue({
      jugadorId: "j1",
      nombre: "Luis",
      codigoUniversitario: "U1",
      programa: "Sistemas",
      semestre: 5,
      inscritoEn: "2026-09-17",
    });
    const store = useTorneosStore();

    await store.inscribirJugador("torneo-1", "j1");

    expect(store.jugadoresInscritos).toEqual([
      { jugadorId: "j1", nombre: "Luis", codigoUniversitario: "U1", programa: "Sistemas", semestre: 5, inscritoEn: "2026-09-17" },
    ]);
  });

  it("cargarMisTorneos guarda el listado del organizador", async () => {
    listarMisTorneosMock.mockResolvedValue([TORNEO]);
    const store = useTorneosStore();

    await store.cargarMisTorneos();

    expect(store.mios).toEqual([TORNEO]);
  });

  it("cargarTorneosJugador guarda disponibles e inscritos", async () => {
    listarTorneosDisponiblesMock.mockResolvedValue([TORNEO]);
    listarTorneosInscritoMock.mockResolvedValue([{ ...TORNEO, id: "torneo-2" }]);
    const store = useTorneosStore();

    await store.cargarTorneosJugador();

    expect(store.disponibles).toEqual([TORNEO]);
    expect(store.inscrito).toEqual([{ ...TORNEO, id: "torneo-2" }]);
  });
});
