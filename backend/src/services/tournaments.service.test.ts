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
    tournament: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    round: {
      findFirst: vi.fn(),
    },
    player: {
      findUnique: vi.fn(),
    },
    enrollment: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    tiebreakCriterion: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(mock)),
  };
  return mock;
}

describe("createTournament", () => {
  it("creates a tournament in preliminary state (CREATED) with valid data", async () => {
    const prisma = buildPrismaMock();
    prisma.tournament.create.mockResolvedValue({
      id: "tournament-1",
      name: "Copa Universitaria",
      startDate: new Date("2026-10-01"),
      endDate: new Date("2026-10-03"),
      status: "CREATED",
      format: "swiss",
      roundsCount: null,
      timeControl: null,
      organizerId: "org-1",
      createdAt: new Date("2026-09-17"),
      tiebreakCriteria: [],
    });

    const tournament = await createTournament(prisma as unknown as PrismaClient, "org-1", {
      name: "Copa Universitaria",
      startDate: new Date("2026-10-01"),
      endDate: new Date("2026-10-03"),
    });

    expect(tournament.status).toBe("CREATED");
    expect(prisma.tournament.create.mock.calls[0][0].data.organizerId).toBe("org-1");
  });
});

describe("listMyTournaments", () => {
  it("an organizer only sees the tournaments they own", async () => {
    const prisma = buildPrismaMock();
    prisma.tournament.findMany.mockResolvedValue([]);

    await listMyTournaments(prisma as unknown as PrismaClient, "org-1", "ORGANIZER");

    expect(prisma.tournament.findMany.mock.calls[0][0].where).toEqual({ organizerId: "org-1" });
  });

  it("an administrator sees all tournaments", async () => {
    const prisma = buildPrismaMock();
    prisma.tournament.findMany.mockResolvedValue([]);

    await listMyTournaments(prisma as unknown as PrismaClient, "admin-1", "ADMINISTRATOR");

    expect(prisma.tournament.findMany.mock.calls[0][0].where).toEqual({});
  });
});

describe("getTournament", () => {
  it("the owning organizer can see the detail", async () => {
    const prisma = buildPrismaMock();
    prisma.tournament.findUnique.mockResolvedValue({ id: "tournament-1", organizerId: "org-1", tiebreakCriteria: [] });

    const tournament = await getTournament(prisma as unknown as PrismaClient, "tournament-1", "org-1", "ORGANIZER");

    expect(tournament.id).toBe("tournament-1");
  });

  it("an administrator can see any tournament", async () => {
    const prisma = buildPrismaMock();
    prisma.tournament.findUnique.mockResolvedValue({ id: "tournament-1", organizerId: "org-1", tiebreakCriteria: [] });

    await expect(
      getTournament(prisma as unknown as PrismaClient, "tournament-1", "admin-1", "ADMINISTRATOR"),
    ).resolves.toMatchObject({ id: "tournament-1" });
  });

  it("rejects (403) a user who is neither the owner nor an administrator", async () => {
    const prisma = buildPrismaMock();
    prisma.tournament.findUnique.mockResolvedValue({ id: "tournament-1", organizerId: "org-1", tiebreakCriteria: [] });

    await expect(
      getTournament(prisma as unknown as PrismaClient, "tournament-1", "player-1", "PLAYER"),
    ).rejects.toMatchObject({ status: 403 } satisfies Partial<HttpError>);
  });

  it("responds 404 when the tournament doesn't exist", async () => {
    const prisma = buildPrismaMock();
    prisma.tournament.findUnique.mockResolvedValue(null);

    await expect(
      getTournament(prisma as unknown as PrismaClient, "tournament-inexistente", "org-1", "ORGANIZER"),
    ).rejects.toMatchObject({ status: 404 } satisfies Partial<HttpError>);
  });
});

