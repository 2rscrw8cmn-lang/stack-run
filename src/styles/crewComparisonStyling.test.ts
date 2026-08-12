/// <reference types="node" />
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Crew Build/Comparison have no CSS/visual-regression harness (no
 * Playwright, no `css: true` in the vitest config), so component tests
 * can't observe real computed styles. This asserts the stylesheet source
 * directly to guard the normalization from issue #55: all four comparison
 * metrics must share one bar geometry, Miles Built must not carry a
 * striped/hatch fill, and the row list must not double the section's
 * bottom divider.
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

describe("Crew comparison styling (issue #55)", () => {
  it("gives every metric the same bar geometry — no per-metric height/radius override", () => {
    expect(css).not.toMatch(/\[data-metric="miles-built"\]\s*\.crew-comparison__bar\s*\{/);
    const body = ruleBody(".crew-comparison__bar {");
    expect(body).toMatch(/height: 7px/);
  });

  it("does not stripe/hatch the Miles Built (or any) bar fill", () => {
    expect(css).not.toMatch(
      /\[data-metric="miles-built"\]\s*\.crew-comparison__bar-fill\s*\{/,
    );
    const body = ruleBody(".crew-comparison__bar-fill {");
    expect(body).not.toMatch(/repeating-linear-gradient/);
    expect(body).toMatch(/background: var\(--comparison-accent\)/);
  });

  it("does not double the divider beneath the last comparison row", () => {
    const body = ruleBody(".crew-comparison__rows li:last-child {");
    expect(body).toMatch(/border-bottom:\s*0/);
  });
});
