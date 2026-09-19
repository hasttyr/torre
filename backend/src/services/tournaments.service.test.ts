import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "../middlewares/errorHandler";
import {
  openRegistration,
  closeRegistration,
  configureTournament,
  createTournament,
  enrollPlayer,
  listEnrolledPlayers,
  listMyTournaments,
  listAvailableTournaments,
  listEnrolledTournaments,
  getTournament,
} from "./tournaments.service";

function buildPrismaMock() {
  const mock = {
    torneo: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    ronda: {
      findFirst: vi.fn(),
    },
    jugador: {
      findUnique: vi.fn(),
    },
    inscripcion: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    criterioDesempate: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(mock)),
  };
  return mock;
}

describe("createTournament", () => {
  it("creates a tournament in preliminary state (CREADO) with valid data", async () => {
    const prisma = buildPrismaMock();
    prisma.torneo.create.mockResolvedValue({
      id: "tournament-1",
      nombre: "Copa Universitaria",
      fechaInicio: new Date("2026-10-01"),
      fechaFin: new Date("2026-10-03"),
      estado: "CREADO",
      formato: "suizo",
      numeroRondas: null,
      ritmo: null,
      organizadorId: "org-1",
      createdAt: new Date("2026-09-17"),
      criteriosDesempate: [],
    });

    const tournament = await createTournament(prisma as unknown as PrismaClient, "org-1", {
      name: "Copa Universitaria",
      startDate: new Date("2026-10-01"),
      endDate: new Date("2026-10-03"),
    });

    expect(tournament.status).toBe("CREADO");
    expect(prisma.torneo.create.mock.calls[0][0].data.organizadorId).toBe("org-1");
  });
});

describe("listMyTournaments", () => {
  it("an organizer only sees the tournaments they own", async () => {
    const prisma = buildPrismaMock();
    prisma.torneo.findMany.mockResolvedValue([]);

    await listMyTournaments(prisma as unknown as PrismaClient, "org-1", "ORGANIZADOR");

    expect(prisma.torneo.findMany.mock.calls[0][0].where).toEqual({ organizadorId: "org-1" });
  });

  it("an administrator sees all tournaments", async () => {
    const prisma = buildPrismaMock();
    prisma.torneo.findMany.mockResolvedValue([]);

    await listMyTournaments(prisma as unknown as PrismaClient, "admin-1", "ADMINISTRADOR");

    expect(prisma.torneo.findMany.mock.calls[0][0].where).toEqual({});
  });
});

describe("getTournament", () => {
  it("the owning organizer can see the detail", async () => {
    const prisma = buildPrismaMock();
    prisma.torneo.findUnique.mockResolvedValue({ id: "tournament-1", organizadorId: "org-1", criteriosDesempate: [] });

    const tournament = await getTournament(prisma as unknown as PrismaClient, "tournament-1", "org-1", "ORGANIZADOR");

    expect(tournament.id).toBe("tournament-1");
  });

  it("an administrator can see any tournament", async () => {
    const prisma = buildPrismaMock();
    prisma.torneo.findUnique.mockResolvedValue({ id: "tournament-1", organizadorId: "org-1", criteriosDesempate: [] });

    await expect(
      getTournament(prisma as unknown as PrismaClient, "tournament-1", "admin-1", "ADMINISTRADOR"),
    ).resolves.toMatchObject({ id: "tournament-1" });
  });

  it("rejects (403) a user who is neither the owner nor an administrator", async () => {
    const prisma = buildPrismaMock();
    prisma.torneo.findUnique.mockResolvedValue({ id: "tournament-1", organizadorId: "org-1", criteriosDesempate: [] });

    await expect(
      getTournament(prisma as unknown as PrismaClient, "tournament-1", "jugador-1", "JUGADOR"),
    ).rejects.toMatchObject({ status: 403 } satisfies Partial<HttpError>);
  });

  it("responds 404 when the tournament doesn't exist", async () => {
    const prisma = buildPrismaMock();
    prisma.torneo.findUnique.mockResolvedValue(null);

    await expect(
      getTournament(prisma as unknown as PrismaClient, "tournament-inexistente", "org-1", "ORGANIZADOR"),
    ).rejects.toMatchObject({ status: 404 } satisfies Partial<HttpError>);
  });
});

