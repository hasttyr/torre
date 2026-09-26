/**
 * Whether a Prisma error is a unique-constraint violation (P2002): the
 * database's own answer to "that already exists", including the race where
 * two requests pass the same "does it exist?" check at the same time.
 */
export function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}
