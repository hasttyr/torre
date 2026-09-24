import { z } from "zod";

import { CONFIGURABLE_ROLES, WIDGET_KEYS } from "../services/dashboard/widgetCatalog";

export const widgetKeySchema = z.enum(WIDGET_KEYS, { message: "El control solicitado no existe" });

export const widgetQuerySchema = z.object({
  playerId: z.string().uuid("El id de jugador no es válido").optional(),
});

export const configurableRoleSchema = z.enum(CONFIGURABLE_ROLES, {
  message: "Ese rol no tiene un panel configurable",
});

// The array order IS the layout order. Duplicates are rejected instead of
// silently de-duplicated: they'd point at a client bug.
export const updateLayoutSchema = z.object({
  widgets: z
    .array(widgetKeySchema)
    .refine((widgets) => new Set(widgets).size === widgets.length, { message: "Un control no puede repetirse" }),
});
