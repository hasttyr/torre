import { prisma as appPrisma } from "../config/prisma";
import type { PrismaClient } from "../generated/prisma/client";

/** A one-off command: does its work and says what it did, for whoever runs it. */
export type Command = (prisma: PrismaClient, args: string[]) => Promise<string>;

interface CommandContext {
  prisma: PrismaClient;
  output: Pick<Console, "log" | "error">;
  args: string[];
}

/**
 * Runs a one-off command (`npm run bootstrap`, …) against the app's database,
 * with the command line's arguments: prints what it says, or why it failed
 * (exit code 1), and lets go of the database either way.
 */
export async function runCommand(
  command: Command,
  { prisma = appPrisma, output = console, args = process.argv.slice(2) }: Partial<CommandContext> = {},
): Promise<void> {
  try {
    output.log(await command(prisma, args));
  } catch (error) {
    output.error(`Failed: ${(error as Error).message}`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
