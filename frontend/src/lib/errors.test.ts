import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";

import { extractErrorMessage } from "./errors";

describe("extractErrorMessage", () => {
  it("uses the server's own message from a failed request", () => {
    const error = new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, null, {
      status: 409,
      statusText: "",
      headers: {},
      config: {} as never,
      data: { error: "Ya existe una cuenta con ese correo" },
    });

    expect(extractErrorMessage(error, "fallback")).toBe("Ya existe una cuenta con ese correo");
  });

  it("falls back when there's no server message: network errors, odd shapes, anything else", () => {
    expect(extractErrorMessage(new AxiosError("Network Error"), "fallback")).toBe("fallback");
    expect(extractErrorMessage({ isAxiosError: true, response: { data: { error: 42 } } }, "fallback")).toBe("fallback");
    expect(extractErrorMessage(new Error("boom"), "fallback")).toBe("fallback");
    expect(extractErrorMessage(null, "fallback")).toBe("fallback");
  });
});
