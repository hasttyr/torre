import type { ZodType } from "zod";

import { HttpError } from "../errors/apiErrors";

/**
 * Parses `input` with `schema`, turning a validation failure into a 400
 * (VALIDATION_FAILED) with every issue's message, and the first one of each
 * field keyed by its path ("player.semester"), for forms to show inline.
 *
 * @returns The schema's output: coerced and with its defaults filled in.
 */
export function parseOrThrow<T>(schema: ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const { issues } = parsed.error;
    const fields: Record<string, string> = {};
    for (const issue of issues) {
      fields[issue.path.map(String).join(".")] ??= issue.message;
    }
    throw new HttpError("VALIDATION_FAILED", {}, { message: issues.map((issue) => issue.message).join("; "), fields });
  }
  return parsed.data;
}
