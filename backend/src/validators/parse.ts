import type { ZodType, ZodTypeDef } from "zod";

import { HttpError } from "../middlewares/errorHandler";

/**
 * Parses `input` with `schema`, turning a validation failure into a 400 with every issue's message.
 *
 * @returns The schema's output: coerced and with its defaults filled in.
 */
export function parseOrThrow<T>(schema: ZodType<T, ZodTypeDef, unknown>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues.map((issue) => issue.message).join("; "));
  }
  return parsed.data;
}
