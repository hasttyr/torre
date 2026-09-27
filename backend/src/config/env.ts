import "dotenv/config";

/** Reads a required environment variable, throwing at startup if it's missing. */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * TRUST_PROXY as Express's "trust proxy" setting: a number is how many
 * proxy hops to trust; anything else ("loopback", a subnet…) goes through
 * as-is. Unset means no proxy is trusted, so X-Forwarded-For can't be
 * used to pose as another address.
 */
export function parseTrustProxy(value: string | undefined): number | string | undefined {
  if (!value) return undefined;
  return /^\d+$/.test(value) ? Number(value) : value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "1d",
  // Time zone for human-readable timestamps the server writes itself (the
  // "generated at" line of exported PDFs). The university is in Colombia.
  timeZone: process.env.APP_TIMEZONE ?? "America/Bogota",
};
