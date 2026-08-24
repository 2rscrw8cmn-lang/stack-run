/// <reference types="node" />
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Training Signals v2 card styling.
 *
 * There is no visual-regression harness in this repository (no Playwright, and
 * no `css: true` in the vitest config), so a component test cannot observe a
 * computed style. These assert the stylesheet source directly, for the three
 * properties of these cards that are product decisions rather than taste:
 *
 * - one card per row at phone widths, so a card can hold a sentence;
 * - no colour carried by direction, because that would be scorekeeping;
 * - no v1 KPI-tile rules left behind to fight with them.
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

describe("Training Signal card styling", () => {
  it("stacks one card per row by default, so 320px holds a full sentence", () => {
    expect(ruleBody(".signal-cards__list {")).toMatch(
      /grid-template-columns: minmax\(0, 1fr\)/,
    );
    // Two-up arrives only on the wide breakpoint, never on a phone.
    const wide = css.indexOf("@media (min-width: 700px)", css.indexOf(".signal-card {"));
    expect(css.slice(wide, wide + 260)).toMatch(
      /\.signal-cards__list \{ grid-template-columns: repeat\(2/,
    );
  });

  it("lets a card grow with its text rather than fixing a tile height", () => {
    const body = ruleBody(".signal-card {");
    expect(body).not.toMatch(/(^|\s)height:/);
    expect(body).toMatch(/min-height: 44px/);
    expect(body).toMatch(/width: 100%/);
  });

  it("colours a card by its family, never by which way the measure moved", () => {
    expect(css).toMatch(/\.signal-card\[data-signal="workload-trend"\]/);
    expect(css).not.toMatch(/\.signal-card\[data-direction="rising"\][^{]*\{[^}]*color/);
    expect(css).not.toMatch(/data-direction="(rising|falling)"[^{]*\{[^}]*--signal-accent/);
    expect(ruleBody(".signal-card__mark {")).toMatch(/color: var\(--text-muted\)/);
  });

  it("keeps the phone card comfortable at the narrowest supported width", () => {
    const narrow = css.indexOf("@media (max-width: 340px)", css.indexOf(".signal-card {"));
    expect(narrow).toBeGreaterThan(0);
    expect(css.slice(narrow, narrow + 200)).toMatch(/\.signal-card \{ padding:/);
  });

  it("leaves no v1 KPI-tile rules behind", () => {
    expect(css).not.toMatch(/trend-cards/);
  });

  it("adds no animation for reduced motion to have to suppress", () => {
    expect(ruleBody(".signal-card {")).not.toMatch(/animation/);
    expect(ruleBody(".signal-card {")).toMatch(
      /transition: border-color 160ms ease, transform 160ms ease/,
    );
  });
});
