import { z } from "zod";

// RN-03: the results a person can record. "BYE" is also in the DB catalog,
// but only the pairing engine assigns it (HU28), never a user.
export const GAME_RESULTS = ["1-0", "0-1", "1/2-1/2"] as const;
export type GameResult = (typeof GAME_RESULTS)[number];

const resultValue = z.enum(GAME_RESULTS, { message: "El resultado debe ser 1-0, 0-1 o 1/2-1/2" });

export const recordResultSchema = z.object({ value: resultValue });

export const correctResultSchema = z.object({
  value: resultValue,
  reason: z.string().trim().min(1, "El motivo no puede quedar vacío").optional(),
});

// HU29/RN-09: a manual adjustment must say why.
export const swapPlayersSchema = z.object({
  playerAId: z.string().uuid("El id de jugador no es válido"),
  playerBId: z.string().uuid("El id de jugador no es válido"),
  reason: z
    .string({ required_error: "Indicá el motivo del ajuste (RN-09)" })
    .trim()
    .min(3, "Indicá el motivo del ajuste (RN-09)"),
});

export type SwapPlayersSchemaInput = z.infer<typeof swapPlayersSchema>;
