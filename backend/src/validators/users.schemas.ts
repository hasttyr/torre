import { z } from "zod";

import { DISABILITIES, GENDERS, ROLES, USER_STATUSES } from "../contracts/catalogs";
import { nameSchema, programSchema, reasonSchema, universityCodeSchema } from "./fields";

// Unlike public registration (auth.schemas.ts), ADMINISTRATOR is allowed
// here: whoever assigns it is already an authenticated administrator.
export const updateRoleSchema = z.object({
  role: z.enum(ROLES),
});

// Admin-only account activation/deactivation. Deliberately doesn't allow
// deleting a user (would cascade-break tournaments, enrollments, audit
// history, ...); INACTIVE is the system's equivalent of "off" for an
// account, already used by HU22's suppression flow.
export const updateStatusSchema = z.object({
  status: z.enum(USER_STATUSES),
});

// The profile catalogs come from the API contract (the Gender/Disability
// enums in prisma/schema.prisma hold the same values). Validating them here
// too gives a readable message instead of a database error.
export { DISABILITIES, GENDERS };

// HU20: every field is optional (only what is sent gets updated) and it
// deliberately excludes "role" and "email" — CA: "cannot... change their own
// role"; email is left out of this scope since it's the login identifier
// (changing it is a separate flow, not HU20).
export const updateProfileSchema = z.object({
  name: nameSchema.optional(),
  universityCode: universityCodeSchema.optional(),
  program: programSchema.optional(),
  semester: z.number().int().positive("El semestre debe ser un entero positivo").optional(),
  // An explicit null clears the field; omitting it leaves it as-is (same
  // pattern as restrictedProgram/minimumSemester in tournaments.schemas.ts).
  birthDate: z.coerce
    .date({ error: "La fecha de nacimiento no es válida" })
    // A refine, not .max(new Date()): that bound would be computed once, at import.
    .refine((date) => date <= new Date(), { error: "La fecha de nacimiento no puede ser futura" })
    .refine((date) => date.getFullYear() >= 1900, { error: "La fecha de nacimiento no es válida" })
    .nullable()
    .optional(),
  gender: z.enum(GENDERS, { error: "El género no es una opción válida" }).nullable().optional(),
  disability: z.enum(DISABILITIES, { error: "La discapacidad no es una opción válida" }).nullable().optional(),
});

export type UpdateProfileSchemaInput = z.infer<typeof updateProfileSchema>;

// HU22/Ley 1581 de 2012: derechos ARCO ejercidos por el titular sobre sus
// propios datos. RECTIFICATION reutiliza updateProfileSchema (mismo shape
// que HU20) en vez de duplicar sus reglas de validación.
export const dataRequestSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ACCESS") }),
  z.object({ type: z.literal("RECTIFICATION"), data: updateProfileSchema }),
  z.object({ type: z.literal("SUPPRESSION"), reason: reasonSchema.optional() }),
]);

export type DataRequestSchemaInput = z.infer<typeof dataRequestSchema>;
