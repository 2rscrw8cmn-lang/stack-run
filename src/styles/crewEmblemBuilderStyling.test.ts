/// <reference types="node" />
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CREW_EMBLEM_LAYERS } from "../crew/emblem";

/**
 * There is no CSS/visual-regression harness in this repository (no Playwright,
 * no `css: true` in the vitest config), so a component test cannot observe a
 * real computed style. This asserts the stylesheet source directly, for the
 * one behaviour of the rebuilt Crew Emblem builder that only exists in CSS:
 * three libraries of 13–29 options each have to grow without either shrinking
 * the tiles below the size art can be judged at or pushing the page sideways
 * on a 320px phone.
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

describe("Crew Emblem builder styling (issue #96)", () => {
  it("scrolls each library sideways instead of shrinking its tiles", () => {
    const rail = ruleBody(".crew-emblem-builder__rail {");
    expect(rail).toMatch(/overflow-x:\s*auto/);
    // A fixed track width is what makes the rail scroll rather than divide the
    // row into thirty slivers, and it is what leaves the next tile peeking.
    expect(rail).toMatch(/grid-auto-flow:\s*column/);
    expect(rail).toMatch(/grid-auto-columns:\s*(\d+)px/);
    const track = Number(rail.match(/grid-auto-columns:\s*(\d+)px/)![1]);
    expect(track).toBeGreaterThanOrEqual(44);
  });

  it("keeps the rail's scrolling to itself so the page never moves sideways", () => {
    const rail = ruleBody(".crew-emblem-builder__rail {");
    expect(rail).toMatch(/min-width:\s*0/);
    expect(rail).toMatch(/max-width:\s*100%/);
    expect(rail).toMatch(/overscroll-behavior-x:\s*contain/);
    // Grid and flex children default to a min-content floor, which a row meant
    // to scroll would otherwise impose on the whole sheet.
    expect(ruleBody(".crew-emblem-builder {")).toMatch(/min-width:\s*0/);
    expect(ruleBody(".crew-emblem-builder > * {")).toMatch(/min-width:\s*0/);
    expect(ruleBody(".crew-emblem-builder__row {")).toMatch(/min-width:\s*0/);
  });

  it("lays the libraries out flat once there is room for them", () => {
    const start = css.indexOf("@media (min-width: 560px)", css.indexOf(".crew-emblem-builder"));
    expect(start).toBeGreaterThanOrEqual(0);
    const block = css.slice(start, css.indexOf("\n}", css.indexOf("\n  }", start)));
    expect(block).toContain(".crew-emblem-builder__rail");
    expect(block).toMatch(/grid-auto-flow:\s*row/);
  });

  it("pins the preview above the libraries while they scroll", () => {
    const stage = ruleBody(".crew-emblem-builder__stage {");
    expect(stage).toMatch(/position:\s*sticky/);
    expect(stage).toMatch(/top:\s*0/);
  });

  it("marks the chosen tile without making it visually heavy", () => {
    const selected = ruleBody('.crew-emblem-builder__thumb[aria-pressed="true"] {');
    expect(selected).toMatch(/border-color:/);
    expect(selected).not.toMatch(/transform:/);
    expect(selected).not.toMatch(/font-weight:/);
  });

  /**
   * The tile shows the candidate against the rest of the current emblem: an
   * accent is only a good choice in combination, so the layers it is not
   * offering stay visible but dimmed.
   */
  it("dims the layers a tile is not offering rather than hiding them", () => {
    const dimmed = ruleBody(".crew-emblem-builder__thumb-mark[data-focus-layer] > g > g {");
    const opacity = Number(dimmed.match(/opacity:\s*([\d.]+)/)?.[1]);
    expect(opacity).toBeGreaterThan(0);
    expect(opacity).toBeLessThan(1);
    // Every layer can be the lit one, including any added since.
    for (const layer of CREW_EMBLEM_LAYERS) {
      expect(css).toContain(
        `.crew-emblem-builder__thumb-mark[data-focus-layer="${layer}"] .crew-emblem__${layer}`,
      );
    }
  });

  it("keeps colour swatches big enough to hit on a phone", () => {
    const swatch = ruleBody(".crew-emblem-builder__swatch {");
    expect(Number(swatch.match(/min-width:\s*(\d+)px/)![1])).toBeGreaterThanOrEqual(30);
    // The eight swatches share the row and stop growing rather than stretching
    // into eight buttons the width of the sheet on a desktop.
    expect(swatch).toMatch(/max-width:\s*\d+px/);
    expect(ruleBody(".crew-emblem-builder__colors {")).toMatch(/flex-wrap:\s*wrap/);
  });
});
