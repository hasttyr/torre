import type { ZodType } from "zod";

import { HttpError } from "../middlewares/errorHandler";

/** Parses `input` with `schema`, turning a validation failure into a 400 with every issue's message. */
export function parseOrThrow<T>(schema: ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues.map((issue) => issue.message).join("; "));
  }
  return parsed.data;
}
