import type { PrismaClient } from "../generated/prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { HttpError } from "../errors/apiErrors";
import { emitToTournament } from "../sockets/broadcast";
import {
  openRegistration,
  closeRegistration,
  configureTournament,
  createTournament,
  enrollPlayer,
  finishTournament,
  listEnrolledPlayers,
  listMyTournaments,
  listAvailableTournaments,
  listEnrolledTournaments,
  getTournament,
  withdrawPlayer,
} from "./tournaments.service";

vi.mock("../sockets/broadcast", () => ({ emitToTournament: vi.fn() }));

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
      count: vi.fn().mockResolvedValue(0),
    },
    player: {
      findUnique: vi.fn(),
    },
    enrollment: {
      create: vi.fn(),
      findMany: vi.fn(),
      // Not enrolled yet, unless a test says otherwise.
      findUnique: vi.fn().mockResolvedValue(null),
    },
    tiebreakCriterion: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    // The tournament's row lock (lockTournament): nothing to read back.
    $queryRaw: vi.fn(),
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

    const tournament = await createTournament(
      prisma as unknown as PrismaClient,
      {
        name: "Copa Universitaria",
        startDate: new Date("2026-10-01"),
        endDate: new Date("2026-10-03"),
      },
      { id: "org-1", role: "ORGANIZER" },
    );

    expect(tournament.status).toBe("CREATED");
    expect(prisma.tournament.create.mock.calls[0][0].data.organizerId).toBe("org-1");
  });
});

describe("listMyTournaments", () => {
  it("an organizer only sees the tournaments they own", async () => {
    const prisma = buildPrismaMock();
    prisma.tournament.findMany.mockResolvedValue([]);

    await listMyTournaments(prisma as unknown as PrismaClient, { id: "org-1", role: "ORGANIZER" });

    expect(prisma.tournament.findMany.mock.calls[0][0].where).toEqual({ organizerId: "org-1" });
  });

  it("an administrator sees all tournaments", async () => {
    const prisma = buildPrismaMock();
    prisma.tournament.findMany.mockResolvedValue([]);

    await listMyTournaments(prisma as unknown as PrismaClient, { id: "admin-1", role: "ADMINISTRATOR" });

    expect(prisma.tournament.findMany.mock.calls[0][0].where).toEqual({});
  });
});

describe("getTournament", () => {
  it("the owning organizer can see the detail", async () => {
    const prisma = buildPrismaMock();
    prisma.tournament.findUnique.mockResolvedValue({ id: "tournament-1", organizerId: "org-1", tiebreakCriteria: [] });

    const tournament = await getTournament(prisma as unknown as PrismaClient, "tournament-1", {
      id: "org-1",
      role: "ORGANIZER",
    });

    expect(tournament.id).toBe("tournament-1");
  });

  it("an administrator can see any tournament", async () => {
    const prisma = buildPrismaMock();
    prisma.tournament.findUnique.mockResolvedValue({ id: "tournament-1", organizerId: "org-1", tiebreakCriteria: [] });

    await expect(
      getTournament(prisma as unknown as PrismaClient, "tournament-1", { id: "admin-1", role: "ADMINISTRATOR" }),
    ).resolves.toMatchObject({ id: "tournament-1" });
  });

  it("hides a draft from anyone who doesn't manage it (404), but shows it once published (HU18)", async () => {
    const prisma = buildPrismaMock();
    const draft = { id: "tournament-1", organizerId: "org-1", status: "CREATED", tiebreakCriteria: [] };
    prisma.tournament.findUnique.mockResolvedValueOnce(draft);

    await expect(
      getTournament(prisma as unknown as PrismaClient, "tournament-1", { id: "player-1", role: "PLAYER" }),
    ).rejects.toMatchObject({ status: 404 } satisfies Partial<HttpError>);

    prisma.tournament.findUnique.mockResolvedValueOnce({ ...draft, status: "IN_PROGRESS" });
    await expect(
      getTournament(prisma as unknown as PrismaClient, "tournament-1", { id: "player-1", role: "PLAYER" }),
    ).resolves.toMatchObject({ id: "tournament-1" });
  });

  it("responds 404 when the tournament doesn't exist", async () => {
    const prisma = buildPrismaMock();
    prisma.tournament.findUnique.mockResolvedValue(null);

    await expect(
      getTournament(prisma as unknown as PrismaClient, "tournament-inexistente", { id: "org-1", role: "ORGANIZER" }),
    ).rejects.toMatchObject({ status: 404 } satisfies Partial<HttpError>);
  });
});