describe("listEnrolledPlayers", () => {
  it("the owning organizer can see the roster", async () => {
    const prisma = buildPrismaMock();
    prisma.torneo.findUnique.mockResolvedValue({ id: "tournament-1", organizadorId: "org-1" });
    prisma.inscripcion.findMany.mockResolvedValue([]);

    await expect(
      listEnrolledPlayers(prisma as unknown as PrismaClient, "tournament-1", "org-1", "ORGANIZADOR"),
    ).resolves.toEqual([]);
  });

  it("rejects (403) a player unrelated to the tournament", async () => {
    const prisma = buildPrismaMock();
    prisma.torneo.findUnique.mockResolvedValue({ id: "tournament-1", organizadorId: "org-1" });

    await expect(
      listEnrolledPlayers(prisma as unknown as PrismaClient, "tournament-1", "jugador-1", "JUGADOR"),
    ).rejects.toMatchObject({ status: 403 } satisfies Partial<HttpError>);
    expect(prisma.inscripcion.findMany).not.toHaveBeenCalled();
  });
});

describe("listAvailableTournaments", () => {
  it("only returns tournaments with open registration", async () => {
    const prisma = buildPrismaMock();
    prisma.torneo.findMany.mockResolvedValue([]);

    await listAvailableTournaments(prisma as unknown as PrismaClient);

    expect(prisma.torneo.findMany.mock.calls[0][0].where).toEqual({ estado: "INSCRIPCIONES_ABIERTAS" });
  });
});

describe("listEnrolledTournaments", () => {
  it("returns an empty list when the user has no player profile", async () => {
    const prisma = buildPrismaMock();
    prisma.jugador.findUnique.mockResolvedValue(null);

    const tournaments = await listEnrolledTournaments(prisma as unknown as PrismaClient, "usuario-1");

    expect(tournaments).toEqual([]);
    expect(prisma.inscripcion.findMany).not.toHaveBeenCalled();
  });

  it("returns the tournaments where the player is enrolled", async () => {
    const prisma = buildPrismaMock();
    prisma.jugador.findUnique.mockResolvedValue({ id: "jugador-1", usuarioId: "usuario-1" });
    prisma.inscripcion.findMany.mockResolvedValue([
      {
        id: "insc-1",
        createdAt: new Date("2026-09-17"),
        torneo: {
          id: "tournament-1",
          nombre: "Copa Universitaria",
          fechaInicio: new Date("2026-10-01"),
          fechaFin: new Date("2026-10-03"),
          estado: "INSCRIPCIONES_ABIERTAS",
          formato: "suizo",
          numeroRondas: null,
          ritmo: null,
          organizadorId: "org-1",
          createdAt: new Date("2026-09-15"),
          criteriosDesempate: [],
        },
      },
    ]);

    const tournaments = await listEnrolledTournaments(prisma as unknown as PrismaClient, "usuario-1");

    expect(prisma.inscripcion.findMany.mock.calls[0][0].where).toEqual({ jugadorId: "jugador-1" });
    expect(tournaments).toEqual([
      expect.objectContaining({ id: "tournament-1", name: "Copa Universitaria" }),
    ]);
  });
});

