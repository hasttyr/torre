import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../app";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    torneo: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    ronda: { findFirst: vi.fn() },
    jugador: { findUnique: vi.fn() },
    inscripcion: { create: vi.fn(), findMany: vi.fn() },
    criterioDesempate: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prismaMock)),
  },
}));

vi.mock("../config/prisma", () => ({ prisma: prismaMock }));

function tokenPara(rol: string, id = "usuario-1"): string {
  return jwt.sign({ sub: id, rol }, "test-secret", { expiresIn: "1h" });
}

const torneoBase = {
  id: "torneo-1",
  nombre: "Copa Universitaria",
  fechaInicio: new Date("2026-10-01"),
  fechaFin: new Date("2026-10-03"),
  estado: "CREADO",
  formato: "suizo",
  numeroRondas: null,
  ritmo: null,
  organizadorId: "usuario-1",
  createdAt: new Date("2026-09-17"),
  criteriosDesempate: [],
};

describe("GET /api/torneos/mios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devuelve solo los torneos del organizador autenticado", async () => {
    prismaMock.torneo.findMany.mockResolvedValue([torneoBase]);

    const response = await request(createApp())
      .get("/api/torneos/mios")
      .set("Authorization", `Bearer ${tokenPara("ORGANIZADOR", "usuario-1")}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(prismaMock.torneo.findMany.mock.calls[0][0].where).toEqual({ organizadorId: "usuario-1" });
  });

  it("responde 401 sin token", async () => {
    const response = await request(createApp()).get("/api/torneos/mios");
    expect(response.status).toBe(401);
  });
});

describe("GET /api/torneos/disponibles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cualquier usuario autenticado ve los torneos con inscripción abierta", async () => {
    prismaMock.torneo.findMany.mockResolvedValue([{ ...torneoBase, estado: "INSCRIPCIONES_ABIERTAS" }]);

    const response = await request(createApp())
      .get("/api/torneos/disponibles")
      .set("Authorization", `Bearer ${tokenPara("JUGADOR")}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(prismaMock.torneo.findMany.mock.calls[0][0].where).toEqual({ estado: "INSCRIPCIONES_ABIERTAS" });
  });

  it("responde 401 sin token", async () => {
    const response = await request(createApp()).get("/api/torneos/disponibles");
    expect(response.status).toBe(401);
  });
});

describe("GET /api/torneos/inscrito", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devuelve los torneos donde el jugador autenticado está inscrito", async () => {
    prismaMock.jugador.findUnique.mockResolvedValue({ id: "jugador-1", usuarioId: "usuario-1" });
    prismaMock.inscripcion.findMany.mockResolvedValue([{ id: "insc-1", torneo: torneoBase }]);

    const response = await request(createApp())
      .get("/api/torneos/inscrito")
      .set("Authorization", `Bearer ${tokenPara("JUGADOR", "usuario-1")}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].id).toBe("torneo-1");
  });

  it("devuelve lista vacía si el usuario no tiene perfil de jugador", async () => {
    prismaMock.jugador.findUnique.mockResolvedValue(null);

    const response = await request(createApp())
      .get("/api/torneos/inscrito")
      .set("Authorization", `Bearer ${tokenPara("ORGANIZADOR", "usuario-1")}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("responde 401 sin token", async () => {
    const response = await request(createApp()).get("/api/torneos/inscrito");
    expect(response.status).toBe(401);
  });
});

