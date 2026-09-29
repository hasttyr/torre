import { z } from "zod";

import { HttpError } from "../errors/apiErrors";
import type { PrismaClient } from "../generated/prisma/client";
import { hashPassword } from "../services/password";
import { ensureDashboardLayouts, ensureRoles } from "../services/referenceData";
import { emailSchema, nameSchema, newPasswordSchema } from "../validators/fields";
import { parseOrThrow } from "../validators/parse";
import { runCommand } from "./runCommand";

// Prepares a new database, such as production's, where the seed refuses to
// run (its demo accounts share a password written in this repository):
//
//   npm run build
//   ADMIN_NAME="…" ADMIN_EMAIL="…" ADMIN_PASSWORD="…" npm run bootstrap
//
// The password comes from the environment of that one run, never from code.

const administratorSchema = z.object({ name: nameSchema, email: emailSchema, password: newPasswordSchema });

export interface BootstrapResult {
  /** false when an active administrator already existed: nobody was created. */
  administratorCreated: boolean;
}

/**
 * Creates the reference data a database lacks (roles, default dashboards)
 * and, unless an active administrator exists already, the first one. Safe to
 * run again: it only fills in what's missing.
 *
 * @throws {HttpError} VALIDATION_FAILED for a name, email or password the
 * registration rules would refuse; EMAIL_TAKEN when the email belongs to an
 * account, which is never turned into an administrator this way.
 */
export async function bootstrap(prisma: PrismaClient, administrator: unknown): Promise<BootstrapResult> {
  const input = parseOrThrow(administratorSchema, administrator);
  const roleIdByName = await ensureRoles(prisma);
  await ensureDashboardLayouts(prisma, roleIdByName);

  const activeAdministrators = await prisma.user.count({
    where: { status: "ACTIVE", role: { name: "ADMINISTRATOR" } },
  });
  if (activeAdministrators > 0) {
    return { administratorCreated: false };
  }

  const email = input.email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) {
    throw new HttpError("EMAIL_TAKEN");
  }
  await prisma.user.create({
    data: {
      name: input.name,
      email,
      passwordHash: await hashPassword(input.password),
      role: { connect: { name: "ADMINISTRATOR" } },
    },
  });
  return { administratorCreated: true };
}

/**
 * The command: the administrator's details from ADMIN_NAME, ADMIN_EMAIL and
 * ADMIN_PASSWORD, and what was done, for whoever runs it.
 *
 * @throws {HttpError} as {@link bootstrap} does.
 */
export async function bootstrapFromEnvironment(
  prisma: PrismaClient,
  env: Record<string, string | undefined>,
): Promise<string> {
  const { administratorCreated } = await bootstrap(prisma, {
    name: env.ADMIN_NAME,
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD,
  });
  return administratorCreated
    ? `Roles and dashboards ready; administrator ${env.ADMIN_EMAIL} created.`
    : "Roles and dashboards ready; an active administrator already exists, so none was created.";
}

if (require.main === module) {
  void runCommand((prisma) => bootstrapFromEnvironment(prisma, process.env));
}
