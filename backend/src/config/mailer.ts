import { createResetLinkSender } from "../services/resetLinkSender";
import { createRoundNoticeSender } from "../services/roundNotices";
import { env } from "./env";
import { logger } from "./logger";

// Built once at boot, like config/prisma.ts: the transport is shared by every request.
export const resetLinkSender = createResetLinkSender(env);
// #141: the round notices go through the same provider.
export const roundNoticeSender = createRoundNoticeSender(env);

if (!resetLinkSender) {
  logger.warn(
    "SMTP_URL and MAIL_FROM aren't set: password recovery and round notices are off until a mail provider is configured",
  );
}
