import { describe, expect, it } from "vitest";

import { errorAttrs, errorId, focusFirstInvalid, resetErrors } from "./formErrors";

describe("errorAttrs", () => {
  it("marks a field with an error invalid and described by its message", () => {
    expect(errorAttrs({ email: "El correo es requerido" }, "email")).toEqual({
      "aria-invalid": "true",
      "aria-describedby": errorId("email"),
    });
  });

  it("leaves a valid field without either attribute", () => {
    expect(errorAttrs({ email: "El correo es requerido" }, "password")).toEqual({
      "aria-invalid": undefined,
      "aria-describedby": undefined,
    });
  });
});

describe("focusFirstInvalid", () => {
  it("moves focus to the first invalid field, in document order", async () => {
    const form = document.createElement("form");
    form.innerHTML = `
      <input id="name" />
      <input id="email" aria-invalid="true" />
      <input id="password" aria-invalid="true" />
    `;
    document.body.append(form);

    await focusFirstInvalid(form);

    expect(document.activeElement?.id).toBe("email");
    form.remove();
  });

  it("does nothing without a form", async () => {
    await expect(focusFirstInvalid(null)).resolves.toBeUndefined();
  });
});

describe("resetErrors", () => {
  it("clears every field's message in place, so a form's reactive errors object stays the same object", () => {
    const errors: Record<string, string> = { email: "El correo es requerido", password: "Muy corta" };
    const same = errors;

    resetErrors(errors);

    expect(errors).toEqual({});
    expect(errors).toBe(same);
  });
});
