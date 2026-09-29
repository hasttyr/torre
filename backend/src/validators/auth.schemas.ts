import { z } from "zod";

import {
  emailSchema,
  MAX_LENGTH,
  nameSchema,
  newPasswordSchema,
  programSchema,
  tooLong,
  universityCodeSchema,
} from "./fields";

const baseFields = {
  name: nameSchema,
  email: emailSchema,
  password: newPasswordSchema,
  // RN-10/HU21: el registro no se completa sin esta aceptación explícita.
  acceptDataPolicy: z.literal(true, {
    error: "Debes aceptar la política de tratamiento de datos personales",
  }),
};

// PLAYER requires extra data because Player.universityCode, program
// and semester are NOT NULL in the schema (see prisma/schema.prisma).
export const registerSchema = z.discriminatedUnion("role", [
  z.object({
    ...baseFields,
    role: z.literal("PLAYER"),
    universityCode: universityCodeSchema,
    program: programSchema,
    semester: z.number().int().positive("El semestre debe ser un entero positivo"),
  }),
  z.object({
    ...baseFields,
    // ORGANIZER, ARBITER and ADMINISTRATOR are deliberately excluded: they
    // hold authority over other people's data (enrolled players' personal
    // data, official match results) or over the system itself, so an
    // account with one of those roles must not be self-service. It's
    // provisioned some other way (seed, PATCH /users/:id/role by an
    // administrator, a future internal panel).
    role: z.literal("COACH"),
  }),
]);

export type RegisterSchemaInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "La contraseña es requerida").max(MAX_LENGTH.password, tooLong(MAX_LENGTH.password)),
});

// HU19: solicitud de restablecimiento de contraseña.
export const requestPasswordResetSchema = z.object({
  email: emailSchema,
});

// HU19: confirmación con el token de un solo uso enviado en la solicitud.
export const confirmPasswordResetSchema = z.object({
  // 64 hex characters (32 random bytes, see passwordReset.service.ts).
  token: z.string().min(1, "El token es requerido").max(128, tooLong(128)),
  newPassword: newPasswordSchema,
});
