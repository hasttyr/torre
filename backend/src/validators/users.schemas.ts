import { z } from "zod";

// A diferencia del registro público (auth.schemas.ts), acá sí se permite
// ADMINISTRADOR: quien lo asigna ya es un administrador autenticado.
export const updateRoleSchema = z.object({
  rol: z.enum(["ORGANIZADOR", "ARBITRO", "JUGADOR", "ENTRENADOR", "ADMINISTRADOR"]),
});

export type UpdateRoleSchemaInput = z.infer<typeof updateRoleSchema>;