describe("configureTournament", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(() => {
    prisma = buildPrismaMock();
  });

  it("rejects when the user is neither the owning organizer nor an administrator", async () => {
    prisma.torneo.findUnique.mockResolvedValue({ id: "tournament-1", organizadorId: "org-1" });

    await expect(
      configureTournament(prisma as unknown as PrismaClient, "tournament-1", "otro-usuario", "ORGANIZADOR", {
        roundsCount: 5,
      }),
    ).rejects.toMatchObject({ status: 403 } satisfies Partial<HttpError>);
  });

  it("blocks changes to the tiebreak order once round 1 already exists", async () => {
    prisma.torneo.findUnique.mockResolvedValue({ id: "tournament-1", organizadorId: "org-1" });
    prisma.ronda.findFirst.mockResolvedValue({ id: "ronda-1", numero: 1 });

    await expect(
      configureTournament(prisma as unknown as PrismaClient, "tournament-1", "org-1", "ORGANIZADOR", {
        tiebreakCriteria: [{ name: "Buchholz", order: 1 }],
      }),
    ).rejects.toMatchObject({ status: 409 } satisfies Partial<HttpError>);

    expect(prisma.criterioDesempate.deleteMany).not.toHaveBeenCalled();
  });

  it("saves the configuration when round 1 doesn't exist yet", async () => {
    prisma.torneo.findUnique.mockResolvedValue({ id: "tournament-1", organizadorId: "org-1" });
    prisma.ronda.findFirst.mockResolvedValue(null);
    prisma.torneo.update.mockResolvedValue({
      id: "tournament-1",
      nombre: "Copa",
      fechaInicio: new Date(),
      fechaFin: new Date(),
      estado: "CREADO",
      formato: "suizo",
      numeroRondas: 7,
      ritmo: "90+30",
      organizadorId: "org-1",
      createdAt: new Date(),
      criteriosDesempate: [{ id: "c1", torneoId: "tournament-1", nombre: "Buchholz", orden: 1 }],
    });

    const tournament = await configureTournament(prisma as unknown as PrismaClient, "tournament-1", "org-1", "ORGANIZADOR", {
      roundsCount: 7,
      timeControl: "90+30",
      tiebreakCriteria: [{ name: "Buchholz", order: 1 }],
    });

    expect(prisma.criterioDesempate.deleteMany).toHaveBeenCalledWith({ where: { torneoId: "tournament-1" } });
    expect(tournament.roundsCount).toBe(7);
    expect(tournament.tiebreakCriteria).toEqual([{ name: "Buchholz", order: 1 }]);
  });

  it("an administrator can configure a tournament even without being the owning organizer", async () => {
    prisma.torneo.findUnique.mockResolvedValue({ id: "tournament-1", organizadorId: "org-1" });
    prisma.torneo.update.mockResolvedValue({
      id: "tournament-1",
      nombre: "Copa",
      fechaInicio: new Date(),
      fechaFin: new Date(),
      estado: "CREADO",
      formato: "suizo",
      numeroRondas: 3,
      ritmo: null,
      organizadorId: "org-1",
      createdAt: new Date(),
      criteriosDesempate: [],
    });

    await expect(
      configureTournament(prisma as unknown as PrismaClient, "tournament-1", "admin-1", "ADMINISTRADOR", {
        roundsCount: 3,
      }),
    ).resolves.toMatchObject({ roundsCount: 3 });
  });
});

describe("openRegistration / closeRegistration", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(() => {
    prisma = buildPrismaMock();
  });

  it("opens registration from CREADO", async () => {
    prisma.torneo.findUnique.mockResolvedValue({ id: "tournament-1", organizadorId: "org-1", estado: "CREADO" });
    prisma.torneo.update.mockResolvedValue({
      id: "tournament-1",
      nombre: "Copa",
      fechaInicio: new Date(),
      fechaFin: new Date(),
      estado: "INSCRIPCIONES_ABIERTAS",
      formato: "suizo",
      numeroRondas: null,
      ritmo: null,
      organizadorId: "org-1",
      createdAt: new Date(),
      criteriosDesempate: [],
    });

    const tournament = await openRegistration(prisma as unknown as PrismaClient, "tournament-1", "org-1", "ORGANIZADOR");

    expect(tournament.status).toBe("INSCRIPCIONES_ABIERTAS");
  });

  it("rejects opening registration when the tournament is not in CREADO", async () => {
    prisma.torneo.findUnique.mockResolvedValue({
      id: "tournament-1",
      organizadorId: "org-1",
      estado: "INSCRIPCIONES_CERRADAS",
    });

    await expect(
      openRegistration(prisma as unknown as PrismaClient, "tournament-1", "org-1", "ORGANIZADOR"),
    ).rejects.toMatchObject({ status: 409 } satisfies Partial<HttpError>);
  });

  it("closes registration from INSCRIPCIONES_ABIERTAS", async () => {
    prisma.torneo.findUnique.mockResolvedValue({
      id: "tournament-1",
      organizadorId: "org-1",
      estado: "INSCRIPCIONES_ABIERTAS",
    });
    prisma.torneo.update.mockResolvedValue({
      id: "tournament-1",
      nombre: "Copa",
      fechaInicio: new Date(),
      fechaFin: new Date(),
      estado: "INSCRIPCIONES_CERRADAS",
      formato: "suizo",
      numeroRondas: null,
      ritmo: null,
      organizadorId: "org-1",
      createdAt: new Date(),
      criteriosDesempate: [],
    });

    const tournament = await closeRegistration(prisma as unknown as PrismaClient, "tournament-1", "org-1", "ORGANIZADOR");

    expect(tournament.status).toBe("INSCRIPCIONES_CERRADAS");
  });

  it("rejects closing registration when it was never opened", async () => {
    prisma.torneo.findUnique.mockResolvedValue({ id: "tournament-1", organizadorId: "org-1", estado: "CREADO" });

    await expect(
      closeRegistration(prisma as unknown as PrismaClient, "tournament-1", "org-1", "ORGANIZADOR"),
    ).rejects.toMatchObject({ status: 409 } satisfies Partial<HttpError>);
  });
});

