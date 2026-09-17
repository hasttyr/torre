import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "../middlewares/errorHandler";
import {
  abrirInscripciones,
  cerrarInscripciones,
  configurarTorneo,
  crearTorneo,
  inscribirJugador,
  listarMisTorneos,
} from "./torneos.service";

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
    },
    criterioDesempate: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(mock)),
  };
  return mock;
}

describe("crearTorneo", () => {
  it("crea un torneo en estado preliminar (CREADO) con datos válidos", async () => {
    const prisma = buildPrismaMock();
    prisma.torneo.create.mockResolvedValue({
      id: "torneo-1",
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

    const torneo = await crearTorneo(prisma as unknown as PrismaClient, "org-1", {
      nombre: "Copa Universitaria",
      fechaInicio: new Date("2026-10-01"),
      fechaFin: new Date("2026-10-03"),
    });

    expect(torneo.estado).toBe("CREADO");
    expect(prisma.torneo.create.mock.calls[0][0].data.organizadorId).toBe("org-1");
  });
});

describe("listarMisTorneos", () => {
  it("un organizador solo ve los torneos que le pertenecen", async () => {
    const prisma = buildPrismaMock();
    prisma.torneo.findMany.mockResolvedValue([]);

    await listarMisTorneos(prisma as unknown as PrismaClient, "org-1", "ORGANIZADOR");

    expect(prisma.torneo.findMany.mock.calls[0][0].where).toEqual({ organizadorId: "org-1" });
  });

  it("un administrador ve todos los torneos", async () => {
    const prisma = buildPrismaMock();
    prisma.torneo.findMany.mockResolvedValue([]);

    await listarMisTorneos(prisma as unknown as PrismaClient, "admin-1", "ADMINISTRADOR");

    expect(prisma.torneo.findMany.mock.calls[0][0].where).toEqual({});
  });
});

describe("configurarTorneo", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(() => {
    prisma = buildPrismaMock();
  });

  it("rechaza cuando el usuario no es el organizador dueño ni administrador", async () => {
    prisma.torneo.findUnique.mockResolvedValue({ id: "torneo-1", organizadorId: "org-1" });

    await expect(
      configurarTorneo(prisma as unknown as PrismaClient, "torneo-1", "otro-usuario", "ORGANIZADOR", {
        numeroRondas: 5,
      }),
    ).rejects.toMatchObject({ status: 403 } satisfies Partial<HttpError>);
  });

  it("bloquea cambios en el orden de desempates si ya existe la ronda 1", async () => {
    prisma.torneo.findUnique.mockResolvedValue({ id: "torneo-1", organizadorId: "org-1" });
    prisma.ronda.findFirst.mockResolvedValue({ id: "ronda-1", numero: 1 });

    await expect(
      configurarTorneo(prisma as unknown as PrismaClient, "torneo-1", "org-1", "ORGANIZADOR", {
        criteriosDesempate: [{ nombre: "Buchholz", orden: 1 }],
      }),
    ).rejects.toMatchObject({ status: 409 } satisfies Partial<HttpError>);

    expect(prisma.criterioDesempate.deleteMany).not.toHaveBeenCalled();
  });

  it("guarda la configuración cuando no existe todavía la ronda 1", async () => {
    prisma.torneo.findUnique.mockResolvedValue({ id: "torneo-1", organizadorId: "org-1" });
    prisma.ronda.findFirst.mockResolvedValue(null);
    prisma.torneo.update.mockResolvedValue({
      id: "torneo-1",
      nombre: "Copa",
      fechaInicio: new Date(),
      fechaFin: new Date(),
      estado: "CREADO",
      formato: "suizo",
      numeroRondas: 7,
      ritmo: "90+30",
      organizadorId: "org-1",
      createdAt: new Date(),
      criteriosDesempate: [{ id: "c1", torneoId: "torneo-1", nombre: "Buchholz", orden: 1 }],
    });

    const torneo = await configurarTorneo(prisma as unknown as PrismaClient, "torneo-1", "org-1", "ORGANIZADOR", {
      numeroRondas: 7,
      ritmo: "90+30",
      criteriosDesempate: [{ nombre: "Buchholz", orden: 1 }],
    });

    expect(prisma.criterioDesempate.deleteMany).toHaveBeenCalledWith({ where: { torneoId: "torneo-1" } });
    expect(torneo.numeroRondas).toBe(7);
    expect(torneo.criteriosDesempate).toEqual([{ nombre: "Buchholz", orden: 1 }]);
  });

  it("un administrador puede configurar un torneo aunque no sea el organizador dueño", async () => {
    prisma.torneo.findUnique.mockResolvedValue({ id: "torneo-1", organizadorId: "org-1" });
    prisma.torneo.update.mockResolvedValue({
      id: "torneo-1",
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
      configurarTorneo(prisma as unknown as PrismaClient, "torneo-1", "admin-1", "ADMINISTRADOR", {
        numeroRondas: 3,
      }),
    ).resolves.toMatchObject({ numeroRondas: 3 });
  });
});

describe("abrirInscripciones / cerrarInscripciones", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(() => {
    prisma = buildPrismaMock();
  });

  it("abre inscripciones desde CREADO", async () => {
    prisma.torneo.findUnique.mockResolvedValue({ id: "torneo-1", organizadorId: "org-1", estado: "CREADO" });
    prisma.torneo.update.mockResolvedValue({
      id: "torneo-1",
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

    const torneo = await abrirInscripciones(prisma as unknown as PrismaClient, "torneo-1", "org-1", "ORGANIZADOR");

    expect(torneo.estado).toBe("INSCRIPCIONES_ABIERTAS");
  });

  it("rechaza abrir inscripciones si el torneo no está en CREADO", async () => {
    prisma.torneo.findUnique.mockResolvedValue({
      id: "torneo-1",
      organizadorId: "org-1",
      estado: "INSCRIPCIONES_CERRADAS",
    });

    await expect(
      abrirInscripciones(prisma as unknown as PrismaClient, "torneo-1", "org-1", "ORGANIZADOR"),
    ).rejects.toMatchObject({ status: 409 } satisfies Partial<HttpError>);
  });

  it("cierra inscripciones desde INSCRIPCIONES_ABIERTAS", async () => {
    prisma.torneo.findUnique.mockResolvedValue({
      id: "torneo-1",
      organizadorId: "org-1",
      estado: "INSCRIPCIONES_ABIERTAS",
    });
    prisma.torneo.update.mockResolvedValue({
      id: "torneo-1",
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

    const torneo = await cerrarInscripciones(prisma as unknown as PrismaClient, "torneo-1", "org-1", "ORGANIZADOR");

    expect(torneo.estado).toBe("INSCRIPCIONES_CERRADAS");
  });

  it("rechaza cerrar inscripciones si nunca estuvieron abiertas", async () => {
    prisma.torneo.findUnique.mockResolvedValue({ id: "torneo-1", organizadorId: "org-1", estado: "CREADO" });

    await expect(
      cerrarInscripciones(prisma as unknown as PrismaClient, "torneo-1", "org-1", "ORGANIZADOR"),
    ).rejects.toMatchObject({ status: 409 } satisfies Partial<HttpError>);
  });
});

describe("inscribirJugador", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(() => {
    prisma = buildPrismaMock();
  });

  it("inscribe un jugador cuando las inscripciones están abiertas", async () => {
    prisma.torneo.findUnique.mockResolvedValue({
      id: "torneo-1",
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

    const resultado = await inscribirJugador(
      prisma as unknown as PrismaClient,
      "torneo-1",
      "jugador-1",
      "org-1",
      "ORGANIZADOR",
    );

    expect(resultado).toMatchObject({ jugadorId: "jugador-1", nombre: "Luis Gómez" });
  });

  it("rechaza inscribir si el torneo no tiene inscripciones abiertas", async () => {
    prisma.torneo.findUnique.mockResolvedValue({
      id: "torneo-1",
      organizadorId: "org-1",
      estado: "INSCRIPCIONES_CERRADAS",
    });

    await expect(
      inscribirJugador(prisma as unknown as PrismaClient, "torneo-1", "jugador-1", "org-1", "ORGANIZADOR"),
    ).rejects.toMatchObject({ status: 409 } satisfies Partial<HttpError>);

    expect(prisma.inscripcion.create).not.toHaveBeenCalled();
  });

  it("rechaza (RN-01) un intento de inscripción duplicada en el mismo torneo", async () => {
    prisma.torneo.findUnique.mockResolvedValue({
      id: "torneo-1",
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
      inscribirJugador(prisma as unknown as PrismaClient, "torneo-1", "jugador-1", "org-1", "ORGANIZADOR"),
    ).rejects.toMatchObject({ status: 409, message: "El jugador ya está inscrito en este torneo" } satisfies Partial<HttpError>);
  });

  it("responde 404 si el jugador no existe", async () => {
    prisma.torneo.findUnique.mockResolvedValue({
      id: "torneo-1",
      organizadorId: "org-1",
      estado: "INSCRIPCIONES_ABIERTAS",
    });
    prisma.jugador.findUnique.mockResolvedValue(null);

    await expect(
      inscribirJugador(prisma as unknown as PrismaClient, "torneo-1", "jugador-inexistente", "org-1", "ORGANIZADOR"),
    ).rejects.toMatchObject({ status: 404 } satisfies Partial<HttpError>);
  });
});
