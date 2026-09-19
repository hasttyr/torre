import { z } from "zod";

const baseFields = {
  nombre: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres"),
  email: z.string().trim().email("El correo no es válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
};

// JUGADOR requires extra data because Jugador.codigoUniversitario, programa
// and semestre are NOT NULL in the schema (see prisma/schema.prisma).
export const registerSchema = z.discriminatedUnion("rol", [
  z.object({
    ...baseFields,
    rol: z.literal("JUGADOR"),
    codigoUniversitario: z.string().trim().min(1, "El código universitario es requerido"),
    programa: z.string().trim().min(1, "El programa es requerido"),
    semestre: z.number().int().positive("El semestre debe ser un entero positivo"),
  }),
  z.object({
    ...baseFields,
    // ADMINISTRADOR is deliberately excluded: an admin account must not be
    // creatable through self-registration; it's provisioned some other way
    // (seed, a future internal panel).
    rol: z.enum(["ORGANIZADOR", "ARBITRO", "ENTRENADOR"]),
  }),
]);

export type RegisterSchemaInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email("El correo no es válido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

export type LoginSchemaInput = z.infer<typeof loginSchema>;
