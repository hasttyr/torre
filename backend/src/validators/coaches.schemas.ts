import { z } from "zod";

import { idSchema } from "./fields";

export const linkPlayerSchema = z.object({
  playerId: idSchema,
});

export type LinkPlayerSchemaInput = z.infer<typeof linkPlayerSchema>;
