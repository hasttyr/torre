import { PrismaClient } from "@prisma/client";

// En desarrollo, `tsx watch` recarga este módulo en cada cambio; sin este
// cacheo en globalThis, cada recarga crearía un PrismaClient nuevo sin
// cerrar el anterior y agotaría el pool de conexiones a PostgreSQL.
// https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections#prevent-hot-reloading-from-creating-new-instances-of-prismaclient
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
