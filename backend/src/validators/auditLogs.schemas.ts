import { z } from "zod";

// The audit log only grows: it's read one page at a time, newest first.
export const auditLogQuerySchema = z.object({
  limit: z.coerce
    .number({ invalid_type_error: "El tamaño de página debe ser un número" })
    .int("El tamaño de página debe ser un número entero")
    .min(1, "El tamaño de página debe ser al menos 1")
    .max(100, "El tamaño de página no puede superar 100")
    .default(50),
  // The id of the last entry already shown; the page starts right after it.
  cursor: z.string().uuid("El cursor de la bitácora no es válido").optional(),
});

export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
