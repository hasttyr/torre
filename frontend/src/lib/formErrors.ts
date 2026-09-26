import { nextTick } from "vue";

// Ties each form field to its inline error (<span class="field-error">):
// the input is marked invalid and described by the message, so a screen
// reader reads the problem along with the field, and a failed submit can
// take the user straight to the first one.

/** Id of a field's inline error element. */
export function errorId(field: string): string {
  return `${field}-error`;
}

/** aria-invalid / aria-describedby for a field, given the form's current errors. */
export function errorAttrs(
  errors: Partial<Record<string, string>>,
  field: string,
): { "aria-invalid": "true" | undefined; "aria-describedby": string | undefined } {
  const invalid = Boolean(errors[field]);
  return {
    "aria-invalid": invalid ? "true" : undefined,
    "aria-describedby": invalid ? errorId(field) : undefined,
  };
}

/** After a failed submit, focuses the form's first invalid field (once the errors have rendered). */
export async function focusFirstInvalid(form: HTMLFormElement | null): Promise<void> {
  await nextTick();
  form?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
}
