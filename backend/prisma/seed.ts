import { PrismaClient, type TournamentStatus } from "@prisma/client";

import { DATA_POLICY_VERSION } from "../src/config/dataPolicy";
import { hashPassword } from "../src/services/password";
import { seedCompetitionHistory } from "./seeds/competitionHistory";
import { seedDashboardLayouts } from "./seeds/dashboardLayouts";

const prisma = new PrismaClient();

// Role catalog (RF03). See docs/media/image1.png / image7.png.
const ROLES = ["ORGANIZER", "ARBITER", "PLAYER", "COACH", "ADMINISTRATOR"];

// Same password everywhere on purpose (easy to remember while testing);
// never used outside a local dev database. Every upsert below uses
// update:{}, so re-running the seed never clobbers a password or field
// changed by hand while testing — it only fills in what's missing.
const TEST_PASSWORD = "Test1234";

// --- one demo account per role, so every role can log in without registering ---

interface DemoAccountSeed {
  role: string;
  name: string;
  email: string;
  player?: { universityCode: string; program: string; semester: number };
}

const DEMO_ACCOUNTS: DemoAccountSeed[] = [
  { role: "ADMINISTRATOR", name: "Admin Demo", email: "admin@test.com" },
  { role: "ORGANIZER", name: "Organizador Demo", email: "organizer@test.com" },
  { role: "ARBITER", name: "Árbitro Demo", email: "arbiter@test.com" },
  { role: "COACH", name: "Entrenador Demo", email: "coach@test.com" },
  {
    role: "PLAYER",
    name: "Jugador Demo",
    email: "player@test.com",
    player: { universityCode: "U0001", program: "Ingeniería de Sistemas", semester: 5 },
  },
];

// --- extra players/coaches, so the app has more than one of everything ---

interface PlayerSeed {
  name: string;
  email: string;
  universityCode: string;
  program: string;
  semester: number;
  club?: string;
}

const EXTRA_PLAYERS: PlayerSeed[] = [
  {
    name: "Luis Gómez",
    email: "luis.gomez@test.com",
    universityCode: "U1001",
    program: "Ingeniería de Sistemas",
    semester: 4,
    club: "Club Ajedrez Central",
  },
  {
    name: "Ana Torres",
    email: "ana.torres@test.com",
    universityCode: "U1002",
    program: "Ingeniería Industrial",
    semester: 6,
    club: "Club Ajedrez Central",
  },
  {
    name: "Carlos Ruiz",
    email: "carlos.ruiz@test.com",
    universityCode: "U1003",
    program: "Ingeniería de Sistemas",
    semester: 2,
    club: "Torre Blanca",
  },
  {
    name: "María Fernanda López",
    email: "maria.lopez@test.com",
    universityCode: "U1004",
    program: "Derecho",
    semester: 8,
    club: "Torre Blanca",
  },
  {
    name: "Andrés Felipe Gómez",
    email: "andres.gomez@test.com",
    universityCode: "U1005",
    program: "Ingeniería de Sistemas",
    semester: 3,
    club: "Caballeros del Rey",
  },
  {
    name: "Camila Rodríguez",
    email: "camila.rodriguez@test.com",
    universityCode: "U1006",
    program: "Administración de Empresas",
    semester: 5,
  },
  {
    name: "Juan Pablo Herrera",
    email: "juan.herrera@test.com",
    universityCode: "U1007",
    program: "Ingeniería de Sistemas",
    semester: 7,
  },
  {
    name: "Valentina Castro",
    email: "valentina.castro@test.com",
    universityCode: "U1008",
    program: "Psicología",
    semester: 1,
  },
  {
    name: "Sofía Martínez",
    email: "sofia.martinez@test.com",
    universityCode: "U1009",
    program: "Ingeniería Industrial",
    semester: 3,
    club: "Caballeros del Rey",
  },
  {
    name: "Diego Ramírez",
    email: "diego.ramirez@test.com",
    universityCode: "U1010",
    program: "Ingeniería de Sistemas",
    semester: 9,
  },
  {
    name: "Laura Pineda",
    email: "laura.pineda@test.com",
    universityCode: "U1011",
    program: "Comunicación Social",
    semester: 2,
  },
];

// Playing strength (Elo-like) used ONLY to simulate believable results in
// the seeded history (stronger players win more often). Not stored: rating
// calculation is out of this project's scope.
const PLAYER_STRENGTH: Record<string, number> = {
  "luis.gomez@test.com": 1850,
  "ana.torres@test.com": 1780,
  "juan.herrera@test.com": 1720,
  "player@test.com": 1650,
  "maria.lopez@test.com": 1600,
  "andres.gomez@test.com": 1560,
  "diego.ramirez@test.com": 1540,
  "sofia.martinez@test.com": 1500,
  "carlos.ruiz@test.com": 1450,
  "camila.rodriguez@test.com": 1420,
  "laura.pineda@test.com": 1380,
  "valentina.castro@test.com": 1300,
};
const DEFAULT_STRENGTH = 1500;
const ALL_PLAYER_EMAILS = Object.keys(PLAYER_STRENGTH);

