import type { Request, Response } from "express";

import { env } from "../config/env";
import { logger } from "../config/logger";
import { roundNoticeSender } from "../config/mailer";
import { prisma } from "../config/prisma";
import { actorOf } from "../middlewares/auth";
import { noticeRoundPublished } from "../services/roundNotices";
import { discardRound, generateRound, listRounds, publishRound, swapPlayers } from "../services/rounds.service";
import { idParam } from "../validators/params";
import { parseOrThrow } from "../validators/parse";
import { generateRoundSchema, swapPlayersSchema } from "../validators/rounds.schemas";

/** GET /tournaments/:id/rounds — the tournament's rounds with their pairings (HU18). */
export async function list(req: Request, res: Response): Promise<void> {
  res.status(200).json(await listRounds(prisma, idParam(req, "id"), actorOf(req)));
}

/** POST /tournaments/:id/rounds — pairs the next round as a draft (HU08, HU28). */
export async function generate(req: Request, res: Response): Promise<void> {
  // The body is optional: only an authorized rematch (RN-02) carries one.
  const options = parseOrThrow(generateRoundSchema, req.body ?? {});
  res.status(201).json(await generateRound(prisma, idParam(req, "id"), actorOf(req), options));
}

/** DELETE /rounds/:id — discards a draft round. */
export async function discard(req: Request, res: Response): Promise<void> {
  await discardRound(prisma, idParam(req, "id"), actorOf(req));
  res.status(204).send();
}

/** POST /rounds/:id/swap — swaps two players' seats in a draft round (HU29). */
export async function swap(req: Request, res: Response): Promise<void> {
  const data = parseOrThrow(swapPlayersSchema, req.body);
  res.status(200).json(await swapPlayers(prisma, idParam(req, "id"), data, actorOf(req)));
}

/** POST /rounds/:id/publish — publishes a draft round (HU09). */
export async function publish(req: Request, res: Response): Promise<void> {
  const roundId = idParam(req, "id");
  res.status(200).json(await publishRound(prisma, roundId, actorOf(req)));
  // #141: after answering, so a slow mail provider never holds up the
  // organizer; the round is published whatever happens to the notices.
  if (roundNoticeSender) {
    noticeRoundPublished(prisma, roundNoticeSender, roundId, env.appUrl)
      .then((outcome) => logger.info({ roundId, ...outcome }, "round notices sent"))
      .catch((error: unknown) => logger.error({ roundId, err: error }, "round notices failed"));
  }
}
