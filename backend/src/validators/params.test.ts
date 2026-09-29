import type { Request } from "express";
import { describe, expect, it } from "vitest";

import { idParam } from "./params";

const withParams = (params: Record<string, string>) => ({ params }) as unknown as Request;

describe("idParam", () => {
  it("returns a path parameter that is an entity id", () => {
    const id = "3f2b8c1e-6a4d-4e2f-9b7a-1c5d8e9f0a2b";

    expect(idParam(withParams({ id }), "id")).toBe(id);
  });

  it("accepts any id PostgreSQL's uuid type stores, not only RFC 4122 versions", () => {
    const id = "11111111-1111-1111-1111-111111111111";

    expect(idParam(withParams({ id }), "id")).toBe(id);
  });

  it("answers 400 for anything else, instead of looking it up", () => {
    expect(() => idParam(withParams({ id: "../users" }), "id")).toThrow(
      expect.objectContaining({ status: 400 }) as Error,
    );
  });
});
