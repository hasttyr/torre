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
  it("crea un torneo en estado preliminar (CREADO) con datos válidos", async () => {
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
      nombre: "Copa Universitaria",
      fechaInicio: new Date("2026-10-01"),
      fechaFin: new Date("2026-10-03"),
    });

    expect(tournament.estado).toBe("CREADO");
    expect(prisma.torneo.create.mock.calls[0][0].data.organizadorId).toBe("org-1");
  });
});

describe("listMyTournaments", () => {
  it("un organizador solo ve los torneos que le pertenecen", async () => {
    const prisma = buildPrismaMock();
    prisma.torneo.findMany.mockResolvedValue([]);

    await listMyTournaments(prisma as unknown as PrismaClient, "org-1", "ORGANIZADOR");

    expect(prisma.torneo.findMany.mock.calls[0][0].where).toEqual({ organizadorId: "org-1" });
  });

  it("un administrador ve todos los torneos", async () => {
    const prisma = buildPrismaMock();
    prisma.torneo.findMany.mockResolvedValue([]);

    await listMyTournaments(prisma as unknown as PrismaClient, "admin-1", "ADMINISTRADOR");

    expect(prisma.torneo.findMany.mock.calls[0][0].where).toEqual({});
  });
});

describe("getTournament", () => {
  it("el organizador dueño puede ver el detalle", async () => {
    const prisma = buildPrismaMock();
    prisma.torneo.findUnique.mockResolvedValue({ id: "tournament-1", organizadorId: "org-1", criteriosDesempate: [] });

    const tournament = await getTournament(prisma as unknown as PrismaClient, "tournament-1", "org-1", "ORGANIZADOR");

    expect(tournament.id).toBe("tournament-1");
  });

  it("un administrador puede ver cualquier torneo", async () => {
    const prisma = buildPrismaMock();
    prisma.torneo.findUnique.mockResolvedValue({ id: "tournament-1", organizadorId: "org-1", criteriosDesempate: [] });

    await expect(
      getTournament(prisma as unknown as PrismaClient, "tournament-1", "admin-1", "ADMINISTRADOR"),
    ).resolves.toMatchObject({ id: "tournament-1" });
  });

  it("rechaza (403) a un usuario que no es el dueño ni administrador", async () => {
    const prisma = buildPrismaMock();
    prisma.torneo.findUnique.mockResolvedValue({ id: "tournament-1", organizadorId: "org-1", criteriosDesempate: [] });

    await expect(
      getTournament(prisma as unknown as PrismaClient, "tournament-1", "jugador-1", "JUGADOR"),
    ).rejects.toMatchObject({ status: 403 } satisfies Partial<HttpError>);
  });

  it("responde 404 si el torneo no existe", async () => {
    const prisma = buildPrismaMock();
    prisma.torneo.findUnique.mockResolvedValue(null);

    await expect(
      getTournament(prisma as unknown as PrismaClient, "tournament-inexistente", "org-1", "ORGANIZADOR"),
    ).rejects.toMatchObject({ status: 404 } satisfies Partial<HttpError>);
  });
});

describe("listEnrolledPlayers", () => {
  it("el organizador dueño puede ver el roster", async () => {
    const prisma = buildPrismaMock();
    prisma.torneo.findUnique.mockResolvedValue({ id: "tournament-1", organizadorId: "org-1" });
    prisma.inscripcion.findMany.mockResolvedValue([]);

    await expect(
      listEnrolledPlayers(prisma as unknown as PrismaClient, "tournament-1", "org-1", "ORGANIZADOR"),
    ).resolves.toEqual([]);
  });

  it("rechaza (403) a un jugador ajeno al torneo", async () => {
    const prisma = buildPrismaMock();
    prisma.torneo.findUnique.mockResolvedValue({ id: "tournament-1", organizadorId: "org-1" });

    await expect(
      listEnrolledPlayers(prisma as unknown as PrismaClient, "tournament-1", "jugador-1", "JUGADOR"),
    ).rejects.toMatchObject({ status: 403 } satisfies Partial<HttpError>);
    expect(prisma.inscripcion.findMany).not.toHaveBeenCalled();
  });
});

describe("listAvailableTournaments", () => {
  it("solo devuelve torneos con inscripciones abiertas", async () => {
    const prisma = buildPrismaMock();
    prisma.torneo.findMany.mockResolvedValue([]);

    await listAvailableTournaments(prisma as unknown as PrismaClient);

    expect(prisma.torneo.findMany.mock.calls[0][0].where).toEqual({ estado: "INSCRIPCIONES_ABIERTAS" });
  });
});

describe("listEnrolledTournaments", () => {
  it("devuelve lista vacía si el usuario no tiene perfil de jugador", async () => {
    const prisma = buildPrismaMock();
    prisma.jugador.findUnique.mockResolvedValue(null);

    const tournaments = await listEnrolledTournaments(prisma as unknown as PrismaClient, "usuario-1");

    expect(tournaments).toEqual([]);
    expect(prisma.inscripcion.findMany).not.toHaveBeenCalled();
  });

  it("devuelve los torneos donde el jugador está inscrito", async () => {
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
      expect.objectContaining({ id: "tournament-1", nombre: "Copa Universitaria" }),
    ]);
  });
});

