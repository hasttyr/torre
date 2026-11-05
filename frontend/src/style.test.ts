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

// The photograph behind every page (.backdrop) runs from pure black to pure
// white, so text set straight on it is checked against the veil laid over
// both extremes: what reads there reads over any pixel of it.
/** The `--name: rgb(r g b / a%)` veil of the block that starts with `selector`, over a black or a white pixel, as hex. */
function veiledHex(selector: string, name: string, pixel: 0 | 255): string {
  const start = css.indexOf(selector);
  const block = css.slice(start, css.indexOf("}", start));
  const match = new RegExp(String.raw`--${name}:\s*rgb\((\d+) (\d+) (\d+) / (\d+)%\)`).exec(block);
  if (!match) throw new Error(`--${name} not found in ${selector}`);
  const alpha = Number(match[4]) / 100;
  return (
    "#" +
    [match[1], match[2], match[3]]
      .map((channel) => Math.round(Number(channel) * alpha + pixel * (1 - alpha)))
      .map((channel) => channel.toString(16).padStart(2, "0"))
      .join("")
  );
}

const SELECTORS = { dark: ':root[data-theme="dark"] {', light: ':root[data-theme="light"] {' };

describe.each(Object.entries(SELECTORS))("%s theme text over the photograph", (theme, selector) => {
  const tokens = THEMES[theme as keyof typeof THEMES];

  it.each([0, 255] as const)("page text reads through the veil over a pixel of %i", (pixel) => {
    const ground = veiledHex(selector, "veil", pixel);
    expect(contrast(tokens.text!, ground)).toBeGreaterThanOrEqual(AA);
    expect(contrast(tokens["text-muted"]!, ground)).toBeGreaterThanOrEqual(AA);
  });

  // The hero's lighter veil holds only large type: full ink at AA, and the
  // gold line at the 3:1 that large text needs.
  it.each([0, 255] as const)("the hero's large type reads through its lighter veil over a pixel of %i", (pixel) => {
    const ground = veiledHex(selector, "veil-soft", pixel);
    expect(contrast(tokens.text!, ground)).toBeGreaterThanOrEqual(AA);
    expect(contrast(tokens["accent-hover"]!, ground)).toBeGreaterThanOrEqual(3);
  });
});
