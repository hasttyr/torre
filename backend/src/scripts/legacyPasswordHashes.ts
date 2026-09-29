import type { PrismaClient } from "../generated/prisma/client";
import { LEGACY_BCRYPT_PREFIX } from "../services/password";
import { runCommand } from "./runCommand";

// bcryptjs stays only to verify passwords hashed before scrypt, each of which
// is replaced at its owner's next sign-in (services/password.ts). This says
// how many are left, so it's clear when the dependency can go:
//
//   npm run build
//   npm run passwords:legacy

/** How many accounts still have a bcrypt password hash, said for whoever runs the command. */
export async function legacyPasswordHashesCommand(prisma: PrismaClient): Promise<string> {
  const count = await prisma.user.count({ where: { passwordHash: { startsWith: LEGACY_BCRYPT_PREFIX } } });
  if (count === 0) return "No bcrypt password hashes left: bcryptjs can be removed (see services/password.ts).";
  const accounts = count === 1 ? "1 account still has" : `${count} accounts still have`;
  return `${accounts} a bcrypt password hash; each is replaced when its owner next signs in.`;
}

if (require.main === module) {
  void runCommand(legacyPasswordHashesCommand);
}