describe("enrollPlayer", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(() => {
    prisma = buildPrismaMock();
  });

  it("enrolls a player when registration is open", async () => {
    prisma.torneo.findUnique.mockResolvedValue({
      id: "tournament-1",
      organizadorId: "org-1",
      estado: "INSCRIPCIONES_ABIERTAS",
    });
    prisma.jugador.findUnique.mockResolvedValue({
      id: "jugador-1",
      codigoUniversitario: "U1",
      programa: "Sistemas",
      semestre: 5,
      usuario: { nombre: "Luis Gómez" },
    });
    prisma.inscripcion.create.mockResolvedValue({ id: "insc-1", createdAt: new Date("2026-09-17") });

    const result = await enrollPlayer(
      prisma as unknown as PrismaClient,
      "tournament-1",
      "jugador-1",
      "org-1",
      "ORGANIZADOR",
    );

    expect(result).toMatchObject({ playerId: "jugador-1", name: "Luis Gómez" });
  });

  it("rejects enrolling when the tournament doesn't have registration open", async () => {
    prisma.torneo.findUnique.mockResolvedValue({
      id: "tournament-1",
      organizadorId: "org-1",
      estado: "INSCRIPCIONES_CERRADAS",
    });

    await expect(
      enrollPlayer(prisma as unknown as PrismaClient, "tournament-1", "jugador-1", "org-1", "ORGANIZADOR"),
    ).rejects.toMatchObject({ status: 409 } satisfies Partial<HttpError>);

    expect(prisma.inscripcion.create).not.toHaveBeenCalled();
  });

  it("rejects (RN-01) a duplicate enrollment attempt in the same tournament", async () => {
    prisma.torneo.findUnique.mockResolvedValue({
      id: "tournament-1",
      organizadorId: "org-1",
      estado: "INSCRIPCIONES_ABIERTAS",
    });
    prisma.jugador.findUnique.mockResolvedValue({
      id: "jugador-1",
      codigoUniversitario: "U1",
      programa: "Sistemas",
      semestre: 5,
      usuario: { nombre: "Luis Gómez" },
    });
    prisma.inscripcion.create.mockRejectedValue({ code: "P2002" });

    await expect(
      enrollPlayer(prisma as unknown as PrismaClient, "tournament-1", "jugador-1", "org-1", "ORGANIZADOR"),
    ).rejects.toMatchObject({ status: 409, message: "El jugador ya está inscrito en este torneo" } satisfies Partial<HttpError>);
  });

  it("responds 404 when the player doesn't exist", async () => {
    prisma.torneo.findUnique.mockResolvedValue({
      id: "tournament-1",
      organizadorId: "org-1",
      estado: "INSCRIPCIONES_ABIERTAS",
    });
    prisma.jugador.findUnique.mockResolvedValue(null);

    await expect(
      enrollPlayer(prisma as unknown as PrismaClient, "tournament-1", "jugador-inexistente", "org-1", "ORGANIZADOR"),
    ).rejects.toMatchObject({ status: 404 } satisfies Partial<HttpError>);
  });

  it("rejects (409) a player from another program when the tournament has restrictedProgram", async () => {
    prisma.torneo.findUnique.mockResolvedValue({
      id: "tournament-1",
      organizadorId: "org-1",
      estado: "INSCRIPCIONES_ABIERTAS",
      programaRestringido: "Ingeniería de Sistemas",
      semestreMinimo: null,
    });
    prisma.jugador.findUnique.mockResolvedValue({
      id: "jugador-1",
      codigoUniversitario: "U1",
      programa: "Ingeniería Industrial",
      semestre: 5,
      usuario: { nombre: "Luis Gómez" },
    });

    await expect(
      enrollPlayer(prisma as unknown as PrismaClient, "tournament-1", "jugador-1", "org-1", "ORGANIZADOR"),
    ).rejects.toMatchObject({ status: 409 } satisfies Partial<HttpError>);
    expect(prisma.inscripcion.create).not.toHaveBeenCalled();
  });

  it("rejects (409) a player below the configured minimumSemester", async () => {
    prisma.torneo.findUnique.mockResolvedValue({
      id: "tournament-1",
      organizadorId: "org-1",
      estado: "INSCRIPCIONES_ABIERTAS",
      programaRestringido: null,
      semestreMinimo: 5,
    });
    prisma.jugador.findUnique.mockResolvedValue({
      id: "jugador-1",
      codigoUniversitario: "U1",
      programa: "Sistemas",
      semestre: 3,
      usuario: { nombre: "Luis Gómez" },
    });

    await expect(
      enrollPlayer(prisma as unknown as PrismaClient, "tournament-1", "jugador-1", "org-1", "ORGANIZADOR"),
    ).rejects.toMatchObject({ status: 409 } satisfies Partial<HttpError>);
  });

  it("allows enrolling when the player meets the required program and minimum semester", async () => {
    prisma.torneo.findUnique.mockResolvedValue({
      id: "tournament-1",
      organizadorId: "org-1",
      estado: "INSCRIPCIONES_ABIERTAS",
      programaRestringido: "Sistemas",
      semestreMinimo: 5,
    });
    prisma.jugador.findUnique.mockResolvedValue({
      id: "jugador-1",
      codigoUniversitario: "U1",
      programa: "Sistemas",
      semestre: 5,
      usuario: { nombre: "Luis Gómez" },
    });
    prisma.inscripcion.create.mockResolvedValue({ id: "insc-1", createdAt: new Date("2026-09-19") });

    await expect(
      enrollPlayer(prisma as unknown as PrismaClient, "tournament-1", "jugador-1", "org-1", "ORGANIZADOR"),
    ).resolves.toMatchObject({ playerId: "jugador-1" });
  });
});

