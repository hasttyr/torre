import { z } from "zod";

import { tooLong } from "./fields";

// GET /players?q=: what to look for (a name, email or university code).
export const playerSearchQuerySchema = z.object({
  q: z.string().trim().max(100, tooLong(100)).default(""),
});