describe("POST /api/torneos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("crea un torneo con datos válidos y responde 201 en estado CREADO", async () => {
    prismaMock.torneo.create.mockResolvedValue(torneoBase);

    const response = await request(createApp())
      .post("/api/torneos")
      .set("Authorization", `Bearer ${tokenPara("ORGANIZADOR")}`)
      .send({ nombre: "Copa Universitaria", fechaInicio: "2026-10-01", fechaFin: "2026-10-03" });

    expect(response.status).toBe(201);
    expect(response.body.estado).toBe("CREADO");
  });

  it("responde 400 con datos incompletos", async () => {
    const response = await request(createApp())
      .post("/api/torneos")
      .set("Authorization", `Bearer ${tokenPara("ORGANIZADOR")}`)
      .send({ nombre: "Copa" });

    expect(response.status).toBe(400);
    expect(prismaMock.torneo.create).not.toHaveBeenCalled();
  });

  it("responde 401 sin token", async () => {
    const response = await request(createApp()).post("/api/torneos").send({ nombre: "Copa" });
    expect(response.status).toBe(401);
  });

  it("responde 403 para un rol sin permiso (JUGADOR)", async () => {
    const response = await request(createApp())
      .post("/api/torneos")
      .set("Authorization", `Bearer ${tokenPara("JUGADOR")}`)
      .send({ nombre: "Copa Universitaria", fechaInicio: "2026-10-01", fechaFin: "2026-10-03" });

    expect(response.status).toBe(403);
  });
});

describe("GET /api/torneos/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("el organizador dueño puede ver el detalle de su torneo", async () => {
    prismaMock.torneo.findUnique.mockResolvedValue(torneoBase);

    const response = await request(createApp())
      .get("/api/torneos/torneo-1")
      .set("Authorization", `Bearer ${tokenPara("ORGANIZADOR", "usuario-1")}`);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe("torneo-1");
  });

  it("un administrador puede ver cualquier torneo aunque no sea el dueño", async () => {
    prismaMock.torneo.findUnique.mockResolvedValue(torneoBase);

    const response = await request(createApp())
      .get("/api/torneos/torneo-1")
      .set("Authorization", `Bearer ${tokenPara("ADMINISTRADOR", "admin-1")}`);

    expect(response.status).toBe(200);
  });

  it("responde 403 para un JUGADOR ajeno al torneo", async () => {
    prismaMock.torneo.findUnique.mockResolvedValue(torneoBase);

    const response = await request(createApp())
      .get("/api/torneos/torneo-1")
      .set("Authorization", `Bearer ${tokenPara("JUGADOR", "jugador-1")}`);

    expect(response.status).toBe(403);
  });

  it("responde 403 para un ORGANIZADOR que no es el dueño del torneo", async () => {
    prismaMock.torneo.findUnique.mockResolvedValue(torneoBase);

    const response = await request(createApp())
      .get("/api/torneos/torneo-1")
      .set("Authorization", `Bearer ${tokenPara("ORGANIZADOR", "otro-organizador")}`);

    expect(response.status).toBe(403);
  });

  it("responde 401 sin token", async () => {
    const response = await request(createApp()).get("/api/torneos/torneo-1");
    expect(response.status).toBe(401);
  });
});

describe("GET /api/torneos/:id/jugadores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("el organizador dueño puede ver el roster de inscritos", async () => {
    prismaMock.torneo.findUnique.mockResolvedValue(torneoBase);
    prismaMock.inscripcion.findMany.mockResolvedValue([]);

    const response = await request(createApp())
      .get("/api/torneos/torneo-1/jugadores")
      .set("Authorization", `Bearer ${tokenPara("ORGANIZADOR", "usuario-1")}`);

    expect(response.status).toBe(200);
  });

  it("responde 403 para un JUGADOR que consulta el roster de un torneo ajeno", async () => {
    prismaMock.torneo.findUnique.mockResolvedValue(torneoBase);

    const response = await request(createApp())
      .get("/api/torneos/torneo-1/jugadores")
      .set("Authorization", `Bearer ${tokenPara("JUGADOR", "jugador-1")}`);

    expect(response.status).toBe(403);
    expect(prismaMock.inscripcion.findMany).not.toHaveBeenCalled();
  });

  it("responde 403 para un ARBITRO (todavía sin acceso hasta HU18)", async () => {
    prismaMock.torneo.findUnique.mockResolvedValue(torneoBase);

    const response = await request(createApp())
      .get("/api/torneos/torneo-1/jugadores")
      .set("Authorization", `Bearer ${tokenPara("ARBITRO", "arbitro-1")}`);

    expect(response.status).toBe(403);
  });

  it("responde 401 sin token", async () => {
    const response = await request(createApp()).get("/api/torneos/torneo-1/jugadores");
    expect(response.status).toBe(401);
  });
});

