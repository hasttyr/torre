import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

import bcrypt from "bcryptjs";

// scrypt (built into Node, memory-hard, run off the event loop) with one of
// the parameter sets OWASP's Password Storage Cheat Sheet lists: 16 MiB of
// memory per hash. bcrypt, used before, silently ignores everything past
// byte 72 and, as bcryptjs, blocks the event loop while it hashes. Old bcrypt
// hashes still verify, and get replaced on the user's next successful login.
const COST = { N: 2 ** 14, r: 8, p: 5 } as const;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;
const PREFIX = "scrypt";
/** How every bcrypt hash starts ($2a$, $2b$…): the scheme before scrypt. */
export const LEGACY_BCRYPT_PREFIX = "$2";

function deriveKey(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, options, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

/** Hashes a plaintext password for storage, as `scrypt$N$r$p$salt$key` (base64). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await deriveKey(password, salt, COST);
  return [PREFIX, COST.N, COST.r, COST.p, salt.toString("base64"), key.toString("base64")].join("$");
}

async function compareScrypt(password: string, stored: string): Promise<boolean> {
  const [, N, r, p, salt, key] = stored.split("$");
  if (!N || !r || !p || !salt || !key) return false;
  const expected = Buffer.from(key, "base64");
  // Verified with the parameters it was made with, so raising COST later
  // doesn't lock anyone out.
  const actual = await deriveKey(password, Buffer.from(salt, "base64"), { N: Number(N), r: Number(r), p: Number(p) });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Checks a plaintext password against a stored hash (current scrypt or legacy bcrypt). */
export async function comparePassword(password: string, stored: string): Promise<boolean> {
  if (stored.startsWith(`${PREFIX}$`)) return compareScrypt(password, stored);
  if (stored.startsWith(LEGACY_BCRYPT_PREFIX)) return bcrypt.compare(password, stored);
  return false;
}

/** Whether a stored hash was made with an older scheme and should be replaced once the password is known. */
export function needsRehash(stored: string): boolean {
  return !stored.startsWith(`${PREFIX}$${COST.N}$${COST.r}$${COST.p}$`);
}
