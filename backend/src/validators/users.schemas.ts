import { z } from "zod";

// Unlike public registration (auth.schemas.ts), ADMINISTRADOR is allowed
// here: whoever assigns it is already an authenticated administrator.
export const updateRoleSchema = z.object({
  rol: z.enum(["ORGANIZADOR", "ARBITRO", "JUGADOR", "ENTRENADOR", "ADMINISTRADOR"]),
});

export type UpdateRoleSchemaInput = z.infer<typeof updateRoleSchema>;

// Closed catalogs — mirror the GeneroJugador/DiscapacidadJugador enums in
// prisma/schema.prisma. Listed here too (not only in the Prisma enum) so
// zod returns a readable validation message instead of a generic type error.
export const GENDERS = ["MASCULINO", "FEMENINO", "NO_BINARIO", "PREFIERE_NO_DECIR"] as const;
export const DISABILITIES = [
  "NINGUNA",
  "FISICA_MOTRIZ",
  "VISUAL",
  "AUDITIVA",
  "COGNITIVA",
  "PSICOSOCIAL",
  "MULTIPLE",
  "OTRA",
] as const;

// HU20: every field is optional (only what is sent gets updated) and it
// deliberately excludes "rol" and "email" — CA: "cannot... change their own
// role"; email is left out of this scope since it's the login identifier
// (changing it is a separate flow, not HU20).
export const updateProfileSchema = z.object({
  nombre: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").optional(),
  codigoUniversitario: z.string().trim().min(1, "El código universitario es requerido").optional(),
  programa: z.string().trim().min(1, "El programa es requerido").optional(),
  semestre: z.number().int().positive("El semestre debe ser un entero positivo").optional(),
  // An explicit null clears the field; omitting it leaves it as-is (same
  // pattern as programaRestringido/semestreMinimo in tournaments.schemas.ts).
  fechaNacimiento: z.coerce
    .date({ message: "La fecha de nacimiento no es válida" })
    .max(new Date(), { message: "La fecha de nacimiento no puede ser futura" })
    .refine((fecha) => fecha.getFullYear() >= 1900, { message: "La fecha de nacimiento no es válida" })
    .nullable()
    .optional(),
  genero: z.enum(GENDERS, { message: "El género no es una opción válida" }).nullable().optional(),
  discapacidad: z
    .enum(DISABILITIES, { message: "La discapacidad no es una opción válida" })
    .nullable()
    .optional(),
});

export type UpdateProfileSchemaInput = z.infer<typeof updateProfileSchema>;
