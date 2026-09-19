import { z } from "zod";

// RN-05: the tiebreak order is defined before the first round starts. The
// criterion's name has no closed catalog in the documentation (HU13 only
// sets the default order), so it's validated as non-empty text.
const tiebreakCriterionSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre del criterio es requerido"),
  orden: z.number().int().positive("El orden debe ser un entero positivo"),
});

export const createTournamentSchema = z
  .object({
    nombre: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres"),
    fechaInicio: z.coerce.date({ message: "La fecha de inicio no es válida" }),
    fechaFin: z.coerce.date({ message: "La fecha de fin no es válida" }),
    formato: z.string().trim().min(1).optional(),
  })
  .refine((data) => data.fechaFin >= data.fechaInicio, {
    message: "La fecha de fin no puede ser anterior a la fecha de inicio",
    path: ["fechaFin"],
  });

export type CreateTournamentSchemaInput = z.infer<typeof createTournamentSchema>;

export const configureTournamentSchema = z.object({
  numeroRondas: z.number().int().positive("El número de rondas debe ser un entero positivo").optional(),
  ritmo: z.string().trim().min(1, "El ritmo es requerido").optional(),
  criteriosDesempate: z.array(tiebreakCriterionSchema).optional(),
  // Registration eligibility (see comment in schema.prisma). An explicit
  // null clears the restriction; undefined (field absent) leaves it as-is.
  programaRestringido: z.string().trim().min(1, "El programa no puede quedar vacío").nullable().optional(),
  semestreMinimo: z.number().int().positive("El semestre mínimo debe ser un entero positivo").nullable().optional(),
});

export type ConfigureTournamentSchemaInput = z.infer<typeof configureTournamentSchema>;

export const enrollPlayerSchema = z.object({
  jugadorId: z.string().uuid("El id de jugador no es válido"),
});

export type EnrollPlayerSchemaInput = z.infer<typeof enrollPlayerSchema>;
