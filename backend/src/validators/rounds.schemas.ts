import { z } from "zod";

import { idSchema, MAX_LENGTH, reasonSchema, tooLong } from "./fields";
import { GAME_RESULTS, type GameResult } from "../contracts/catalogs";

// RN-03: the results a person can record. "BYE" is also in the DB catalog,
// but only the pairing engine assigns it (HU28), never a user.
export { GAME_RESULTS, type GameResult };

const resultValue = z.enum(GAME_RESULTS, { error: "El resultado debe ser 1-0, 0-1 o 1/2-1/2" });

export const recordResultSchema = z.object({ value: resultValue });

export const correctResultSchema = z.object({
  value: resultValue,
  reason: reasonSchema.optional(),
});

// HU29/RN-09: a manual adjustment must say why.
export const swapPlayersSchema = z.object({
  playerAId: idSchema,
  playerBId: idSchema,
  reason: z
    .string({ error: "Indica el motivo del ajuste (RN-09)" })
    .trim()
    .min(3, "Indica el motivo del ajuste (RN-09)")
    .max(MAX_LENGTH.reason, tooLong(MAX_LENGTH.reason)),
});

export type SwapPlayersSchemaInput = z.infer<typeof swapPlayersSchema>;