describe("configureTournament — eligibility restrictions", () => {
  it("persists programaRestringido and semestreMinimo", async () => {
    const prisma = buildPrismaMock();
    prisma.torneo.findUnique.mockResolvedValue({ id: "tournament-1", organizadorId: "org-1" });
    prisma.torneo.update.mockResolvedValue({
      id: "tournament-1",
      nombre: "Copa",
      fechaInicio: new Date(),
      fechaFin: new Date(),
      estado: "CREADO",
      formato: "suizo",
      numeroRondas: null,
      ritmo: null,
      programaRestringido: "Sistemas",
      semestreMinimo: 5,
      organizadorId: "org-1",
      createdAt: new Date(),
      criteriosDesempate: [],
    });

    const tournament = await configureTournament(prisma as unknown as PrismaClient, "tournament-1", "org-1", "ORGANIZADOR", {
      restrictedProgram: "Sistemas",
      minimumSemester: 5,
    });

    expect(prisma.torneo.update.mock.calls[0][0].data).toMatchObject({
      programaRestringido: "Sistemas",
      semestreMinimo: 5,
    });
    expect(tournament.restrictedProgram).toBe("Sistemas");
    expect(tournament.minimumSemester).toBe(5);
  });

  it("allows clearing a restriction by sending an explicit null", async () => {
    const prisma = buildPrismaMock();
    prisma.torneo.findUnique.mockResolvedValue({ id: "tournament-1", organizadorId: "org-1" });
    prisma.torneo.update.mockResolvedValue({
      id: "tournament-1",
      nombre: "Copa",
      fechaInicio: new Date(),
      fechaFin: new Date(),
      estado: "CREADO",
      formato: "suizo",
      numeroRondas: null,
      ritmo: null,
      programaRestringido: null,
      semestreMinimo: null,
      organizadorId: "org-1",
      createdAt: new Date(),
      criteriosDesempate: [],
    });

    await configureTournament(prisma as unknown as PrismaClient, "tournament-1", "org-1", "ORGANIZADOR", {
      restrictedProgram: null,
    });

    expect(prisma.torneo.update.mock.calls[0][0].data).toMatchObject({ programaRestringido: null });
  });
});
