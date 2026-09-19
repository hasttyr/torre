import { z } from "zod";

// A diferencia del registro público (auth.schemas.ts), acá sí se permite
// ADMINISTRADOR: quien lo asigna ya es un administrador autenticado.
export const updateRoleSchema = z.object({
  rol: z.enum(["ORGANIZADOR", "ARBITRO", "JUGADOR", "ENTRENADOR", "ADMINISTRADOR"]),
});

export type UpdateRoleSchemaInput = z.infer<typeof updateRoleSchema>;

// HU20: todos los campos son opcionales (se actualiza solo lo que venga) y
// deliberadamente no incluye "rol" ni "email" — CA: "no puede... cambiar su
// propio rol"; el correo se deja fuera de este alcance por ser el
// identificador de login (cambiarlo es un flujo aparte, no HU20).
export const updateProfileSchema = z.object({
  nombre: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").optional(),
  codigoUniversitario: z.string().trim().min(1, "El código universitario es requerido").optional(),
  programa: z.string().trim().min(1, "El programa es requerido").optional(),
  semestre: z.number().int().positive("El semestre debe ser un entero positivo").optional(),
});

export type UpdateProfileSchemaInput = z.infer<typeof updateProfileSchema>;
