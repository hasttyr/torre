import { AxiosError } from "axios";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useLocaleStore } from "../stores/locale";
import { extractErrorMessage, fieldErrorsOf } from "./errors";

/** A failed request, as axios rejects it, answered with `body`. */
function answered(status: number, body: unknown): AxiosError {
  return new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, null, {
    status,
    statusText: "",
    headers: {},
    config: {} as never,
    data: body,
  });
}

describe("extractErrorMessage", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(async () => {
    await useLocaleStore().setLocale("es");
  });

  it("words a known error in the page's language, from its code and values", async () => {
    const error = answered(409, {
      error: "Faltan resultados de la ronda 3",
      code: "RESULTS_PENDING",
      params: { number: 3 },
    });

    expect(extractErrorMessage(error, "fallback")).toBe("Faltan resultados de la ronda 3");
    await useLocaleStore().setLocale("en");
    expect(extractErrorMessage(error, "fallback")).toBe("Round 3 still has results to record");
  });

  it("uses the server's own message for a code it doesn't know (a newer API)", () => {
    const error = answered(409, { error: "Algo nuevo que pasó", code: "SOMETHING_NEW" });

    expect(extractErrorMessage(error, "fallback")).toBe("Algo nuevo que pasó");
  });

  it("uses the server's detailed message for invalid data, which says what's wrong with each field", () => {
    const error = answered(400, {
      error: "El nombre debe tener al menos 2 caracteres",
      code: "VALIDATION_FAILED",
      fields: { name: "El nombre debe tener al menos 2 caracteres" },
    });

    expect(extractErrorMessage(error, "fallback")).toBe("El nombre debe tener al menos 2 caracteres");
  });

  it("falls back when there's no server message: network errors, odd shapes, anything else", () => {
    expect(extractErrorMessage(new AxiosError("Network Error"), "fallback")).toBe("fallback");
    expect(extractErrorMessage({ isAxiosError: true, response: { data: { error: 42 } } }, "fallback")).toBe("fallback");
    expect(extractErrorMessage(new Error("boom"), "fallback")).toBe("fallback");
    expect(extractErrorMessage(null, "fallback")).toBe("fallback");
  });
});

describe("fieldErrorsOf", () => {
  it("returns the message for each invalid field, for a form to show next to it", () => {
    const error = answered(400, {
      error: "…",
      code: "VALIDATION_FAILED",
      fields: { name: "Muy corto", "player.semester": "Debe ser positivo" },
    });

    expect(fieldErrorsOf(error)).toEqual({ name: "Muy corto", "player.semester": "Debe ser positivo" });
  });

  it("returns nothing for any other failure", () => {
    expect(fieldErrorsOf(answered(409, { error: "…", code: "EMAIL_TAKEN" }))).toEqual({});
    expect(fieldErrorsOf(new Error("boom"))).toEqual({});
  });
});
