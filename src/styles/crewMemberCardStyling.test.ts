/// <reference types="node" />
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Crew Build/Comparison have no CSS/visual-regression harness (no
 * Playwright, no `css: true` in the vitest config), so component tests
 * can't observe real computed styles. This asserts the stylesheet source
 * directly to guard the polish pass from issue #86: one construction grid
 * per Member Build card (not the outer `technical-grid` plus
 * `CrewMiniBuild`'s own field grid stacked behind it), a denser mobile card
 * width, and comparison rows that hold the same height across metrics.
 */
const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "components.css"),
  "utf8",
);

function ruleBody(selector: string): string {
  const start = css.indexOf(selector);
  expect(start, `selector not found: ${selector}`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  return css.slice(open + 1, close);
}

describe("Crew Member Build card styling (issue #86)", () => {
  it("does not frame the mini tower in a second bordered box", () => {
    // The outer `.crew-build-card` already draws the card's one frame;
    // `CrewMiniBuild` owning a border too was the box-inside-a-box.
    expect(ruleBody(".crew-mini-build {")).not.toMatch(/border:/);
  });

  it("caps the mobile rail card well under the old ~286px target", () => {
    const body = ruleBody(".crew-builds__rail {");
    const match = body.match(/grid-auto-columns:\s*min\(([\d.]+)%,\s*(\d+)px\)/);
    expect(match, "grid-auto-columns: min(<percent>%, <px>px) not found").not.toBeNull();
    const [, percent, maxPx] = match!;
    expect(Number(percent)).toBeGreaterThanOrEqual(68);
    expect(Number(percent)).toBeLessThanOrEqual(72);
    expect(Number(maxPx)).toBeLessThanOrEqual(240);
  });

  it("keeps the comparison value and its detail on one reading line", () => {
    // A two-row stack here is what made Consistency/Run Days rows taller
    // than the single-value metrics; it must stay a single flex line.
    const body = ruleBody(".crew-comparison__reading {");
    expect(body).toMatch(/display:\s*flex/);
    expect(body).not.toMatch(/display:\s*grid/);
  });
});