describe("listEnrolledPlayers", () => {
  it("the owning organizer can see the roster", async () => {
    const prisma = buildPrismaMock();
    prisma.tournament.findUnique.mockResolvedValue({ id: "tournament-1", organizerId: "org-1" });
    prisma.enrollment.findMany.mockResolvedValue([]);

    await expect(
      listEnrolledPlayers(prisma as unknown as PrismaClient, "tournament-1", { id: "org-1", role: "ORGANIZER" }),
    ).resolves.toEqual([]);
  });

  it("rejects (403) a player unrelated to the tournament", async () => {
    const prisma = buildPrismaMock();
    prisma.tournament.findUnique.mockResolvedValue({ id: "tournament-1", organizerId: "org-1" });

    await expect(
      listEnrolledPlayers(prisma as unknown as PrismaClient, "tournament-1", { id: "player-1", role: "PLAYER" }),
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
  it("returns the tournaments where the player is enrolled", async () => {
    const prisma = buildPrismaMock();
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

    const tournaments = await listEnrolledTournaments(prisma as unknown as PrismaClient, {
      id: "user-1",
      role: "PLAYER",
    });

    // Through the actor's player profile: someone without one simply has no enrollments.
    expect(prisma.enrollment.findMany.mock.calls[0][0].where).toEqual({ player: { userId: "user-1" } });
    expect(tournaments).toEqual([expect.objectContaining({ id: "tournament-1", name: "Copa Universitaria" })]);
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
      configureTournament(
        prisma as unknown as PrismaClient,
        "tournament-1",
        {
          roundsCount: 5,
        },
        { id: "other-user", role: "ORGANIZER" },
      ),
    ).rejects.toMatchObject({ status: 403 } satisfies Partial<HttpError>);
  });

  it("blocks changes to the tiebreak order once round 1 already exists", async () => {
    prisma.tournament.findUnique.mockResolvedValue({ id: "tournament-1", organizerId: "org-1" });
    prisma.round.findFirst.mockResolvedValue({ id: "round-1", number: 1 });

    await expect(
      configureTournament(
        prisma as unknown as PrismaClient,
        "tournament-1",
        {
          tiebreakCriteria: [{ name: "BUCHHOLZ", order: 1 }],
        },
        { id: "org-1", role: "ORGANIZER" },
      ),
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
      tiebreakCriteria: [{ id: "c1", tournamentId: "tournament-1", name: "BUCHHOLZ", order: 1 }],
    });

    const tournament = await configureTournament(
      prisma as unknown as PrismaClient,
      "tournament-1",
      {
        roundsCount: 7,
        timeControl: "90+30",
        tiebreakCriteria: [{ name: "BUCHHOLZ", order: 1 }],
      },
      { id: "org-1", role: "ORGANIZER" },
    );

    expect(prisma.tiebreakCriterion.deleteMany).toHaveBeenCalledWith({ where: { tournamentId: "tournament-1" } });
    expect(tournament.roundsCount).toBe(7);
    expect(tournament.tiebreakCriteria).toEqual([{ name: "BUCHHOLZ", order: 1 }]);
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
      configureTournament(
        prisma as unknown as PrismaClient,
        "tournament-1",
        {
          roundsCount: 3,
        },
        { id: "admin-1", role: "ADMINISTRATOR" },
      ),
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

    const tournament = await openRegistration(prisma as unknown as PrismaClient, "tournament-1", {
      id: "org-1",
      role: "ORGANIZER",
    });

    expect(tournament.status).toBe("REGISTRATION_OPEN");
  });

  it("rejects opening registration when the tournament is not in CREATED", async () => {
    prisma.tournament.findUnique.mockResolvedValue({
      id: "tournament-1",
      organizerId: "org-1",
      status: "REGISTRATION_CLOSED",
    });

    await expect(
      openRegistration(prisma as unknown as PrismaClient, "tournament-1", { id: "org-1", role: "ORGANIZER" }),
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

    const tournament = await closeRegistration(prisma as unknown as PrismaClient, "tournament-1", {
      id: "org-1",
      role: "ORGANIZER",
    });

    expect(tournament.status).toBe("REGISTRATION_CLOSED");
  });

  it("rejects closing registration when it was never opened", async () => {
    prisma.tournament.findUnique.mockResolvedValue({ id: "tournament-1", organizerId: "org-1", status: "CREATED" });

    await expect(
      closeRegistration(prisma as unknown as PrismaClient, "tournament-1", { id: "org-1", role: "ORGANIZER" }),
    ).rejects.toMatchObject({ status: 409 } satisfies Partial<HttpError>);
  });

  it("explains a refused transition in words, without the internal state codes", async () => {
    prisma.tournament.findUnique.mockResolvedValue({ id: "tournament-1", organizerId: "org-1", status: "CREATED" });

    await expect(
      closeRegistration(prisma as unknown as PrismaClient, "tournament-1", { id: "org-1", role: "ORGANIZER" }),
    ).rejects.toThrow("Solo se pueden cerrar las inscripciones mientras están abiertas");
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

    const result = await enrollPlayer(prisma as unknown as PrismaClient, "tournament-1", "player-1", {
      id: "org-1",
      role: "ORGANIZER",
    });

    expect(result).toMatchObject({ playerId: "player-1", name: "Luis Gómez" });
  });

  it("rejects enrolling when the tournament doesn't have registration open", async () => {
    prisma.tournament.findUnique.mockResolvedValue({
      id: "tournament-1",
      organizerId: "org-1",
      status: "REGISTRATION_CLOSED",
    });

    await expect(
      enrollPlayer(prisma as unknown as PrismaClient, "tournament-1", "player-1", { id: "org-1", role: "ORGANIZER" }),
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
    prisma.enrollment.findUnique.mockResolvedValue({ id: "enrollment-1", tournamentId: "tournament-1" });

    await expect(
      enrollPlayer(prisma as unknown as PrismaClient, "tournament-1", "player-1", { id: "org-1", role: "ORGANIZER" }),
    ).rejects.toMatchObject({
      status: 409,
      message: "El jugador ya está inscrito en este torneo",
    } satisfies Partial<HttpError>);
  });

  it("responds 404 when the player doesn't exist", async () => {
    prisma.tournament.findUnique.mockResolvedValue({
      id: "tournament-1",
      organizerId: "org-1",
      status: "REGISTRATION_OPEN",
    });
    prisma.player.findUnique.mockResolvedValue(null);

    await expect(
      enrollPlayer(prisma as unknown as PrismaClient, "tournament-1", "nonexistent-player", {
        id: "org-1",
        role: "ORGANIZER",
      }),
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
      enrollPlayer(prisma as unknown as PrismaClient, "tournament-1", "player-1", { id: "org-1", role: "ORGANIZER" }),
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
      enrollPlayer(prisma as unknown as PrismaClient, "tournament-1", "player-1", { id: "org-1", role: "ORGANIZER" }),
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
      enrollPlayer(prisma as unknown as PrismaClient, "tournament-1", "player-1", { id: "org-1", role: "ORGANIZER" }),
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

    const tournament = await configureTournament(
      prisma as unknown as PrismaClient,
      "tournament-1",
      {
        restrictedProgram: "Sistemas",
        minimumSemester: 5,
      },
      { id: "org-1", role: "ORGANIZER" },
    );

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

    await configureTournament(
      prisma as unknown as PrismaClient,
      "tournament-1",
      {
        restrictedProgram: null,
      },
      { id: "org-1", role: "ORGANIZER" },
    );

    expect(prisma.tournament.update.mock.calls[0][0].data).toMatchObject({ restrictedProgram: null });
  });
});

describe("finishTournament (HU17)", () => {
  function finishMock(rounds: { status: string }[]) {
    const mock = {
      tournament: {
        findUnique: vi.fn().mockResolvedValue({
          id: "t-1",
          name: "Copa",
          organizerId: "org-1",
          status: "IN_PROGRESS",
          roundsCount: 2,
        }),
        update: vi.fn().mockResolvedValue({ id: "t-1", status: "FINISHED", byePoints: 1, tiebreakCriteria: [] }),
      },
      round: { findMany: vi.fn().mockResolvedValue(rounds) },
      auditLog: { create: vi.fn().mockResolvedValue({ id: "log-1" }) },
      // No suppression waiting on this tournament (see dataRights.int.test.ts for one that is).
      dataRequest: { findMany: vi.fn().mockResolvedValue([]) },
      // The tournament's row lock (lockTournament): nothing to read back.
      $queryRaw: vi.fn(),
      $transaction: vi.fn(),
    };
    mock.$transaction.mockImplementation((work: (tx: typeof mock) => unknown) => work(mock));
    return mock;
  }
  const organizer = { id: "org-1", role: "ORGANIZER" };

  it("closes the tournament once every configured round is fully recorded", async () => {
    const prisma = finishMock([{ status: "STANDINGS_UPDATED" }, { status: "STANDINGS_UPDATED" }]);

    const result = await finishTournament(prisma as unknown as PrismaClient, "t-1", organizer);

    expect(result.status).toBe("FINISHED");
    expect(prisma.auditLog.create.mock.calls[0][0].data.action).toBe("TOURNAMENT_FINISHED");
  });

  it.each([
    ["a round still has pending results", [{ status: "STANDINGS_UPDATED" }, { status: "RECORDING_RESULTS" }]],
    ["not every configured round was played", [{ status: "STANDINGS_UPDATED" }]],
  ])("refuses when %s", async (_label, rounds) => {
    const prisma = finishMock(rounds);

    await expect(finishTournament(prisma as unknown as PrismaClient, "t-1", organizer)).rejects.toMatchObject({
      status: 409,
    });
    expect(prisma.tournament.update).not.toHaveBeenCalled();
  });
});

describe("configureTournament — rounds already generated", () => {
  it("refuses a number of rounds below the rounds the tournament already has", async () => {
    const prisma = buildPrismaMock();
    prisma.tournament.findUnique.mockResolvedValue({ id: "tournament-1", organizerId: "org-1", status: "IN_PROGRESS" });
    prisma.round.count.mockResolvedValue(3);

    await expect(
      configureTournament(
        prisma as unknown as PrismaClient,
        "tournament-1",
        { roundsCount: 2 },
        { id: "org-1", role: "ORGANIZER" },
      ),
    ).rejects.toMatchObject({ status: 409 } satisfies Partial<HttpError>);
    expect(prisma.tournament.update).not.toHaveBeenCalled();
  });

  it("refuses any configuration change once the tournament is finished (HU17)", async () => {
    const prisma = buildPrismaMock();
    prisma.tournament.findUnique.mockResolvedValue({ id: "tournament-1", organizerId: "org-1", status: "FINISHED" });

    await expect(
      configureTournament(
        prisma as unknown as PrismaClient,
        "tournament-1",
        {
          timeControl: "5+3",
        },
        { id: "org-1", role: "ORGANIZER" },
      ),
    ).rejects.toMatchObject({ status: 409 } satisfies Partial<HttpError>);
  });
});

describe("withdrawPlayer (HU27)", () => {
  function withdrawMock(enrollment: { withdrawnAt: Date | null }) {
    const mock = {
      tournament: {
        findUnique: vi.fn().mockResolvedValue({
          id: "t-1",
          name: "Copa",
          organizerId: "org-1",
          status: "IN_PROGRESS",
        }),
      },
      enrollment: {
        findUnique: vi.fn().mockResolvedValue({
          id: "enr-1",
          ...enrollment,
          player: { user: { name: "Ana Torres" } },
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      auditLog: { create: vi.fn().mockResolvedValue({ id: "log-1" }) },
      // No suppression waiting on this tournament (see dataRights.int.test.ts for one that is).
      dataRequest: { findMany: vi.fn().mockResolvedValue([]) },
      // The tournament's row lock (lockTournament): nothing to read back.
      $queryRaw: vi.fn(),
      $transaction: vi.fn(),
    };
    mock.$transaction.mockImplementation((work: (tx: typeof mock) => unknown) => work(mock));
    return mock;
  }
  const withdraw = (prisma: ReturnType<typeof withdrawMock>) =>
    withdrawPlayer(prisma as unknown as PrismaClient, "t-1", "p-1", {}, { id: "org-1", role: "ORGANIZER" });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tells the tournament's room once the withdrawal is saved, so standings and stats refresh live", async () => {
    const prisma = withdrawMock({ withdrawnAt: null });

    await withdraw(prisma);

    expect(prisma.enrollment.update).toHaveBeenCalledWith({
      where: { id: "enr-1" },
      data: { withdrawnAt: expect.any(Date) },
    });
    expect(emitToTournament).toHaveBeenCalledWith("t-1", "player.withdrawn", { tournamentId: "t-1", playerId: "p-1" });
  });

  it("tells no one when the withdrawal doesn't commit", async () => {
    const prisma = withdrawMock({ withdrawnAt: null });
    prisma.auditLog.create.mockRejectedValue(new Error("audit write failed"));

    await expect(withdraw(prisma)).rejects.toThrow("audit write failed");
    expect(emitToTournament).not.toHaveBeenCalled();
  });

  it("refuses a player who already withdrew, and tells no one", async () => {
    const prisma = withdrawMock({ withdrawnAt: new Date("2026-09-01") });

    await expect(withdraw(prisma)).rejects.toMatchObject({ status: 404 } satisfies Partial<HttpError>);
    expect(prisma.enrollment.update).not.toHaveBeenCalled();
    expect(emitToTournament).not.toHaveBeenCalled();
  });
});
