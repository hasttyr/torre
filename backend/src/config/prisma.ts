import { PrismaClient } from "@prisma/client";

// In development, `tsx watch` reloads this module on every change; without
// this caching on globalThis, each reload would create a new PrismaClient
// without closing the previous one, exhausting the PostgreSQL connection pool.
// https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections#prevent-hot-reloading-from-creating-new-instances-of-prismaclient
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
