import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import { createAuthRateLimits } from "./middlewares/rateLimits";
import { router } from "./routes";

export function createApp() {
  const app = express();
  // Behind a reverse proxy, req.ip (and so the rate limits' key) must come
  // from X-Forwarded-For, trusting exactly as many hops as TRUST_PROXY says.
  if (env.trustProxy !== undefined) app.set("trust proxy", env.trustProxy);

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin }));
  app.use(morgan("dev"));
  app.use(express.json());

  const authLimits = createAuthRateLimits();
  app.post("/api/auth/login", authLimits.login);
  app.post("/api/auth/password/forgot", authLimits.passwordReset);

  app.use("/api", router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
