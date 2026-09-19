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

function tokenFor(rol: string, id = "usuario-1"): string {
  return jwt.sign({ sub: id, rol }, "test-secret", { expiresIn: "1h" });
}

const tournamentBase = {
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

describe("GET /api/tournaments/mine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns only the authenticated organizer's tournaments", async () => {
    prismaMock.torneo.findMany.mockResolvedValue([tournamentBase]);

    const response = await request(createApp())
      .get("/api/tournaments/mine")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZADOR", "usuario-1")}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(prismaMock.torneo.findMany.mock.calls[0][0].where).toEqual({ organizadorId: "usuario-1" });
  });

  it("responds 401 without a token", async () => {
    const response = await request(createApp()).get("/api/tournaments/mine");
    expect(response.status).toBe(401);
  });
});

describe("GET /api/tournaments/available", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("any authenticated user sees tournaments with open registration", async () => {
    prismaMock.torneo.findMany.mockResolvedValue([{ ...tournamentBase, estado: "INSCRIPCIONES_ABIERTAS" }]);

    const response = await request(createApp())
      .get("/api/tournaments/available")
      .set("Authorization", `Bearer ${tokenFor("JUGADOR")}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(prismaMock.torneo.findMany.mock.calls[0][0].where).toEqual({ estado: "INSCRIPCIONES_ABIERTAS" });
  });

  it("responds 401 without a token", async () => {
    const response = await request(createApp()).get("/api/tournaments/available");
    expect(response.status).toBe(401);
  });
});

describe("GET /api/tournaments/enrolled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the tournaments the authenticated player is enrolled in", async () => {
    prismaMock.jugador.findUnique.mockResolvedValue({ id: "jugador-1", usuarioId: "usuario-1" });
    prismaMock.inscripcion.findMany.mockResolvedValue([{ id: "insc-1", torneo: tournamentBase }]);

    const response = await request(createApp())
      .get("/api/tournaments/enrolled")
      .set("Authorization", `Bearer ${tokenFor("JUGADOR", "usuario-1")}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].id).toBe("torneo-1");
  });

  it("returns an empty list when the user has no player profile", async () => {
    prismaMock.jugador.findUnique.mockResolvedValue(null);

    const response = await request(createApp())
      .get("/api/tournaments/enrolled")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZADOR", "usuario-1")}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("responds 401 without a token", async () => {
    const response = await request(createApp()).get("/api/tournaments/enrolled");
    expect(response.status).toBe(401);
  });
});

describe("POST /api/tournaments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a tournament with valid data and responds 201 in CREADO state", async () => {
    prismaMock.torneo.create.mockResolvedValue(tournamentBase);

    const response = await request(createApp())
      .post("/api/tournaments")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZADOR")}`)
      .send({ name: "Copa Universitaria", startDate: "2026-10-01", endDate: "2026-10-03" });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("CREADO");
  });

  it("responds 400 with incomplete data", async () => {
    const response = await request(createApp())
      .post("/api/tournaments")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZADOR")}`)
      .send({ name: "Copa" });

    expect(response.status).toBe(400);
    expect(prismaMock.torneo.create).not.toHaveBeenCalled();
  });

  it("responds 401 without a token", async () => {
    const response = await request(createApp()).post("/api/tournaments").send({ name: "Copa" });
    expect(response.status).toBe(401);
  });

  it("responds 403 for a role without permission (JUGADOR)", async () => {
    const response = await request(createApp())
      .post("/api/tournaments")
      .set("Authorization", `Bearer ${tokenFor("JUGADOR")}`)
      .send({ name: "Copa Universitaria", startDate: "2026-10-01", endDate: "2026-10-03" });

    expect(response.status).toBe(403);
  });
});

describe("GET /api/tournaments/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("the owning organizer can see their tournament's detail", async () => {
    prismaMock.torneo.findUnique.mockResolvedValue(tournamentBase);

    const response = await request(createApp())
      .get("/api/tournaments/torneo-1")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZADOR", "usuario-1")}`);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe("torneo-1");
  });

  it("an administrator can see any tournament even without being the owner", async () => {
    prismaMock.torneo.findUnique.mockResolvedValue(tournamentBase);

    const response = await request(createApp())
      .get("/api/tournaments/torneo-1")
      .set("Authorization", `Bearer ${tokenFor("ADMINISTRADOR", "admin-1")}`);

    expect(response.status).toBe(200);
  });

  it("responds 403 for a JUGADOR unrelated to the tournament", async () => {
    prismaMock.torneo.findUnique.mockResolvedValue(tournamentBase);

    const response = await request(createApp())
      .get("/api/tournaments/torneo-1")
      .set("Authorization", `Bearer ${tokenFor("JUGADOR", "jugador-1")}`);

    expect(response.status).toBe(403);
  });

  it("responds 403 for an ORGANIZADOR who isn't the tournament's owner", async () => {
    prismaMock.torneo.findUnique.mockResolvedValue(tournamentBase);

    const response = await request(createApp())
      .get("/api/tournaments/torneo-1")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZADOR", "otro-organizador")}`);

    expect(response.status).toBe(403);
  });

  it("responds 401 without a token", async () => {
    const response = await request(createApp()).get("/api/tournaments/torneo-1");
    expect(response.status).toBe(401);
  });
});

