import "dotenv/config";

/** Reads a required environment variable, throwing at startup if it's missing. */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "1d",
  // Time zone for human-readable timestamps the server writes itself (the
  // "generated at" line of exported PDFs). The university is in Colombia.
  timeZone: process.env.APP_TIMEZONE ?? "America/Bogota",
};
