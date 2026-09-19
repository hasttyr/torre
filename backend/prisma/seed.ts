import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Role catalog (RF03). See docs/media/image1.png / image7.png.
const ROLES = ["ORGANIZER", "ARBITER", "PLAYER", "COACH", "ADMINISTRATOR"];

async function main() {
  for (const name of ROLES) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
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
