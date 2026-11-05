import nodemailer, { type Transporter } from "nodemailer";

import type { Env } from "../config/env";
import type { PrismaClient } from "../generated/prisma/client";

// #141: an email to each player of a tournament when one of its rounds is
// published, so they don't have to keep the room open to find their board.
// It says which round of which tournament and links to the room; it never
// names the opponent, or anyone else (the data policy's condition): who
// plays whom is read in the room, behind the session. Each player gets their
// own message, so no one sees the others' addresses.

/** What a notice says: the tournament, the round and where to see it. */
export interface RoundNotice {
  tournamentName: string;
  roundNumber: number;
  roomLink: string;
  settingsLink: string;
}

/** Gets a round's notice to a player. */
export interface RoundNoticeSender {
  send(email: string, notice: RoundNotice): Promise<void>;
}

/** Development only: says on the console that notices went out, without addresses. */
export const consoleRoundNoticeSender: RoundNoticeSender = {
  async send(_email, notice) {
    console.log(`[round-notice] Ronda ${notice.roundNumber} de ${notice.tournamentName}: ${notice.roomLink}`);
  },
};

/** The notice's subject and body, in Spanish (the university's language). */
export function roundNoticeMail(notice: RoundNotice): { subject: string; text: string } {
  return {
    subject: `Se publicó la ronda ${notice.roundNumber} de ${notice.tournamentName}`,
    text:
      `Se publicó la ronda ${notice.roundNumber} de ${notice.tournamentName}.\n\n` +
      `Mira tu mesa y tu color en la sala del torneo:\n${notice.roomLink}\n\n` +
      `Recibes este aviso porque juegas este torneo. Para dejar de recibirlo, desactívalo en tu cuenta:\n${notice.settingsLink}`,
  };
}

/** Emails the notice through a mail transport (SMTP in production). */
export function mailRoundNoticeSender(transporter: Transporter, from: string): RoundNoticeSender {
  return {
    async send(email, notice) {
      await transporter.sendMail({ from, to: email, ...roundNoticeMail(notice) });
    },
  };
}

/**
 * The sender the configuration calls for, like the password-reset one
 * (resetLinkSender.ts): email with a provider, the console on a development
 * machine, and none in production without a provider.
 */
export function createRoundNoticeSender(
  config: Pick<Env, "nodeEnv" | "smtpUrl" | "mailFrom">,
): RoundNoticeSender | null {
  if (config.smtpUrl && config.mailFrom) {
    return mailRoundNoticeSender(nodemailer.createTransport(config.smtpUrl), config.mailFrom);
  }
  return config.nodeEnv === "production" ? null : consoleRoundNoticeSender;
}

/**
 * #141: emails the players of a just-published round's tournament. Only
 * those still in it (not withdrawn), with an active account, who haven't
 * turned the notices off. A failed send doesn't stop the others; it's
 * reported back, never thrown: the round is already published.
 *
 * @returns how many notices went out and how many failed.
 */
export async function noticeRoundPublished(
  prisma: PrismaClient,
  sender: RoundNoticeSender,
  roundId: string,
  appUrl: string,
): Promise<{ sent: number; failed: number }> {
  const round = await prisma.round.findUniqueOrThrow({
    where: { id: roundId },
    select: { number: true, tournament: { select: { id: true, name: true } } },
  });
  const enrollments = await prisma.enrollment.findMany({
    where: {
      tournamentId: round.tournament.id,
      withdrawnAt: null,
      player: { user: { status: "ACTIVE", roundNotices: true } },
    },
    select: { player: { select: { user: { select: { email: true } } } } },
  });

  const base = appUrl.replace(/\/$/, "");
  const notice: RoundNotice = {
    tournamentName: round.tournament.name,
    roundNumber: round.number,
    roomLink: `${base}/torneos/${round.tournament.id}/sala`,
    settingsLink: `${base}/cuenta`,
  };
  const outcomes = await Promise.allSettled(
    enrollments.map((enrollment) => sender.send(enrollment.player.user.email, notice)),
  );
  const failed = outcomes.filter((outcome) => outcome.status === "rejected").length;
  return { sent: outcomes.length - failed, failed };
}
