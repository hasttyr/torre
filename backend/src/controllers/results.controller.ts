import { prisma } from "../config/prisma";
import { asyncHandler } from "../middlewares/asyncHandler";
import { correctResult, recordResult } from "../services/results.service";
import { parseOrThrow } from "../validators/parse";
import { correctResultSchema, recordResultSchema } from "../validators/rounds.schemas";

/** POST /matches/:id/result — records a game's result (HU10). */
export const record = asyncHandler(async (req, res) => {
  const { value } = parseOrThrow(recordResultSchema, req.body);
  await recordResult(prisma, String(req.params.id), value, req.user!);
  res.status(204).send();
});

/** PUT /matches/:id/result — corrects an already recorded result (HU11). */
export const correct = asyncHandler(async (req, res) => {
  const { value, reason } = parseOrThrow(correctResultSchema, req.body);
  await correctResult(prisma, String(req.params.id), value, reason, req.user!);
  res.status(204).send();
});