describe("listEnrolledPlayers", () => {
  it("the owning organizer can see the roster", async () => {
    const prisma = buildPrismaMock();
    prisma.tournament.findUnique.mockResolvedValue({ id: "tournament-1", organizerId: "org-1" });
    prisma.enrollment.findMany.mockResolvedValue([]);

    await expect(
      listEnrolledPlayers(prisma as unknown as PrismaClient, "tournament-1", "org-1", "ORGANIZER"),
    ).resolves.toEqual([]);
  });

  it("rejects (403) a player unrelated to the tournament", async () => {
    const prisma = buildPrismaMock();
    prisma.tournament.findUnique.mockResolvedValue({ id: "tournament-1", organizerId: "org-1" });

    await expect(
      listEnrolledPlayers(prisma as unknown as PrismaClient, "tournament-1", "player-1", "PLAYER"),
    ).rejects.toMatchObject({ status: 403 } satisfies Partial<HttpError>);
    expect(prisma.enrollment.findMany).not.toHaveBeenCalled();
  });
});

describe("listAvailableTournaments", () => {
  it("only returns tournaments with open registration", async () => {
    const prisma = buildPrismaMock();
    prisma.tournament.findMany.mockResolvedValue([]);

    await listAvailableTournaments(prisma as unknown as PrismaClient);

    expect(prisma.tournament.findMany.mock.calls[0][0].where).toEqual({ status: "REGISTRATION_OPEN" });
  });
});

