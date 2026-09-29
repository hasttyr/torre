import type { Request } from "express";

import { idSchema } from "./fields";
import { parseOrThrow } from "./parse";

/**
 * A path parameter holding an entity id.
 *
 * @throws {HttpError} 400 unless it's a UUID: a malformed id is the client's
 * mistake, answered before anything is looked up.
 */
export function idParam(req: Request, name: string): string {
  return parseOrThrow(idSchema, req.params[name]);
}