describe("POST /api/torneos/:id/inscripciones/abrir y /cerrar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("abre inscripciones cuando el torneo está en CREADO", async () => {
    prismaMock.torneo.findUnique.mockResolvedValue({ ...torneoBase, estado: "CREADO" });
    prismaMock.torneo.update.mockResolvedValue({ ...torneoBase, estado: "INSCRIPCIONES_ABIERTAS" });

    const response = await request(createApp())
      .post("/api/torneos/torneo-1/inscripciones/abrir")
      .set("Authorization", `Bearer ${tokenPara("ORGANIZADOR", "usuario-1")}`);

    expect(response.status).toBe(200);
    expect(response.body.estado).toBe("INSCRIPCIONES_ABIERTAS");
  });

  it("responde 409 si se intenta cerrar sin haber abierto antes", async () => {
    prismaMock.torneo.findUnique.mockResolvedValue({ ...torneoBase, estado: "CREADO" });

    const response = await request(createApp())
      .post("/api/torneos/torneo-1/inscripciones/cerrar")
      .set("Authorization", `Bearer ${tokenPara("ORGANIZADOR", "usuario-1")}`);

    expect(response.status).toBe(409);
  });
});

describe("POST /api/torneos/:id/jugadores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inscribe un jugador y responde 201", async () => {
    prismaMock.torneo.findUnique.mockResolvedValue({ ...torneoBase, estado: "INSCRIPCIONES_ABIERTAS" });
    prismaMock.jugador.findUnique.mockResolvedValue({
      id: "jugador-1",
      codigoUniversitario: "U1",
      programa: "Sistemas",
      semestre: 5,
      usuario: { nombre: "Luis Gómez" },
    });
    prismaMock.inscripcion.create.mockResolvedValue({ id: "insc-1", createdAt: new Date("2026-09-17") });

    const response = await request(createApp())
      .post("/api/torneos/torneo-1/jugadores")
      .set("Authorization", `Bearer ${tokenPara("ORGANIZADOR", "usuario-1")}`)
      .send({ jugadorId: "11111111-1111-1111-1111-111111111111" });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ jugadorId: "jugador-1", nombre: "Luis Gómez" });
  });

  it("responde 409 (RN-01) ante un jugador ya inscrito en el mismo torneo", async () => {
    prismaMock.torneo.findUnique.mockResolvedValue({ ...torneoBase, estado: "INSCRIPCIONES_ABIERTAS" });
    prismaMock.jugador.findUnique.mockResolvedValue({
      id: "jugador-1",
      codigoUniversitario: "U1",
      programa: "Sistemas",
      semestre: 5,
      usuario: { nombre: "Luis Gómez" },
    });
    prismaMock.inscripcion.create.mockRejectedValue({ code: "P2002" });

    const response = await request(createApp())
      .post("/api/torneos/torneo-1/jugadores")
      .set("Authorization", `Bearer ${tokenPara("ORGANIZADOR", "usuario-1")}`)
      .send({ jugadorId: "11111111-1111-1111-1111-111111111111" });

    expect(response.status).toBe(409);
  });

  it("responde 409 si las inscripciones no están abiertas", async () => {
    prismaMock.torneo.findUnique.mockResolvedValue({ ...torneoBase, estado: "INSCRIPCIONES_CERRADAS" });

    const response = await request(createApp())
      .post("/api/torneos/torneo-1/jugadores")
      .set("Authorization", `Bearer ${tokenPara("ORGANIZADOR", "usuario-1")}`)
      .send({ jugadorId: "11111111-1111-1111-1111-111111111111" });

    expect(response.status).toBe(409);
    expect(prismaMock.inscripcion.create).not.toHaveBeenCalled();
  });
});