describe("listEnrolledTournaments", () => {
  it("returns an empty list when the user has no player profile", async () => {
    const prisma = buildPrismaMock();
    prisma.player.findUnique.mockResolvedValue(null);

    const tournaments = await listEnrolledTournaments(prisma as unknown as PrismaClient, "user-1");

    expect(tournaments).toEqual([]);
    expect(prisma.enrollment.findMany).not.toHaveBeenCalled();
  });

  it("returns the tournaments where the player is enrolled", async () => {
    const prisma = buildPrismaMock();
    prisma.player.findUnique.mockResolvedValue({ id: "player-1", userId: "user-1" });
    prisma.enrollment.findMany.mockResolvedValue([
      {
        id: "enrollment-1",
        createdAt: new Date("2026-09-17"),
        tournament: {
          id: "tournament-1",
          name: "Copa Universitaria",
          startDate: new Date("2026-10-01"),
          endDate: new Date("2026-10-03"),
          status: "REGISTRATION_OPEN",
          format: "swiss",
          roundsCount: null,
          timeControl: null,
          organizerId: "org-1",
          createdAt: new Date("2026-09-15"),
          tiebreakCriteria: [],
        },
      },
    ]);

    const tournaments = await listEnrolledTournaments(prisma as unknown as PrismaClient, "user-1");

    expect(prisma.enrollment.findMany.mock.calls[0][0].where).toEqual({ playerId: "player-1" });
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
    prisma.tournament.findUnique.mockResolvedValue({ id: "tournament-1", organizerId: "org-1" });

    await expect(
      configureTournament(prisma as unknown as PrismaClient, "tournament-1", "other-user", "ORGANIZER", {
        roundsCount: 5,
      }),
    ).rejects.toMatchObject({ status: 403 } satisfies Partial<HttpError>);
  });

  it("blocks changes to the tiebreak order once round 1 already exists", async () => {
    prisma.tournament.findUnique.mockResolvedValue({ id: "tournament-1", organizerId: "org-1" });
    prisma.round.findFirst.mockResolvedValue({ id: "round-1", number: 1 });

    await expect(
      configureTournament(prisma as unknown as PrismaClient, "tournament-1", "org-1", "ORGANIZER", {
        tiebreakCriteria: [{ name: "Buchholz", order: 1 }],
      }),
    ).rejects.toMatchObject({ status: 409 } satisfies Partial<HttpError>);

    expect(prisma.tiebreakCriterion.deleteMany).not.toHaveBeenCalled();
  });

  it("saves the configuration when round 1 doesn't exist yet", async () => {
    prisma.tournament.findUnique.mockResolvedValue({ id: "tournament-1", organizerId: "org-1" });
    prisma.round.findFirst.mockResolvedValue(null);
    prisma.tournament.update.mockResolvedValue({
      id: "tournament-1",
      name: "Copa",
      startDate: new Date(),
      endDate: new Date(),
      status: "CREATED",
      format: "swiss",
      roundsCount: 7,
      timeControl: "90+30",
      organizerId: "org-1",
      createdAt: new Date(),
      tiebreakCriteria: [{ id: "c1", tournamentId: "tournament-1", name: "Buchholz", order: 1 }],
    });

    const tournament = await configureTournament(prisma as unknown as PrismaClient, "tournament-1", "org-1", "ORGANIZER", {
      roundsCount: 7,
      timeControl: "90+30",
      tiebreakCriteria: [{ name: "Buchholz", order: 1 }],
    });

    expect(prisma.tiebreakCriterion.deleteMany).toHaveBeenCalledWith({ where: { tournamentId: "tournament-1" } });
    expect(tournament.roundsCount).toBe(7);
    expect(tournament.tiebreakCriteria).toEqual([{ name: "Buchholz", order: 1 }]);
  });

  it("an administrator can configure a tournament even without being the owning organizer", async () => {
    prisma.tournament.findUnique.mockResolvedValue({ id: "tournament-1", organizerId: "org-1" });
    prisma.tournament.update.mockResolvedValue({
      id: "tournament-1",
      name: "Copa",
      startDate: new Date(),
      endDate: new Date(),
      status: "CREATED",
      format: "swiss",
      roundsCount: 3,
      timeControl: null,
      organizerId: "org-1",
      createdAt: new Date(),
      tiebreakCriteria: [],
    });

    await expect(
      configureTournament(prisma as unknown as PrismaClient, "tournament-1", "admin-1", "ADMINISTRATOR", {
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

  it("opens registration from CREATED", async () => {
    prisma.tournament.findUnique.mockResolvedValue({ id: "tournament-1", organizerId: "org-1", status: "CREATED" });
    prisma.tournament.update.mockResolvedValue({
      id: "tournament-1",
      name: "Copa",
      startDate: new Date(),
      endDate: new Date(),
      status: "REGISTRATION_OPEN",
      format: "swiss",
      roundsCount: null,
      timeControl: null,
      organizerId: "org-1",
      createdAt: new Date(),
      tiebreakCriteria: [],
    });

    const tournament = await openRegistration(prisma as unknown as PrismaClient, "tournament-1", "org-1", "ORGANIZER");

    expect(tournament.status).toBe("REGISTRATION_OPEN");
  });

  it("rejects opening registration when the tournament is not in CREATED", async () => {
    prisma.tournament.findUnique.mockResolvedValue({
      id: "tournament-1",
      organizerId: "org-1",
      status: "REGISTRATION_CLOSED",
    });

    await expect(
      openRegistration(prisma as unknown as PrismaClient, "tournament-1", "org-1", "ORGANIZER"),
    ).rejects.toMatchObject({ status: 409 } satisfies Partial<HttpError>);
  });

  it("closes registration from REGISTRATION_OPEN", async () => {
    prisma.tournament.findUnique.mockResolvedValue({
      id: "tournament-1",
      organizerId: "org-1",
      status: "REGISTRATION_OPEN",
    });
    prisma.tournament.update.mockResolvedValue({
      id: "tournament-1",
      name: "Copa",
      startDate: new Date(),
      endDate: new Date(),
      status: "REGISTRATION_CLOSED",
      format: "swiss",
      roundsCount: null,
      timeControl: null,
      organizerId: "org-1",
      createdAt: new Date(),
      tiebreakCriteria: [],
    });

    const tournament = await closeRegistration(prisma as unknown as PrismaClient, "tournament-1", "org-1", "ORGANIZER");

    expect(tournament.status).toBe("REGISTRATION_CLOSED");
  });

  it("rejects closing registration when it was never opened", async () => {
    prisma.tournament.findUnique.mockResolvedValue({ id: "tournament-1", organizerId: "org-1", status: "CREATED" });

    await expect(
      closeRegistration(prisma as unknown as PrismaClient, "tournament-1", "org-1", "ORGANIZER"),
    ).rejects.toMatchObject({ status: 409 } satisfies Partial<HttpError>);
  });
});

describe("enrollPlayer", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(() => {
    prisma = buildPrismaMock();
  });

  it("enrolls a player when registration is open", async () => {
    prisma.tournament.findUnique.mockResolvedValue({
      id: "tournament-1",
      organizerId: "org-1",
      status: "REGISTRATION_OPEN",
    });
    prisma.player.findUnique.mockResolvedValue({
      id: "player-1",
      universityCode: "U1",
      program: "Sistemas",
      semester: 5,
      user: { name: "Luis Gómez" },
    });
    prisma.enrollment.create.mockResolvedValue({ id: "enrollment-1", createdAt: new Date("2026-09-17") });

    const result = await enrollPlayer(
      prisma as unknown as PrismaClient,
      "tournament-1",
      "player-1",
      "org-1",
      "ORGANIZER",
    );

    expect(result).toMatchObject({ playerId: "player-1", name: "Luis Gómez" });
  });

  it("rejects enrolling when the tournament doesn't have registration open", async () => {
    prisma.tournament.findUnique.mockResolvedValue({
      id: "tournament-1",
      organizerId: "org-1",
      status: "REGISTRATION_CLOSED",
    });

    await expect(
      enrollPlayer(prisma as unknown as PrismaClient, "tournament-1", "player-1", "org-1", "ORGANIZER"),
    ).rejects.toMatchObject({ status: 409 } satisfies Partial<HttpError>);

    expect(prisma.enrollment.create).not.toHaveBeenCalled();
  });

  it("rejects (RN-01) a duplicate enrollment attempt in the same tournament", async () => {
    prisma.tournament.findUnique.mockResolvedValue({
      id: "tournament-1",
      organizerId: "org-1",
      status: "REGISTRATION_OPEN",
    });
    prisma.player.findUnique.mockResolvedValue({
      id: "player-1",
      universityCode: "U1",
      program: "Sistemas",
      semester: 5,
      user: { name: "Luis Gómez" },
    });
    prisma.enrollment.create.mockRejectedValue({ code: "P2002" });

    await expect(
      enrollPlayer(prisma as unknown as PrismaClient, "tournament-1", "player-1", "org-1", "ORGANIZER"),
    ).rejects.toMatchObject({ status: 409, message: "El jugador ya está inscrito en este torneo" } satisfies Partial<HttpError>);
  });

  it("responds 404 when the player doesn't exist", async () => {
    prisma.tournament.findUnique.mockResolvedValue({
      id: "tournament-1",
      organizerId: "org-1",
      status: "REGISTRATION_OPEN",
    });
    prisma.player.findUnique.mockResolvedValue(null);

    await expect(
      enrollPlayer(prisma as unknown as PrismaClient, "tournament-1", "nonexistent-player", "org-1", "ORGANIZER"),
    ).rejects.toMatchObject({ status: 404 } satisfies Partial<HttpError>);
  });

  it("rejects (409) a player from another program when the tournament has restrictedProgram", async () => {
    prisma.tournament.findUnique.mockResolvedValue({
      id: "tournament-1",
      organizerId: "org-1",
      status: "REGISTRATION_OPEN",
      restrictedProgram: "Ingeniería de Sistemas",
      minimumSemester: null,
    });
    prisma.player.findUnique.mockResolvedValue({
      id: "player-1",
      universityCode: "U1",
      program: "Ingeniería Industrial",
      semester: 5,
      user: { name: "Luis Gómez" },
    });

    await expect(
      enrollPlayer(prisma as unknown as PrismaClient, "tournament-1", "player-1", "org-1", "ORGANIZER"),
    ).rejects.toMatchObject({ status: 409 } satisfies Partial<HttpError>);
    expect(prisma.enrollment.create).not.toHaveBeenCalled();
  });

  it("rejects (409) a player below the configured minimumSemester", async () => {
    prisma.tournament.findUnique.mockResolvedValue({
      id: "tournament-1",
      organizerId: "org-1",
      status: "REGISTRATION_OPEN",
      restrictedProgram: null,
      minimumSemester: 5,
    });
    prisma.player.findUnique.mockResolvedValue({
      id: "player-1",
      universityCode: "U1",
      program: "Sistemas",
      semester: 3,
      user: { name: "Luis Gómez" },
    });

    await expect(
      enrollPlayer(prisma as unknown as PrismaClient, "tournament-1", "player-1", "org-1", "ORGANIZER"),
    ).rejects.toMatchObject({ status: 409 } satisfies Partial<HttpError>);
  });

  it("allows enrolling when the player meets the required program and minimum semester", async () => {
    prisma.tournament.findUnique.mockResolvedValue({
      id: "tournament-1",
      organizerId: "org-1",
      status: "REGISTRATION_OPEN",
      restrictedProgram: "Sistemas",
      minimumSemester: 5,
    });
    prisma.player.findUnique.mockResolvedValue({
      id: "player-1",
      universityCode: "U1",
      program: "Sistemas",
      semester: 5,
      user: { name: "Luis Gómez" },
    });
    prisma.enrollment.create.mockResolvedValue({ id: "enrollment-1", createdAt: new Date("2026-09-19") });

    await expect(
      enrollPlayer(prisma as unknown as PrismaClient, "tournament-1", "player-1", "org-1", "ORGANIZER"),
    ).resolves.toMatchObject({ playerId: "player-1" });
  });
});

describe("configureTournament — eligibility restrictions", () => {
  it("persists restrictedProgram and minimumSemester", async () => {
    const prisma = buildPrismaMock();
    prisma.tournament.findUnique.mockResolvedValue({ id: "tournament-1", organizerId: "org-1" });
    prisma.tournament.update.mockResolvedValue({
      id: "tournament-1",
      name: "Copa",
      startDate: new Date(),
      endDate: new Date(),
      status: "CREATED",
      format: "swiss",
      roundsCount: null,
      timeControl: null,
      restrictedProgram: "Sistemas",
      minimumSemester: 5,
      organizerId: "org-1",
      createdAt: new Date(),
      tiebreakCriteria: [],
    });

    const tournament = await configureTournament(prisma as unknown as PrismaClient, "tournament-1", "org-1", "ORGANIZER", {
      restrictedProgram: "Sistemas",
      minimumSemester: 5,
    });

    expect(prisma.tournament.update.mock.calls[0][0].data).toMatchObject({
      restrictedProgram: "Sistemas",
      minimumSemester: 5,
    });
    expect(tournament.restrictedProgram).toBe("Sistemas");
    expect(tournament.minimumSemester).toBe(5);
  });

  it("allows clearing a restriction by sending an explicit null", async () => {
    const prisma = buildPrismaMock();
    prisma.tournament.findUnique.mockResolvedValue({ id: "tournament-1", organizerId: "org-1" });
    prisma.tournament.update.mockResolvedValue({
      id: "tournament-1",
      name: "Copa",
      startDate: new Date(),
      endDate: new Date(),
      status: "CREATED",
      format: "swiss",
      roundsCount: null,
      timeControl: null,
      restrictedProgram: null,
      minimumSemester: null,
      organizerId: "org-1",
      createdAt: new Date(),
      tiebreakCriteria: [],
    });

    await configureTournament(prisma as unknown as PrismaClient, "tournament-1", "org-1", "ORGANIZER", {
      restrictedProgram: null,
    });

    expect(prisma.tournament.update.mock.calls[0][0].data).toMatchObject({ restrictedProgram: null });
  });
});
