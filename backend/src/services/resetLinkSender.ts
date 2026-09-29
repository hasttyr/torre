import nodemailer, { type Transporter } from "nodemailer";

import type { Env } from "../config/env";

/** Gets a one-time password-reset link (HU19) to the owner of an account. */
export interface ResetLinkSender {
  send(email: string, link: string): Promise<void>;
}

/** Development only: prints the link to the server console instead of emailing it. */
export const consoleResetLinkSender: ResetLinkSender = {
  async send(email, link) {
    console.log(`[password-reset] Enlace de restablecimiento para ${email}: ${link}`);
  },
};

/** Emails the link through a mail transport (SMTP in production). */
export function mailResetLinkSender(transporter: Transporter, from: string): ResetLinkSender {
  return {
    async send(email, link) {
      await transporter.sendMail({
        from,
        to: email,
        subject: "Restablece tu contraseña de Torre Central Hub",
        text:
          "Recibimos una solicitud para restablecer la contraseña de tu cuenta.\n\n" +
          `Para elegir una nueva, abre este enlace (vale una sola vez, durante una hora):\n${link}\n\n` +
          "Si no la pediste, ignora este correo: tu contraseña no cambia.",
      });
    },
  };
}

/**
 * The sender the configuration calls for: email when a provider is
 * configured, the console on a development machine, and none in production
 * without a provider. Never the console there: a reset token in the logs lets
 * anyone who reads them take over the account. With none, password recovery
 * is off and says so (PASSWORD_RESET_UNAVAILABLE); the rest of the app runs.
 */
export function createResetLinkSender(config: Pick<Env, "nodeEnv" | "smtpUrl" | "mailFrom">): ResetLinkSender | null {
  if (config.smtpUrl && config.mailFrom) {
    return mailResetLinkSender(nodemailer.createTransport(config.smtpUrl), config.mailFrom);
  }
  return config.nodeEnv === "production" ? null : consoleResetLinkSender;
}