const EXTRA_COACHES = [{ name: "Marta Ríos", email: "marta.rios@test.com" }];

const CLUBS = ["Club Ajedrez Central", "Torre Blanca", "Caballeros del Rey"];

// coach email -> emails of the players they follow
const COACH_LINKS: { coachEmail: string; playerEmails: string[] }[] = [
  {
    coachEmail: "coach@test.com",
    playerEmails: ["luis.gomez@test.com", "ana.torres@test.com", "carlos.ruiz@test.com"],
  },
  { coachEmail: "marta.rios@test.com", playerEmails: ["maria.lopez@test.com", "andres.gomez@test.com"] },
];

interface TournamentSeed {
  name: string;
  startDate: Date;
  endDate: Date;
  status: TournamentStatus;
  roundsCount?: number;
  timeControl?: string;
  organizerEmail: string;
  enrolledPlayerEmails: string[];
  // Played-out history (rounds, results, standings) for dashboards; see
  // prisma/seeds/competitionHistory.ts.
  history?: { completedRounds: number; partialRound?: boolean };
}

const TOURNAMENTS: TournamentSeed[] = [
  {
    name: "Copa Central de Apertura",
    startDate: new Date("2026-10-15"),
    endDate: new Date("2026-10-17"),
    status: "REGISTRATION_OPEN",
    roundsCount: 5,
    timeControl: "90+30",
    organizerEmail: "organizer@test.com",
    enrolledPlayerEmails: [
      "luis.gomez@test.com",
      "ana.torres@test.com",
      "carlos.ruiz@test.com",
      "maria.lopez@test.com",
      "camila.rodriguez@test.com",
    ],
  },
  {
    name: "Torneo Relámpago Interno",
    startDate: new Date("2026-11-05"),
    endDate: new Date("2026-11-05"),
    status: "CREATED",
    organizerEmail: "organizer@test.com",
    enrolledPlayerEmails: [],
  },
  {
    name: "Clásico Universitario 2026",
    startDate: new Date("2026-08-20"),
    endDate: new Date("2026-08-22"),
    status: "REGISTRATION_CLOSED",
    roundsCount: 7,
    timeControl: "60+15",
    organizerEmail: "organizer@test.com",
    enrolledPlayerEmails: [
      "juan.herrera@test.com",
      "valentina.castro@test.com",
      "andres.gomez@test.com",
      "player@test.com",
    ],
  },
  // --- past and ongoing tournaments with real results (dashboards/history) ---
  {
    name: "Abierto de Bienvenida 2025-II",
    startDate: new Date("2025-08-22"),
    endDate: new Date("2025-08-24"),
    status: "FINISHED",
    roundsCount: 5,
    timeControl: "60+15",
    organizerEmail: "organizer@test.com",
    enrolledPlayerEmails: [
      "luis.gomez@test.com",
      "ana.torres@test.com",
      "carlos.ruiz@test.com",
      "maria.lopez@test.com",
      "andres.gomez@test.com",
      "juan.herrera@test.com",
      "player@test.com",
      "valentina.castro@test.com",
    ],
    history: { completedRounds: 5 },
  },
  {
    name: "Copa Otoño 2025",
    startDate: new Date("2025-10-17"),
    endDate: new Date("2025-10-19"),
    status: "FINISHED",
    roundsCount: 5,
    timeControl: "90+30",
    organizerEmail: "organizer@test.com",
    enrolledPlayerEmails: [
      "luis.gomez@test.com",
      "ana.torres@test.com",
      "maria.lopez@test.com",
      "andres.gomez@test.com",
      "camila.rodriguez@test.com",
      "juan.herrera@test.com",
      "player@test.com",
      "sofia.martinez@test.com",
      "diego.ramirez@test.com",
    ],
    history: { completedRounds: 5 },
  },
  {
    name: "Blitz Navideño 2025",
    startDate: new Date("2025-12-05"),
    endDate: new Date("2025-12-05"),
    status: "FINISHED",
    roundsCount: 4,
    timeControl: "5+3",
    organizerEmail: "organizer@test.com",
    enrolledPlayerEmails: [
      "luis.gomez@test.com",
      "carlos.ruiz@test.com",
      "juan.herrera@test.com",
      "player@test.com",
      "valentina.castro@test.com",
      "laura.pineda@test.com",
    ],
    history: { completedRounds: 4 },
  },
  {
    name: "Interfacultades 2026-I",
    startDate: new Date("2026-03-13"),
    endDate: new Date("2026-03-15"),
    status: "FINISHED",
    roundsCount: 6,
    timeControl: "60+15",
    organizerEmail: "organizer@test.com",
    enrolledPlayerEmails: ALL_PLAYER_EMAILS,
    history: { completedRounds: 6 },
  },
  {
    name: "Copa Primavera 2026",
    startDate: new Date("2026-05-22"),
    endDate: new Date("2026-05-24"),
    status: "FINISHED",
    roundsCount: 5,
    timeControl: "90+30",
    organizerEmail: "organizer@test.com",
    enrolledPlayerEmails: [
      "ana.torres@test.com",
      "maria.lopez@test.com",
      "andres.gomez@test.com",
      "camila.rodriguez@test.com",
      "player@test.com",
      "sofia.martinez@test.com",
      "diego.ramirez@test.com",
      "laura.pineda@test.com",
    ],
    history: { completedRounds: 5 },
  },
  {
    name: "Liga Universitaria 2026-II",
    startDate: new Date("2026-09-19"),
    // Short enough that round 4 (the one being played) falls before today
    // (rounds are spread evenly across the dates).
    endDate: new Date("2026-09-26"),
    status: "IN_PROGRESS",
    roundsCount: 5,
    timeControl: "60+15",
    organizerEmail: "organizer@test.com",
    enrolledPlayerEmails: ALL_PLAYER_EMAILS.filter(
      (email) => !["valentina.castro@test.com", "laura.pineda@test.com"].includes(email),
    ),
    history: { completedRounds: 3, partialRound: true },
  },
];

