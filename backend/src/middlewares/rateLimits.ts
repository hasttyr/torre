import type { Request } from "express";
import { ipKeyGenerator, rateLimit, type AugmentedRequest } from "express-rate-limit";

const MINUTE_MS = 60_000;

/**
 * Who is trying: the client's address plus the email being tried. Keying by
 * address and email together limits guessing per account, not across
 * accounts: classmates behind one campus address don't lock each other out
 * (each has their own email), and a stranger elsewhere can't lock out a
 * victim by failing logins for their email from a different address.
 */
function addressAndEmail(req: Request): string {
  const email: unknown = req.body?.email;
  const account = typeof email === "string" ? email.trim().toLowerCase() : "";
  return `${ipKeyGenerator(req.ip ?? "")}|${account}`;
}

/** The 429 body, in the API's usual `{ error }` shape, saying when to try again. */
function tooManyAttempts(req: Request): { error: string } {
  // The limiter has set req.rateLimit by the time it asks for this message.
  const resetTime = (req as AugmentedRequest).rateLimit.resetTime;
  const minutes = resetTime ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / MINUTE_MS)) : 1;
  return { error: `Demasiados intentos. Vuelve a intentarlo en ${minutes} ${minutes === 1 ? "minuto" : "minutos"}.` };
}

function limitPerAddressAndEmail(options: { windowMinutes: number; limit: number; skipSuccessfulRequests?: boolean }) {
  return rateLimit({
    windowMs: options.windowMinutes * MINUTE_MS,
    limit: options.limit,
    skipSuccessfulRequests: options.skipSuccessfulRequests ?? false,
    keyGenerator: addressAndEmail,
    message: tooManyAttempts,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });
}

/**
 * Brute-force guards for the unauthenticated auth endpoints. Built per app
 * (counters live in memory, in that app instance), and mounted after the
 * JSON body parser, since they read the email from the body.
 */
export function createAuthRateLimits() {
  return {
    // Only failed attempts count: someone who signs in fine is never slowed down.
    login: limitPerAddressAndEmail({ windowMinutes: 15, limit: 10, skipSuccessfulRequests: true }),
    passwordReset: limitPerAddressAndEmail({ windowMinutes: 60, limit: 5 }),
  };
}
