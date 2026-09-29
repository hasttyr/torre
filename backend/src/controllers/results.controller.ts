import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import { actorOf } from "../middlewares/auth";
import { correctResult, recordResult } from "../services/results.service";
import { idParam } from "../validators/params";
import { parseOrThrow } from "../validators/parse";
import { correctResultSchema, recordResultSchema } from "../validators/rounds.schemas";

/** POST /matches/:id/result — records a game's result (HU10). */
export async function record(req: Request, res: Response): Promise<void> {
  const { value } = parseOrThrow(recordResultSchema, req.body);
  await recordResult(prisma, idParam(req, "id"), value, actorOf(req));
  res.status(204).send();
}

/** PUT /matches/:id/result — corrects an already recorded result (HU11). */
export async function correct(req: Request, res: Response): Promise<void> {
  const { value, reason } = parseOrThrow(correctResultSchema, req.body);
  await correctResult(prisma, idParam(req, "id"), value, reason, actorOf(req));
  res.status(204).send();
}
