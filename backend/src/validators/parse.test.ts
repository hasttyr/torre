import { z } from "zod";
import { describe, expect, it } from "vitest";

import { parseOrThrow } from "./parse";

const schema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  player: z.object({ semester: z.number({ error: "El semestre debe ser un número" }) }),
});

describe("parseOrThrow", () => {
  it("returns the parsed value", () => {
    expect(parseOrThrow(schema, { name: "Ana", player: { semester: 3 } })).toEqual({
      name: "Ana",
      player: { semester: 3 },
    });
  });

  it("answers 400 naming each invalid field, so a form can show the problem next to it", () => {
    expect(() => parseOrThrow(schema, { name: "A", player: { semester: "tres" } })).toThrow(
      expect.objectContaining({
        status: 400,
        code: "VALIDATION_FAILED",
        message: "El nombre debe tener al menos 2 caracteres; El semestre debe ser un número",
        fields: {
          name: "El nombre debe tener al menos 2 caracteres",
          "player.semester": "El semestre debe ser un número",
        },
      }) as Error,
    );
  });
});
