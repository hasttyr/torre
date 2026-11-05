import { z } from "zod";

import { idSchema, MAX_LENGTH, reasonSchema, tooLong } from "./fields";
import { GAME_RESULTS, type GameResult } from "../contracts/catalogs";

// RN-03: the results a person can record. "BYE" is also in the DB catalog,
// but only the pairing engine assigns it (HU28), never a user.
export { GAME_RESULTS, type GameResult };

const resultValue = z.enum(GAME_RESULTS, {
  error: "El resultado debe ser 1-0, 0-1, 1/2-1/2 o una incomparecencia: 1F-0F, 0F-1F o 0F-0F",
});

export const recordResultSchema = z.object({ value: resultValue });

export const correctResultSchema = z.object({
  value: resultValue,
  reason: reasonSchema.optional(),
});

// HU29/RN-09: a manual adjustment must say why.
const adjustmentReason = z
  .string({ error: "Indica el motivo del ajuste (RN-09)" })
  .trim()
  .min(3, "Indica el motivo del ajuste (RN-09)")
  .max(MAX_LENGTH.reason, tooLong(MAX_LENGTH.reason));

export const swapPlayersSchema = z.object({
  playerAId: idSchema,
  playerBId: idSchema,
  reason: adjustmentReason,
});

// RN-02 / HU08: when no pairing avoids a rematch, the organizer may
// authorize some. That is a manual adjustment too (RN-09): it says why.
export const generateRoundSchema = z
  .object({
    allowRematches: z.boolean().optional(),
    reason: adjustmentReason.optional(),
  })
  .refine((data) => !data.allowRematches || data.reason !== undefined, {
    error: "Indica el motivo del ajuste (RN-09)",
    path: ["reason"],
  });

export type GenerateRoundSchemaInput = z.infer<typeof generateRoundSchema>;

export type SwapPlayersSchemaInput = z.infer<typeof swapPlayersSchema>;
