import { z } from "zod";

export const linkPlayerSchema = z.object({
  playerId: z.string().min(1, "El jugador es requerido"),
});

export type LinkPlayerSchemaInput = z.infer<typeof linkPlayerSchema>;
