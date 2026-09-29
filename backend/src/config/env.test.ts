import { describe, expect, it } from "vitest";

import { loadEnv, parseTrustProxy } from "./env";

const STRONG_SECRET = "f3a9c1d7e5b2a8c4f6e0d9b3a7c5e1f2";

// The minimum a development machine needs.
const base = {
  DATABASE_URL: "postgresql://torre:torre@localhost:5432/torre",
  JWT_SECRET: "dev-secret",
};

// The minimum production needs.
const production = {
  ...base,
  NODE_ENV: "production",
  JWT_SECRET: STRONG_SECRET,
  SMTP_URL: "smtps://mailer:password@smtp.example.com:465",
  MAIL_FROM: "Torre Central Hub <no-reply@example.com>",
  APP_URL: "https://torre.example.com",
};

describe("loadEnv", () => {
  it("fills in the documented defaults for a development machine", () => {
    expect(loadEnv(base)).toMatchObject({
      nodeEnv: "development",
      port: 4000,
      corsOrigin: "http://localhost:5173",
      appUrl: "http://localhost:5173",
      trustProxy: undefined,
      jwtExpiresIn: "1d",
      timeZone: "America/Bogota",
      smtpUrl: undefined,
    });
  });

  it("keeps CORS_ORIGIN as the bare origin browsers send, even if pasted with a trailing slash", () => {
    const env = loadEnv({ ...base, CORS_ORIGIN: "https://torre-roan.vercel.app/" });

    expect(env.corsOrigin).toBe("https://torre-roan.vercel.app");
  });

  it("refuses a CORS_ORIGIN that isn't a web address, instead of rejecting every browser later", () => {
    for (const CORS_ORIGIN of ["torre-roan.vercel.app", "localhost:5173"]) {
      expect(() => loadEnv({ ...base, CORS_ORIGIN })).toThrow(/CORS_ORIGIN/);
    }
  });

  it("hands the database's address to the Prisma client", () => {
    expect(loadEnv(base).databaseUrl).toBe(base.DATABASE_URL);
  });

  it("reads PORT as a number", () => {
    expect(loadEnv({ ...base, PORT: "8080" }).port).toBe(8080);
  });

  it("refuses a PORT that isn't a valid port number instead of listening on NaN", () => {
    expect(() => loadEnv({ ...base, PORT: "http" })).toThrow(/PORT/);
    expect(() => loadEnv({ ...base, PORT: "70000" })).toThrow(/PORT/);
  });

  it("refuses to start without a database or a JWT secret, naming what's missing", () => {
    expect(() => loadEnv({ JWT_SECRET: "dev-secret" })).toThrow(/DATABASE_URL/);
    expect(() => loadEnv({ DATABASE_URL: base.DATABASE_URL })).toThrow(/JWT_SECRET/);
  });

  it("accepts a production configuration with a strong secret and a mail provider", () => {
    expect(loadEnv(production)).toMatchObject({ nodeEnv: "production", jwtSecret: STRONG_SECRET });
  });

  it("refuses a guessable JWT secret in production, where anyone could sign tokens with it", () => {
    expect(() => loadEnv({ ...production, JWT_SECRET: "changeme" })).toThrow(/JWT_SECRET/);
    expect(() => loadEnv({ ...production, JWT_SECRET: "a-31-character-secret-is-short!" })).toThrow(/JWT_SECRET/);
  });

  it("starts in production without a mail provider: only password recovery is off, not the whole app", () => {
    const env = loadEnv({ ...production, SMTP_URL: undefined, MAIL_FROM: undefined });

    expect(env.nodeEnv).toBe("production");
    expect(env.smtpUrl).toBeUndefined();
  });

  it("needs a sender address whenever a mail provider is configured", () => {
    expect(() => loadEnv({ ...production, MAIL_FROM: undefined })).toThrow(/MAIL_FROM/);
  });
});

describe("parseTrustProxy", () => {
  it("leaves proxies untrusted when TRUST_PROXY isn't set, so a client can't forge its address", () => {
    expect(parseTrustProxy(undefined)).toBeUndefined();
    expect(parseTrustProxy("")).toBeUndefined();
  });

  it("reads a number as how many proxy hops to trust", () => {
    expect(parseTrustProxy("1")).toBe(1);
  });

  it("passes anything else through, as Express understands it (e.g. 'loopback', a subnet)", () => {
    expect(parseTrustProxy("loopback")).toBe("loopback");
    expect(parseTrustProxy("10.0.0.0/8")).toBe("10.0.0.0/8");
  });

  it("rejects 'true'/'false' instead of letting Express crash later with a cryptic IP-address error", () => {
    for (const value of ["true", "TRUE", "True", "false", "FALSE"]) {
      expect(() => parseTrustProxy(value)).toThrow(/TRUST_PROXY must be a number of proxy hops/);
    }
  });
});
