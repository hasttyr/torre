import { z } from "zod";

import { TIEBREAKS } from "../services/standings.calculator";
import { idSchema, nameSchema, programSchema, reasonSchema, tooLong } from "./fields";

// RN-05: the tiebreak order is defined before the first round starts, from
// the closed catalog (a misspelled free-text criterion used to be skipped
// without a word, silently changing the official standings).
const tiebreakCriterionSchema = z.object({
  name: z.enum(TIEBREAKS, { error: "El desempate no es uno de los disponibles" }),
  order: z.number().int().positive("El orden debe ser un entero positivo"),
});

const allDifferent = (values: unknown[]) => new Set(values).size === values.length;

const tiebreakOrderSchema = z
  .array(tiebreakCriterionSchema)
  .refine((criteria) => allDifferent(criteria.map((criterion) => criterion.order)), {
    error: "Cada desempate debe tener una posición distinta",
  })
  .refine((criteria) => allDifferent(criteria.map((criterion) => criterion.name)), {
    error: "Un desempate no puede repetirse",
  });

export const createTournamentSchema = z
  .object({
    name: nameSchema,
    startDate: z.coerce.date({ error: "La fecha de inicio no es válida" }),
    endDate: z.coerce.date({ error: "La fecha de fin no es válida" }),
    format: z.string().trim().min(1).max(30, tooLong(30)).optional(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    error: "La fecha de fin no puede ser anterior a la fecha de inicio",
    path: ["endDate"],
  });

export type CreateTournamentSchemaInput = z.infer<typeof createTournamentSchema>;

export const configureTournamentSchema = z.object({
  roundsCount: z.number().int().positive("El número de rondas debe ser un entero positivo").optional(),
  timeControl: z.string().trim().min(1, "El ritmo es requerido").max(50, tooLong(50)).optional(),
  tiebreakCriteria: tiebreakOrderSchema.optional(),
  // Registration eligibility (see comment in schema.prisma). An explicit
  // null clears the restriction; undefined (field absent) leaves it as-is.
  restrictedProgram: programSchema.nullable().optional(),
  minimumSemester: z.number().int().positive("El semestre mínimo debe ser un entero positivo").nullable().optional(),
  // HU28: what a bye is worth (same catalog as the DB CHECK).
  byePoints: z
    .union([z.literal(0), z.literal(0.5), z.literal(1)], { error: "El bye solo puede valer 0, 0.5 o 1 punto" })
    .optional(),
});

export type ConfigureTournamentSchemaInput = z.infer<typeof configureTournamentSchema>;

export const enrollPlayerSchema = z.object({
  playerId: idSchema,
});

// HU27/RN-11: the reason is optional (the HU doesn't make it mandatory,
// unlike RN-09 for manual pairing adjustments) but recorded in the audit
// trail when given.
export const withdrawPlayerSchema = z.object({
  reason: reasonSchema.optional(),
});

export type WithdrawPlayerSchemaInput = z.infer<typeof withdrawPlayerSchema>;
