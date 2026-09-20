import { PrismaClient } from "@prisma/client";

import { DATA_POLICY_VERSION } from "../src/config/dataPolicy";
import { hashPassword } from "../src/services/password";

const prisma = new PrismaClient();

// Role catalog (RF03). See docs/media/image1.png / image7.png.
const ROLES = ["ORGANIZER", "ARBITER", "PLAYER", "COACH", "ADMINISTRATOR"];

// One account per role, for manual/exploratory testing. Same password on
// purpose (easy to remember while testing); never used outside a local dev
// database. Upserted with update:{} like the roles above, so re-running the
// seed never clobbers a password changed by hand while testing.
const TEST_PASSWORD = "Test1234";

interface TestUserSeed {
  role: string;
  name: string;
  email: string;
  player?: { universityCode: string; program: string; semester: number };
}

const TEST_USERS: TestUserSeed[] = [
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

async function main() {
  const roleIdByName = new Map<string, string>();
  for (const name of ROLES) {
    const role = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    roleIdByName.set(name, role.id);
  }

  const passwordHash = await hashPassword(TEST_PASSWORD);

  for (const testUser of TEST_USERS) {
    const roleId = roleIdByName.get(testUser.role);
    if (!roleId) {
      throw new Error(`Role "${testUser.role}" wasn't seeded above — check ROLES/TEST_USERS are in sync.`);
    }

    await prisma.user.upsert({
      where: { email: testUser.email },
      update: {},
      create: {
        name: testUser.name,
        email: testUser.email,
        passwordHash,
        roleId,
        dataPolicyAccepted: true,
        dataPolicyAcceptedAt: new Date(),
        dataPolicyVersion: DATA_POLICY_VERSION,
        ...(testUser.player ? { player: { create: testUser.player } } : {}),
      },
    });
  }

  console.log(`\nSeeded ${TEST_USERS.length} test accounts (password: "${TEST_PASSWORD}"):`);
  for (const testUser of TEST_USERS) {
    console.log(`  ${testUser.role.padEnd(14)} ${testUser.email}`);
  }
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
