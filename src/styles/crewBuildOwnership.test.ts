/// <reference types="node" />
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Crew Build has no CSS/visual-regression harness (no Playwright, no
 * `css: true` in the vitest config), so component tests can't observe real
 * computed styles. This asserts the stylesheet source directly to guard the
 * ownership-ring removal from issue #54: normal placed blocks must not carry
 * a full-block member-accent ring, while the monogram badge, legend, and
 * placement-preview/keyboard-focus states keep their own distinct styling.
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

describe("Crew Build ownership styling (issue #54)", () => {
  it("does not ring normal placed blocks in the member accent color", () => {
    const body = ruleBody(".crew-build__tower button,\n.crew-build__block {");
    expect(body).not.toMatch(/--member-accent/);
    // Depth styling should remain — this isn't a wholesale box-shadow removal.
    expect(body).toMatch(/box-shadow/);
  });

  it("keeps ownership legible in the monogram badge", () => {
    const body = ruleBody(".crew-build__monogram {");
    expect(body).toMatch(/background: var\(--member-accent, var\(--text-muted\)\)/);
  });

  it("keeps ownership legible in the legend marker", () => {
    const body = ruleBody(".crew-member-marker {");
    expect(body).toMatch(/--member-accent/);
  });

  it("keeps the placement-preview selection state obvious without the removed ownership ring", () => {
    const body = ruleBody(".crew-build__preview .crew-build__block {");
    expect(body).not.toMatch(/--member-accent/);
    expect(body).toMatch(/outline: 2px solid var\(--accent\)/);
  });

  it("keeps recently placed blocks subtly distinct without the member ring", () => {
    const body = ruleBody('.crew-build__tower li[data-recent="true"] button {');
    expect(body).not.toMatch(/--member-accent/);
    expect(body).toMatch(/box-shadow/);
  });

  it("keeps keyboard focus clearly visible", () => {
    const body = ruleBody(".crew-build__tower button:focus-visible {");
    expect(body).toMatch(/outline: 3px solid #fff/);
  });
});
