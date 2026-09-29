import { createResetLinkSender } from "../services/resetLinkSender";
import { env } from "./env";
import { logger } from "./logger";

// Built once at boot, like config/prisma.ts: the transport is shared by every request.
export const resetLinkSender = createResetLinkSender(env);

if (!resetLinkSender) {
  logger.warn("SMTP_URL and MAIL_FROM aren't set: password recovery is off until a mail provider is configured");
}
