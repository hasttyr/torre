import { describe, expect, it } from "vitest";

import { initialsOf } from "./initials";

describe("initialsOf", () => {
  it.each([
    ["Nilson Aldair Molina Rengifo", "NM"],
    ["Ana Torres", "AT"],
    ["  luis   gómez ", "LG"],
    ["Madonna", "MA"],
    ["", "?"],
    [undefined, "?"],
  ])("labels %j's avatar %s", (name, expected) => {
    expect(initialsOf(name)).toBe(expected);
  });
});
