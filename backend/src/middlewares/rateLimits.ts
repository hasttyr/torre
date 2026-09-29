import type { Request } from "express";
import { ipKeyGenerator, rateLimit, type AugmentedRequest, type Store } from "express-rate-limit";

import type { ApiErrorBody } from "../contracts/errors";
import { HttpError } from "../errors/apiErrors";
import { errorBody } from "./errorHandler";

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
  return `${address(req)}|${account}`;
}

/** The client's address (a whole IPv6 /56 counts as one, as express-rate-limit recommends). */
function address(req: Request): string {
  return ipKeyGenerator(req.ip ?? "");
}

/** The 429 body, in the API's usual error shape, saying when to try again. */
function tooManyAttempts(req: Request): ApiErrorBody {
  // The limiter has set req.rateLimit by the time it asks for this message.
  const resetTime = (req as AugmentedRequest).rateLimit.resetTime;
  const minutes = resetTime ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / MINUTE_MS)) : 1;
  const message = `Demasiados intentos. Vuelve a intentarlo en ${minutes} ${minutes === 1 ? "minuto" : "minutos"}.`;
  return errorBody(new HttpError("RATE_LIMITED", { minutes }, { message }));
}

interface LimitOptions {
  windowMinutes: number;
  limit: number;
  skipSuccessfulRequests?: boolean;
  keyGenerator: (req: Request) => string;
  /** Where the counts live: this instance's memory unless given. */
  store?: Store;
}

/** A store for one limiter, told its name so each keeps its counts apart. */
export type RateLimitStoreFactory = (prefix: string) => Store;

function limit(options: LimitOptions) {
  return rateLimit({
    windowMs: options.windowMinutes * MINUTE_MS,
    limit: options.limit,
    skipSuccessfulRequests: options.skipSuccessfulRequests ?? false,
    keyGenerator: options.keyGenerator,
    store: options.store,
    message: tooManyAttempts,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });
}

/**
 * Rate limits for the API. Built per app, and mounted after the JSON body
 * parser, since some read the email from the body.
 *
 * @param sharedStore - Where the sign-in, sign-up and password-reset limits
 * keep their counts, so every API instance shares them and a restart doesn't
 * wipe them (the server passes PostgreSQL's, see rateLimitStore.ts). Without
 * it, this instance's memory. The per-address caps are sized for a campus
 * behind one NAT address.
 *
 * @remarks
 * The ceiling on every request stays in memory, per instance: a flood guard
 * that doesn't cost each request a database round trip.
 */
export function createRateLimits(sharedStore?: RateLimitStoreFactory) {
  const shared = (limiter: string) => sharedStore?.(`${limiter}:`);
  return {
    // Every request: a generous ceiling against floods, far above what a
    // classroom sharing one address does.
    api: limit({ windowMinutes: 15, limit: 5000, keyGenerator: address }),
    // Guessing one account's password. Only failed attempts count: someone
    // who signs in fine is never slowed down.
    login: limit({
      windowMinutes: 15,
      limit: 10,
      skipSuccessfulRequests: true,
      keyGenerator: addressAndEmail,
      store: shared("login"),
    }),
    // Password spraying: a few guesses at each of many accounts, which the
    // per-account limit above never sees.
    loginPerAddress: limit({
      windowMinutes: 15,
      limit: 100,
      skipSuccessfulRequests: true,
      keyGenerator: address,
      store: shared("login-address"),
    }),
    // Account spam, and the password hashing each sign-up costs.
    register: limit({ windowMinutes: 60, limit: 10, keyGenerator: address, store: shared("register") }),
    passwordReset: limit({
      windowMinutes: 60,
      limit: 5,
      keyGenerator: addressAndEmail,
      store: shared("password-reset"),
    }),
  };
}