describe("GET /api/tournaments/:id/players", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("the owning organizer can see the roster of enrolled players", async () => {
    prismaMock.torneo.findUnique.mockResolvedValue(tournamentBase);
    prismaMock.inscripcion.findMany.mockResolvedValue([]);

    const response = await request(createApp())
      .get("/api/tournaments/torneo-1/players")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZADOR", "usuario-1")}`);

    expect(response.status).toBe(200);
  });

  it("responds 403 for a JUGADOR querying the roster of an unrelated tournament", async () => {
    prismaMock.torneo.findUnique.mockResolvedValue(tournamentBase);

    const response = await request(createApp())
      .get("/api/tournaments/torneo-1/players")
      .set("Authorization", `Bearer ${tokenFor("JUGADOR", "jugador-1")}`);

    expect(response.status).toBe(403);
    expect(prismaMock.inscripcion.findMany).not.toHaveBeenCalled();
  });

  it("responds 403 for an ARBITRO (no access yet until HU18)", async () => {
    prismaMock.torneo.findUnique.mockResolvedValue(tournamentBase);

    const response = await request(createApp())
      .get("/api/tournaments/torneo-1/players")
      .set("Authorization", `Bearer ${tokenFor("ARBITRO", "arbitro-1")}`);

    expect(response.status).toBe(403);
  });

  it("responds 401 without a token", async () => {
    const response = await request(createApp()).get("/api/tournaments/torneo-1/players");
    expect(response.status).toBe(401);
  });
});

describe("POST /api/tournaments/:id/registration/open and /close", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens registration when the tournament is in CREADO", async () => {
    prismaMock.torneo.findUnique.mockResolvedValue({ ...tournamentBase, estado: "CREADO" });
    prismaMock.torneo.update.mockResolvedValue({ ...tournamentBase, estado: "INSCRIPCIONES_ABIERTAS" });

    const response = await request(createApp())
      .post("/api/tournaments/torneo-1/registration/open")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZADOR", "usuario-1")}`);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("INSCRIPCIONES_ABIERTAS");
  });

  it("responds 409 when trying to close without having opened first", async () => {
    prismaMock.torneo.findUnique.mockResolvedValue({ ...tournamentBase, estado: "CREADO" });

    const response = await request(createApp())
      .post("/api/tournaments/torneo-1/registration/close")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZADOR", "usuario-1")}`);

    expect(response.status).toBe(409);
  });
});

describe("POST /api/tournaments/:id/players", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enrolls a player and responds 201", async () => {
    prismaMock.torneo.findUnique.mockResolvedValue({ ...tournamentBase, estado: "INSCRIPCIONES_ABIERTAS" });
    prismaMock.jugador.findUnique.mockResolvedValue({
      id: "jugador-1",
      codigoUniversitario: "U1",
      programa: "Sistemas",
      semestre: 5,
      usuario: { nombre: "Luis Gómez" },
    });
    prismaMock.inscripcion.create.mockResolvedValue({ id: "insc-1", createdAt: new Date("2026-09-17") });

    const response = await request(createApp())
      .post("/api/tournaments/torneo-1/players")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZADOR", "usuario-1")}`)
      .send({ playerId: "11111111-1111-1111-1111-111111111111" });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ playerId: "jugador-1", name: "Luis Gómez" });
  });

  it("responds 409 (RN-01) for a player already enrolled in the same tournament", async () => {
    prismaMock.torneo.findUnique.mockResolvedValue({ ...tournamentBase, estado: "INSCRIPCIONES_ABIERTAS" });
    prismaMock.jugador.findUnique.mockResolvedValue({
      id: "jugador-1",
      codigoUniversitario: "U1",
      programa: "Sistemas",
      semestre: 5,
      usuario: { nombre: "Luis Gómez" },
    });
    prismaMock.inscripcion.create.mockRejectedValue({ code: "P2002" });

    const response = await request(createApp())
      .post("/api/tournaments/torneo-1/players")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZADOR", "usuario-1")}`)
      .send({ playerId: "11111111-1111-1111-1111-111111111111" });

    expect(response.status).toBe(409);
  });

  it("responds 409 when registration is not open", async () => {
    prismaMock.torneo.findUnique.mockResolvedValue({ ...tournamentBase, estado: "INSCRIPCIONES_CERRADAS" });

    const response = await request(createApp())
      .post("/api/tournaments/torneo-1/players")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZADOR", "usuario-1")}`)
      .send({ playerId: "11111111-1111-1111-1111-111111111111" });

    expect(response.status).toBe(409);
    expect(prismaMock.inscripcion.create).not.toHaveBeenCalled();
  });
});
