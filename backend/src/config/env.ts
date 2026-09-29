import { z } from "zod";

import { loadLocalEnvFile } from "./localEnvFile";

/**
 * TRUST_PROXY as Express's "trust proxy" setting: a number is how many
 * proxy hops to trust; anything else ("loopback", a subnet…) goes through
 * as-is. Unset means no proxy is trusted, so X-Forwarded-For can't be
 * used to pose as another address.
 */
export function parseTrustProxy(value: string | undefined): number | string | undefined {
  if (!value) return undefined;
  if (/^(true|false)$/i.test(value)) {
    throw new Error(
      "TRUST_PROXY must be a number of proxy hops (e.g. 1) or an address/subnet list; " +
        "'true' would trust any client's X-Forwarded-For.",
    );
  }
  return /^\d+$/.test(value) ? Number(value) : value;
}

// With a shorter (or published, like .env.example's "changeme") secret,
// anyone could sign a token for any user id. 32 hex characters = 128 bits.
const MIN_PRODUCTION_SECRET_LENGTH = 32;

const envSchema = z
  .object({
    NODE_ENV: z.string().default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    // The frontend's origin, as browsers send it in the Origin header (CORS
    // compares it literally): a pasted trailing slash or path is dropped.
    CORS_ORIGIN: z
      .url({ protocol: /^https?$/ })
      .default("http://localhost:5173")
      .transform((url) => new URL(url).origin),
    // The frontend's public address: the base of the links the API sends by
    // email (password reset). Usually the same origin CORS lets in.
    APP_URL: z.string().url().optional(),
    TRUST_PROXY: z.string().optional(),
    DATABASE_URL: z.string(),
    JWT_SECRET: z.string(),
    JWT_EXPIRES_IN: z.string().default("1d"),
    // Time zone for human-readable timestamps the server writes itself (the
    // "generated at" line of exported PDFs). The university is in Colombia.
    APP_TIMEZONE: z.string().default("America/Bogota"),
    // pino's levels (trace, debug, info, warn, error, fatal, silent). Tests
    // run silent unless they ask for a log.
    LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"]).optional(),
    // Mail provider for password-reset links, e.g. smtps://user:pass@host:465.
    // Without one, production runs with password recovery off (config/mailer.ts).
    SMTP_URL: z.string().url().optional(),
    MAIL_FROM: z.string().optional(),
  })
  .superRefine((vars, ctx) => {
    if (vars.NODE_ENV === "production") {
      if (vars.JWT_SECRET.length < MIN_PRODUCTION_SECRET_LENGTH) {
        ctx.addIssue({
          code: "custom",
          path: ["JWT_SECRET"],
          message: `must be at least ${MIN_PRODUCTION_SECRET_LENGTH} random characters in production (e.g. openssl rand -hex 32)`,
        });
      }
    }
    if (vars.SMTP_URL && !vars.MAIL_FROM) {
      ctx.addIssue({ code: "custom", path: ["MAIL_FROM"], message: "is required when SMTP_URL is set" });
    }
  });

/**
 * Validates the process environment and shapes it into the app's settings.
 *
 * @throws {Error} listing every invalid or missing variable, so a bad deploy
 * fails at boot instead of on the first request that needs the value.
 */
export function loadEnv(source: Record<string, string | undefined>) {
  // An empty variable (`PORT=` in a .env file) means "not set", not "".
  const defined = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ""));
  const parsed = envSchema.safeParse(defined);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `- ${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid environment configuration:\n${problems.join("\n")}`);
  }

  const vars = parsed.data;
  return {
    nodeEnv: vars.NODE_ENV,
    port: vars.PORT,
    corsOrigin: vars.CORS_ORIGIN,
    appUrl: vars.APP_URL ?? vars.CORS_ORIGIN,
    trustProxy: parseTrustProxy(vars.TRUST_PROXY),
    databaseUrl: vars.DATABASE_URL,
    jwtSecret: vars.JWT_SECRET,
    jwtExpiresIn: vars.JWT_EXPIRES_IN,
    timeZone: vars.APP_TIMEZONE,
    logLevel: vars.LOG_LEVEL ?? (vars.NODE_ENV === "test" ? "silent" : "info"),
    smtpUrl: vars.SMTP_URL,
    mailFrom: vars.MAIL_FROM,
  };
}

export type Env = ReturnType<typeof loadEnv>;

loadLocalEnvFile();

export const env: Env = loadEnv(process.env);
