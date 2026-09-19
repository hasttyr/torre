import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

/** Hashes a plaintext password for storage. */
export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/** Checks a plaintext password against a stored hash. */
export function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
