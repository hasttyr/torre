import { z } from "zod";

// RN-05: el orden de desempates se define antes del inicio de la primera
// ronda. El nombre del criterio no tiene catálogo cerrado en la
// documentación (HU13 solo fija el orden por defecto), así que se valida
// como texto no vacío.
const criterioDesempateSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre del criterio es requerido"),
  orden: z.number().int().positive("El orden debe ser un entero positivo"),
});

export const crearTorneoSchema = z
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

export type CrearTorneoSchemaInput = z.infer<typeof crearTorneoSchema>;

export const configurarTorneoSchema = z.object({
  numeroRondas: z.number().int().positive("El número de rondas debe ser un entero positivo").optional(),
  ritmo: z.string().trim().min(1, "El ritmo es requerido").optional(),
  criteriosDesempate: z.array(criterioDesempateSchema).optional(),
});

export type ConfigurarTorneoSchemaInput = z.infer<typeof configurarTorneoSchema>;

export const inscribirJugadorSchema = z.object({
  jugadorId: z.string().uuid("El id de jugador no es válido"),
});

export type InscribirJugadorSchemaInput = z.infer<typeof inscribirJugadorSchema>;
