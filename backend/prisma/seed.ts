import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Catálogo de roles (RF03). Ver docs/media/image1.png / image7.png.
const ROLES = ["ORGANIZADOR", "ARBITRO", "JUGADOR", "ENTRENADOR", "ADMINISTRADOR"];

async function main() {
  for (const nombre of ROLES) {
    await prisma.rol.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
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
