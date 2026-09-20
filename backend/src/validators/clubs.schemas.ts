import { z } from "zod";

export const createClubSchema = z.object({
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres"),
});

export const updateClubSchema = z.object({
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres"),
});

export const assignPlayerSchema = z.object({
  playerId: z.string().min(1, "El jugador es requerido"),
});

export type CreateClubSchemaInput = z.infer<typeof createClubSchema>;
export type UpdateClubSchemaInput = z.infer<typeof updateClubSchema>;
export type AssignPlayerSchemaInput = z.infer<typeof assignPlayerSchema>;
