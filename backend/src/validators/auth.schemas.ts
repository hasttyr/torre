import { z } from "zod";

const baseFields = {
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres"),
  email: z.string().trim().email("El correo no es válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  // RN-10/HU21: el registro no se completa sin esta aceptación explícita.
  acceptDataPolicy: z.literal(true, {
    message: "Debés aceptar la política de tratamiento de datos personales",
  }),
};

// PLAYER requires extra data because Player.universityCode, program
// and semester are NOT NULL in the schema (see prisma/schema.prisma).
export const registerSchema = z.discriminatedUnion("role", [
  z.object({
    ...baseFields,
    role: z.literal("PLAYER"),
    universityCode: z.string().trim().min(1, "El código universitario es requerido"),
    program: z.string().trim().min(1, "El programa es requerido"),
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
  email: z.string().trim().email("El correo no es válido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

// HU19: solicitud de restablecimiento de contraseña.
export const requestPasswordResetSchema = z.object({
  email: z.string().trim().email("El correo no es válido"),
});

// HU19: confirmación con el token de un solo uso enviado en la solicitud.
export const confirmPasswordResetSchema = z.object({
  token: z.string().min(1, "El token es requerido"),
  newPassword: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});
