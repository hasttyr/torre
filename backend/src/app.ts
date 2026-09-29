import cors from "cors";
import express from "express";
import helmet from "helmet";

import { env } from "./config/env";
import { logger } from "./config/logger";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import { createRateLimits, type RateLimitStoreFactory } from "./middlewares/rateLimits";
import { requestLogger } from "./middlewares/requestLogger";
import { rejectCrossSiteWrites } from "./middlewares/sessionCookie";
import { router } from "./routes";

export interface AppOptions {
  /** Where the sign-in, sign-up and password-reset limits count (see createRateLimits); memory unless given. */
  rateLimitStore?: RateLimitStoreFactory;
}

export function createApp(options: AppOptions = {}) {
  const app = express();
  // Behind a reverse proxy, req.ip (and so the rate limits' key) must come
  // from X-Forwarded-For, trusting exactly as many hops as TRUST_PROXY says.
  if (env.trustProxy !== undefined) app.set("trust proxy", env.trustProxy);

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin }));
  app.use(requestLogger(logger));
  // Answers depend on who asks and carry personal data: no cache on the way
  // (the Vercel proxy's CDN) nor the browser of a shared computer keeps them.
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use(express.json());

  const limits = createRateLimits(options.rateLimitStore);
  app.use("/api", limits.api);
  app.post("/api/auth/login", limits.loginPerAddress, limits.login);
  app.post("/api/auth/register", limits.register);
  app.post("/api/auth/password/forgot", limits.passwordReset);

  app.use("/api", rejectCrossSiteWrites([env.corsOrigin, env.appUrl]));
  app.use("/api", router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
