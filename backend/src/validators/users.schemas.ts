import { z } from "zod";

// Unlike public registration (auth.schemas.ts), ADMINISTRADOR is allowed
// here: whoever assigns it is already an authenticated administrator.
export const updateRoleSchema = z.object({
  role: z.enum(["ORGANIZADOR", "ARBITRO", "JUGADOR", "ENTRENADOR", "ADMINISTRADOR"]),
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
// deliberately excludes "role" and "email" — CA: "cannot... change their own
// role"; email is left out of this scope since it's the login identifier
// (changing it is a separate flow, not HU20).
export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").optional(),
  universityCode: z.string().trim().min(1, "El código universitario es requerido").optional(),
  program: z.string().trim().min(1, "El programa es requerido").optional(),
  semester: z.number().int().positive("El semestre debe ser un entero positivo").optional(),
  // An explicit null clears the field; omitting it leaves it as-is (same
  // pattern as restrictedProgram/minimumSemester in tournaments.schemas.ts).
  birthDate: z.coerce
    .date({ message: "La fecha de nacimiento no es válida" })
    .max(new Date(), { message: "La fecha de nacimiento no puede ser futura" })
    .refine((date) => date.getFullYear() >= 1900, { message: "La fecha de nacimiento no es válida" })
    .nullable()
    .optional(),
  gender: z.enum(GENDERS, { message: "El género no es una opción válida" }).nullable().optional(),
  disability: z
    .enum(DISABILITIES, { message: "La discapacidad no es una opción válida" })
    .nullable()
    .optional(),
});

export type UpdateProfileSchemaInput = z.infer<typeof updateProfileSchema>;

// HU22/Ley 1581 de 2012: derechos ARCO ejercidos por el titular sobre sus
// propios datos. RECTIFICACION reutiliza updateProfileSchema (mismo shape
// que HU20) en vez de duplicar sus reglas de validación.
export const dataRequestSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ACCESO") }),
  z.object({ type: z.literal("RECTIFICACION"), data: updateProfileSchema }),
  z.object({ type: z.literal("SUPRESION"), reason: z.string().trim().min(1).optional() }),
]);

export type DataRequestSchemaInput = z.infer<typeof dataRequestSchema>;
