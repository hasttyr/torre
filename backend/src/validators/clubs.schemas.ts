import { z } from "zod";

import { idSchema, nameSchema } from "./fields";

export const createClubSchema = z.object({
  name: nameSchema,
});

export const updateClubSchema = z.object({
  name: nameSchema,
});

export const assignPlayerSchema = z.object({
  playerId: idSchema,
});

export type CreateClubSchemaInput = z.infer<typeof createClubSchema>;
export type UpdateClubSchemaInput = z.infer<typeof updateClubSchema>;
export type AssignPlayerSchemaInput = z.infer<typeof assignPlayerSchema>;
