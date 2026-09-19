import { z } from "zod";

// A diferencia del registro público (auth.schemas.ts), acá sí se permite
// ADMINISTRADOR: quien lo asigna ya es un administrador autenticado.
export const updateRoleSchema = z.object({
  rol: z.enum(["ORGANIZADOR", "ARBITRO", "JUGADOR", "ENTRENADOR", "ADMINISTRADOR"]),
});

export type UpdateRoleSchemaInput = z.infer<typeof updateRoleSchema>;

// Catálogos cerrados — espejo de los enums GeneroJugador/DiscapacidadJugador
// en prisma/schema.prisma. Se listan acá (no solo en el enum de Prisma)
// para que zod devuelva un mensaje de validación legible en vez de un
// error genérico de tipo.
export const GENEROS = ["MASCULINO", "FEMENINO", "NO_BINARIO", "PREFIERE_NO_DECIR"] as const;
export const DISCAPACIDADES = [
  "NINGUNA",
  "FISICA_MOTRIZ",
  "VISUAL",
  "AUDITIVA",
  "COGNITIVA",
  "PSICOSOCIAL",
  "MULTIPLE",
  "OTRA",
] as const;

// HU20: todos los campos son opcionales (se actualiza solo lo que venga) y
// deliberadamente no incluye "rol" ni "email" — CA: "no puede... cambiar su
// propio rol"; el correo se deja fuera de este alcance por ser el
// identificador de login (cambiarlo es un flujo aparte, no HU20).
export const updateProfileSchema = z.object({
  nombre: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").optional(),
  codigoUniversitario: z.string().trim().min(1, "El código universitario es requerido").optional(),
  programa: z.string().trim().min(1, "El programa es requerido").optional(),
  semestre: z.number().int().positive("El semestre debe ser un entero positivo").optional(),
  // null explícito limpia el campo; ausente lo deja como está (mismo
  // patrón que programaRestringido/semestreMinimo en torneos.schemas.ts).
  fechaNacimiento: z.coerce
    .date({ message: "La fecha de nacimiento no es válida" })
    .max(new Date(), { message: "La fecha de nacimiento no puede ser futura" })
    .refine((fecha) => fecha.getFullYear() >= 1900, { message: "La fecha de nacimiento no es válida" })
    .nullable()
    .optional(),
  genero: z.enum(GENEROS, { message: "El género no es una opción válida" }).nullable().optional(),
  discapacidad: z
    .enum(DISCAPACIDADES, { message: "La discapacidad no es una opción válida" })
    .nullable()
    .optional(),
});

export type UpdateProfileSchemaInput = z.infer<typeof updateProfileSchema>;