/** Creates (or leaves untouched) a user account, optionally with a player profile. */
async function upsertUser(
  passwordHash: string,
  roleId: string,
  data: { name: string; email: string; player?: { universityCode: string; program: string; semester: number } },
) {
  return prisma.user.upsert({
    where: { email: data.email },
    update: {},
    create: {
      name: data.name,
      email: data.email,
      passwordHash,
      roleId,
      dataPolicyAccepted: true,
      dataPolicyAcceptedAt: new Date(),
      dataPolicyVersion: DATA_POLICY_VERSION,
      ...(data.player ? { player: { create: data.player } } : {}),
    },
    include: { player: true },
  });
}

/** Upserts the role catalog and returns each role's id by name. */
async function seedRoles(): Promise<Map<string, string>> {
  const roleIdByName = new Map<string, string>();
  for (const name of ROLES) {
    const role = await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
    roleIdByName.set(name, role.id);
  }
  return roleIdByName;
}

interface SeededDirectory {
  playerIdByEmail: Map<string, string>;
  coachIdByEmail: Map<string, string>;
  organizerId: string | undefined;
}

/** Upserts every demo account (one per role) and the extra players/coaches. */
async function seedAccounts(roleIdByName: Map<string, string>, passwordHash: string): Promise<SeededDirectory> {
  function roleId(name: string): string {
    const id = roleIdByName.get(name);
    if (!id) {
      throw new Error(`Role "${name}" wasn't seeded above — check ROLES is in sync.`);
    }
    return id;
  }

  const playerIdByEmail = new Map<string, string>();
  const coachIdByEmail = new Map<string, string>();
  let organizerId: string | undefined;

  for (const account of DEMO_ACCOUNTS) {
    const user = await upsertUser(passwordHash, roleId(account.role), account);
    if (user.player) playerIdByEmail.set(account.email, user.player.id);
    if (account.role === "COACH") coachIdByEmail.set(account.email, user.id);
    if (account.role === "ORGANIZER") organizerId = user.id;
  }

  for (const player of EXTRA_PLAYERS) {
    const user = await upsertUser(passwordHash, roleId("PLAYER"), {
      name: player.name,
      email: player.email,
      player: { universityCode: player.universityCode, program: player.program, semester: player.semester },
    });
    if (user.player) playerIdByEmail.set(player.email, user.player.id);
  }

  for (const coach of EXTRA_COACHES) {
    const user = await upsertUser(passwordHash, roleId("COACH"), coach);
    coachIdByEmail.set(coach.email, user.id);
  }

  return { playerIdByEmail, coachIdByEmail, organizerId };
}

