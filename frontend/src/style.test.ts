// @vitest-environment node
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// WCAG 2.2 AA for normal text is 4.5:1. The theme tokens decide it for every
// page at once, so a palette tweak that drops a pair below it fails here
// instead of shipping.
const AA = 4.5;

const css = readFileSync(new URL("./style.css", import.meta.url), "utf8");

/** The `--name: #hex` tokens of the block that starts with `selector`. */
function tokensOf(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  const block = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => [m[1], m[2]]));
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((index) => {
    const channel = parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter! + 0.05) / (darker! + 0.05);
}

const THEMES = {
  dark: tokensOf(':root[data-theme="dark"] {'),
  light: tokensOf(':root[data-theme="light"] {'),
};

// [foreground, background]: text people read, on the surfaces it sits on.
const PAIRS: [string, string][] = [
  ["text", "bg"],
  ["text", "surface"],
  ["text-muted", "bg"],
  ["text-muted", "surface-2"],
  ["text-faint", "bg"],
  ["text-faint", "surface"],
  ["text-faint", "surface-2"],
  // Links and accented labels.
  ["accent", "bg"],
  ["accent", "surface"],
  // Primary buttons, at rest and hovered.
  ["on-accent", "accent"],
  ["on-accent", "accent-hover"],
  ["error", "bg"],
  ["error", "surface"],
  // Danger buttons.
  ["on-error", "error"],
];

describe.each(Object.entries(THEMES))("%s theme contrast (WCAG AA)", (_theme, tokens) => {
  it.each(PAIRS)("%s on %s is readable", (foreground, background) => {
    expect(tokens[foreground], `--${foreground}`).toBeDefined();
    expect(tokens[background], `--${background}`).toBeDefined();

    expect(contrast(tokens[foreground]!, tokens[background]!)).toBeGreaterThanOrEqual(AA);
  });
});
