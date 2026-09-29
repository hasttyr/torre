import { API_ERRORS, type ApiErrorCode } from "../contracts/errors";

export { API_ERRORS, type ApiErrorCode };

export type ErrorParams = Record<string, string | number>;

/** Fills a message's `{name}` placeholders. */
function fill(template: string, params: ErrorParams): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) => String(params[name] ?? placeholder));
}

/** An expected error, answered to the client with its catalog status, code and message. */
export class HttpError extends Error {
  readonly status: number;
  readonly fields?: Record<string, string>;

  /**
   * @param params - Values for the message's placeholders; sent to the client too.
   * @param details - A more specific message than the catalog's, and per-field messages (validation).
   */
  constructor(
    readonly code: ApiErrorCode,
    readonly params: ErrorParams = {},
    details: { message?: string; fields?: Record<string, string> } = {},
  ) {
    const [status, template] = API_ERRORS[code];
    super(details.message ?? fill(template, params));
    this.status = status;
    this.fields = details.fields;
  }
}