/** Upserts clubs (HU23) and assigns the players that declare one. */
async function seedClubs(playerIdByEmail: Map<string, string>): Promise<void> {
  const clubIdByName = new Map<string, string>();
  for (const name of CLUBS) {
    const club = await prisma.club.upsert({ where: { name }, update: {}, create: { name } });
    clubIdByName.set(name, club.id);
  }

  for (const player of EXTRA_PLAYERS) {
    if (!player.club) continue;
    const playerId = playerIdByEmail.get(player.email);
    const clubId = clubIdByName.get(player.club);
    if (playerId && clubId) {
      await prisma.player.update({ where: { id: playerId }, data: { clubId } });
    }
  }
}

/** Links each coach to their declared players (HU24). */
async function seedCoachLinks(
  playerIdByEmail: Map<string, string>,
  coachIdByEmail: Map<string, string>,
): Promise<void> {
  for (const link of COACH_LINKS) {
    const coachId = coachIdByEmail.get(link.coachEmail);
    if (!coachId) continue;
    for (const playerEmail of link.playerEmails) {
      const playerId = playerIdByEmail.get(playerEmail);
      if (!playerId) continue;
      await prisma.coachPlayer.upsert({
        where: { coachId_playerId: { coachId, playerId } },
        update: {},
        create: { coachId, playerId },
      });
    }
  }
}

interface SeededTournament {
  seed: TournamentSeed;
  id: string;
}

/** Creates the demo tournaments (HU04-HU05) and enrolls the declared players (HU07). */
async function seedTournaments(
  playerIdByEmail: Map<string, string>,
  organizerId: string | undefined,
): Promise<SeededTournament[]> {
  if (!organizerId) return [];

  const seeded: SeededTournament[] = [];
  for (const tournament of TOURNAMENTS) {
    const existing = await prisma.tournament.findFirst({ where: { name: tournament.name } });
    const record =
      existing ??
      (await prisma.tournament.create({
        data: {
          name: tournament.name,
          startDate: tournament.startDate,
          endDate: tournament.endDate,
          status: tournament.status,
          roundsCount: tournament.roundsCount,
          timeControl: tournament.timeControl,
          organizerId,
        },
      }));

    for (const playerEmail of tournament.enrolledPlayerEmails) {
      const playerId = playerIdByEmail.get(playerEmail);
      if (!playerId) continue;
      await prisma.enrollment.upsert({
        where: { tournamentId_playerId: { tournamentId: record.id, playerId } },
        update: {},
        create: { tournamentId: record.id, playerId },
      });
    }
    seeded.push({ seed: tournament, id: record.id });
  }

  return seeded;
}

/** Plays out the history (rounds, results, standings) of every tournament that declares one. */
async function seedHistories(tournaments: SeededTournament[], playerIdByEmail: Map<string, string>): Promise<number> {
  const strengthByPlayerId = new Map(
    Object.entries(PLAYER_STRENGTH).map(([email, strength]) => [playerIdByEmail.get(email), strength]),
  );

  let played = 0;
  for (const { seed, id } of tournaments) {
    if (!seed.history) continue;
    const written = await seedCompetitionHistory(
      prisma,
      {
        tournamentId: id,
        name: seed.name,
        startDate: seed.startDate,
        endDate: seed.endDate,
        playerIds: seed.enrolledPlayerEmails.flatMap((email) => playerIdByEmail.get(email) ?? []),
        ...seed.history,
      },
      (playerId) => strengthByPlayerId.get(playerId) ?? DEFAULT_STRENGTH,
    );
    if (written) played += 1;
  }
  return played;
}

/** Prints a short summary of what got seeded, for whoever runs the script. */
function printSummary(directory: SeededDirectory): void {
  console.log(
    `\nSeeded ${directory.playerIdByEmail.size} players, ${directory.coachIdByEmail.size} coaches, ` +
      `${CLUBS.length} clubs, ${TOURNAMENTS.length} tournaments.`,
  );
  console.log(`\nDemo accounts (password: "${TEST_PASSWORD}"):`);
  for (const account of DEMO_ACCOUNTS) {
    console.log(`  ${account.role.padEnd(14)} ${account.email}`);
  }
  console.log(
    `\nExtra players and coaches share the same password ("${TEST_PASSWORD}"); see their emails in prisma/seed.ts.`,
  );
}

async function main() {
  const roleIdByName = await seedRoles();
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const directory = await seedAccounts(roleIdByName, passwordHash);

  await seedClubs(directory.playerIdByEmail);
  await seedCoachLinks(directory.playerIdByEmail, directory.coachIdByEmail);
  const tournaments = await seedTournaments(directory.playerIdByEmail, directory.organizerId);
  const played = await seedHistories(tournaments, directory.playerIdByEmail);
  const layouts = await seedDashboardLayouts(prisma, roleIdByName);

  printSummary(directory);
  console.log(
    `Played out ${played} tournament histories; default dashboards seeded for: ${layouts.join(", ") || "none (already set)"}.`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
