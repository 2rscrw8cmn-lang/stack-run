/// <reference types="node" />
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Crew Build has no CSS/visual-regression harness (no Playwright, no
 * `css: true` in the vitest config), so component tests can't observe real
 * computed styles. This asserts the stylesheet source directly.
 *
 * Issue #65 supersedes issue #54's ownership decision: Crew blocks now
 * render with Personal Build's own `.placed-block`/`Brick` primitive and are
 * coloured by the runner's stable member accent — a whole-block colour
 * change made in `CrewBuild.tsx` (`memberPieceColor`), not by a CSS rule, so
 * there is no `--member-accent`-keyed block rule left to guard here. What
 * this file still guards: Crew Build has not grown a second, parallel block
 * renderer alongside the shared one, and the pieces that remain genuinely
 * Crew-specific (the legend marker, the recently-placed treatment) keep
 * ownership legible.
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

describe("Crew Build ownership styling (issue #65, superseding #54)", () => {
  it("has no parallel block/monogram/face rules left over from the pre-#65 renderer", () => {
    // These selectors named the old bespoke Crew block markup. Their absence
    // is the guard: a reappearance means Crew Build grew a second renderer
    // instead of reusing Personal Build's `Brick` primitive.
    for (const deadSelector of [
      ".crew-build__block {",
      ".crew-build__monogram {",
      ".crew-build__face {",
      ".crew-build__preview {",
      ".crew-build__placement-controls {",
    ]) {
      expect(css.includes(deadSelector), `stale selector reappeared: ${deadSelector}`).toBe(false);
    }
  });

  it("dims placed blocks behind the shared class while a new one is being positioned", () => {
    const body = ruleBody('.crew-build__tower[data-placement-grid="true"] > .placed-block {');
    expect(body).toMatch(/opacity/);
  });

  /**
   * The legend's generic member dot became the runner's own icon (issue #71).
   * Ownership still has to be readable there, and it now rides on the icon's
   * plates — the same `--member-accent` the blocks in the tower use, so a
   * runner's legend entry and their bricks can never disagree.
   */
  it("keeps ownership legible in the legend mark", () => {
    expect(css.includes(".crew-member-marker {"), "the retired member dot reappeared").toBe(false);
    expect(ruleBody(".runner-icon__plate {")).toMatch(/--member-accent/);
  });

  it("keeps recently placed blocks subtly distinct on the shared brick, without a colour ring", () => {
    const body = ruleBody('.crew-build__tower li[data-recent="true"] .placed-block__brick {');
    expect(body).not.toMatch(/--member-accent/);
    expect(body).toMatch(/filter|box-shadow/);
  });
});
