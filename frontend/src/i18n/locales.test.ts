import { describe, expect, it } from "vitest";

import en from "./locales/en.json";
import es from "./locales/es.json";

type Messages = { [key: string]: string | Messages };

/** Every leaf of a message tree as ["path.to.key", "text"]. */
function entries(messages: Messages, prefix = ""): [string, string][] {
  return Object.entries(messages).flatMap(([key, value]) =>
    typeof value === "string" ? [[`${prefix}${key}`, value]] : entries(value, `${prefix}${key}.`),
  );
}

describe("locale files", () => {
  it("define the same keys in Spanish and English", () => {
    const keys = (messages: Messages) =>
      entries(messages)
        .map(([key]) => key)
        .sort();

    expect(keys(en)).toEqual(keys(es));
  });

  it.each([
    ["es", es],
    ["en", en],
  ])("use the ellipsis character, not three dots (%s)", (_, messages) => {
    expect(entries(messages).filter(([, text]) => text.includes("..."))).toEqual([]);
  });
});