describe("configureTournament", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(() => {
    prisma = buildPrismaMock();
  });

  it("rechaza cuando el usuario no es el organizador dueño ni administrador", async () => {
    prisma.torneo.findUnique.mockResolvedValue({ id: "tournament-1", organizadorId: "org-1" });

    await expect(
      configureTournament(prisma as unknown as PrismaClient, "tournament-1", "otro-usuario", "ORGANIZADOR", {
        numeroRondas: 5,
      }),
    ).rejects.toMatchObject({ status: 403 } satisfies Partial<HttpError>);
  });

  it("bloquea cambios en el orden de desempates si ya existe la ronda 1", async () => {
    prisma.torneo.findUnique.mockResolvedValue({ id: "tournament-1", organizadorId: "org-1" });
    prisma.ronda.findFirst.mockResolvedValue({ id: "ronda-1", numero: 1 });

    await expect(
      configureTournament(prisma as unknown as PrismaClient, "tournament-1", "org-1", "ORGANIZADOR", {
        criteriosDesempate: [{ nombre: "Buchholz", orden: 1 }],
      }),
    ).rejects.toMatchObject({ status: 409 } satisfies Partial<HttpError>);

    expect(prisma.criterioDesempate.deleteMany).not.toHaveBeenCalled();
  });

  it("guarda la configuración cuando no existe todavía la ronda 1", async () => {
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
      numeroRondas: 7,
      ritmo: "90+30",
      criteriosDesempate: [{ nombre: "Buchholz", orden: 1 }],
    });

    expect(prisma.criterioDesempate.deleteMany).toHaveBeenCalledWith({ where: { torneoId: "tournament-1" } });
    expect(tournament.numeroRondas).toBe(7);
    expect(tournament.criteriosDesempate).toEqual([{ nombre: "Buchholz", orden: 1 }]);
  });

  it("un administrador puede configurar un torneo aunque no sea el organizador dueño", async () => {
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
        numeroRondas: 3,
      }),
    ).resolves.toMatchObject({ numeroRondas: 3 });
  });
});

describe("openRegistration / closeRegistration", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(() => {
    prisma = buildPrismaMock();
  });

  it("abre inscripciones desde CREADO", async () => {
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

    expect(tournament.estado).toBe("INSCRIPCIONES_ABIERTAS");
  });

  it("rechaza abrir inscripciones si el torneo no está en CREADO", async () => {
    prisma.torneo.findUnique.mockResolvedValue({
      id: "tournament-1",
      organizadorId: "org-1",
      estado: "INSCRIPCIONES_CERRADAS",
    });

    await expect(
      openRegistration(prisma as unknown as PrismaClient, "tournament-1", "org-1", "ORGANIZADOR"),
    ).rejects.toMatchObject({ status: 409 } satisfies Partial<HttpError>);
  });

  it("cierra inscripciones desde INSCRIPCIONES_ABIERTAS", async () => {
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

    expect(tournament.estado).toBe("INSCRIPCIONES_CERRADAS");
  });

  it("rechaza cerrar inscripciones si nunca estuvieron abiertas", async () => {
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

  it("inscribe un jugador cuando las inscripciones están abiertas", async () => {
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

    expect(result).toMatchObject({ jugadorId: "jugador-1", nombre: "Luis Gómez" });
  });

  it("rechaza inscribir si el torneo no tiene inscripciones abiertas", async () => {
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

  it("rechaza (RN-01) un intento de inscripción duplicada en el mismo torneo", async () => {
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

  it("responde 404 si el jugador no existe", async () => {
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

  it("rechaza (409) un jugador de otro programa cuando el torneo tiene programaRestringido", async () => {
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

  it("rechaza (409) un jugador por debajo del semestreMinimo configurado", async () => {
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

  it("permite inscribir cuando el jugador cumple programa y semestre mínimo exigidos", async () => {
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
    ).resolves.toMatchObject({ jugadorId: "jugador-1" });
  });
});

describe("configureTournament — restricciones de elegibilidad", () => {
  it("persiste programaRestringido y semestreMinimo", async () => {
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
      programaRestringido: "Sistemas",
      semestreMinimo: 5,
    });

    expect(prisma.torneo.update.mock.calls[0][0].data).toMatchObject({
      programaRestringido: "Sistemas",
      semestreMinimo: 5,
    });
    expect(tournament.programaRestringido).toBe("Sistemas");
    expect(tournament.semestreMinimo).toBe(5);
  });

  it("permite limpiar una restricción enviando null explícito", async () => {
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
      programaRestringido: null,
    });

    expect(prisma.torneo.update.mock.calls[0][0].data).toMatchObject({ programaRestringido: null });
  });
});
