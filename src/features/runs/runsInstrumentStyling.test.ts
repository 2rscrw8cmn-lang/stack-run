/// <reference types="node" />
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The Runs visual pass, where it is a product decision rather than taste.
 *
 * There is no visual-regression harness in this repository, so a component test
 * cannot observe a computed style. These assert the stylesheet source directly,
 * for the handful of decisions this pass exists to make and must not lose:
 * fewer containers, one dominant reading, comfortable targets, a technical grid
 * that stays inside the data region, and no colour that grades the runner.
 */
const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "runsInstrument.css"), "utf8");

function ruleBody(source: string, selector: string): string {
  const start = source.indexOf(selector);
  expect(start, `selector not found: ${selector}`).toBeGreaterThanOrEqual(0);
  const open = source.indexOf("{", start);
  const close = source.indexOf("}", open);
  return source.slice(open + 1, close);
}

describe("Fewer boxes", () => {
  it("takes the panel off the runner snapshot", () => {
    const body = ruleBody(css, ".runs-screen .runner-snapshot__readings {");
    expect(body).toMatch(/border: 0/);
    expect(body).toMatch(/background: transparent/);
    expect(body).toMatch(/border-radius: 0/);
  });

  it("makes a run a row with a rule rather than a tile with a border", () => {
    const body = ruleBody(css, ".runs-screen .run-row {");
    expect(body).toMatch(/border: 0/);
    expect(body).toMatch(/border-bottom: 1px solid var\(--border\)/);
    expect(body).toMatch(/border-radius: 0/);
    expect(body).toMatch(/background: transparent/);
  });

  it("gives Training Signals the history's rhythm instead of its own cards", () => {
    const body = ruleBody(css, ".runs-screen .signal-cards .signal-card {");
    expect(body).toMatch(/border: 0/);
    expect(body).toMatch(/border-bottom: 1px solid var\(--border\)/);
    expect(body).toMatch(/border-radius: 0/);
    expect(body).toMatch(/background-color: transparent/);
  });

  it("keeps one observation per line at every width", () => {
    expect(ruleBody(css, ".runs-screen .signal-cards__list {")).toMatch(
      /grid-template-columns: minmax\(0, 1fr\)/,
    );
  });
});

describe("Hierarchy", () => {
  it("sets the lead reading apart by scale and edge, not by a container", () => {
    const body = ruleBody(css, '.runs-screen .runner-snapshot__grid > .runner-snapshot__reading[data-lead="true"] {');
    expect(body).toMatch(/border-left: 2px solid var\(--accent\)/);
    expect(body).not.toMatch(/background/);
    expect(body).not.toMatch(/border-radius/);

    const value = ruleBody(
      css,
      '.runs-screen .runner-snapshot__grid > [data-lead="true"] .runner-snapshot__value {',
    );
    // Instrument scale for the lead; the supporting readings stay small.
    expect(value).toMatch(/font-size: clamp\(34px/);
    expect(
      ruleBody(
        css,
        ".runs-screen .runner-snapshot__grid > .runner-snapshot__reading .runner-snapshot__value {",
      ),
    ).toMatch(/font-size: 18px/);
  });

  it("leaves the run count as metadata rather than a headline figure", () => {
    const body = ruleBody(css, ".runs-screen .runs-screen__count {");
    expect(body).toMatch(/font-size: 10px/);
    expect(body).toMatch(/text-transform: uppercase/);
  });

  it("gives distance the loudest type in a history row", () => {
    expect(ruleBody(css, ".runs-screen .run-row__distance {")).toMatch(/font-size: 17px/);
    expect(ruleBody(css, ".runs-screen .run-row__facts {")).toMatch(/font-size: 11px/);
  });
});

describe("Geometry", () => {
  it("keeps the technical grid inside the plot and off the page", () => {
    // The grid belongs to the data region. The chart element around it stops
    // carrying one so the strip does not read as a textured card.
    expect(ruleBody(css, ".runs-screen .plan-actual-chart--compact {")).toMatch(
      /background-image: none/,
    );
    expect(
      ruleBody(css, ".runs-screen .plan-actual-chart--compact .plan-actual-chart__plot {"),
    ).toMatch(/linear-gradient\(var\(--technical-grid-line\)/);
    // Nothing else on the screen gains a background image.
    expect(css.match(/background-image:/g)).toHaveLength(2);
  });

  it("does not give the overview plot padding the week targets cannot follow", () => {
    // `.plan-actual-chart__targets` is inset to the plot, so padding there
    // would slide every week's hit area off the column it selects.
    expect(
      ruleBody(css, ".runs-screen .plan-actual-chart--compact .plan-actual-chart__plot {"),
    ).not.toMatch(/(^|\s)padding:/);
  });

  it("squares off the marks that used to be pills and tiles", () => {
    expect(ruleBody(css, ".runs-screen .run-row__extra {")).toMatch(/border-radius: 0/);
    expect(ruleBody(css, ".runs-screen .run-row__icon {")).toMatch(/border-radius: 0/);
    expect(ruleBody(css, ".runs-screen .run-row__icon {")).toMatch(/background: transparent/);
  });
});

describe("Accessibility", () => {
  it("keeps every row a comfortable target that grows with its content", () => {
    for (const selector of [
      ".runs-screen .run-row {",
      ".runs-screen .signal-cards .signal-card {",
    ]) {
      const body = ruleBody(css, selector);
      expect(body).toMatch(/min-height: 52px/);
      expect(body).not.toMatch(/(^|\s)height:/);
    }
    expect(ruleBody(css, ".runs-screen .runs-screen__log {")).toMatch(/min-height: 44px/);
  });

  it("keeps a visible focus ring on the two controls that lost their border", () => {
    expect(ruleBody(css, ".runs-screen .runner-snapshot__readings:focus-visible {")).toMatch(
      /outline:/,
    );
    expect(ruleBody(css, ".runs-screen .run-row:focus-visible {")).toMatch(/outline:/);
  });

  it("never colours a signal by which way its measure moved", () => {
    // Direction is not judgment: rising is not green and falling is not red.
    expect(css).not.toMatch(/data-direction/);
    expect(ruleBody(css, ".runs-screen .signal-cards .signal-card__mark {")).toMatch(
      /color: var\(--text-muted\)/,
    );
  });

  it("adds no motion for a reduced-motion runner to have to opt out of", () => {
    expect(css).not.toMatch(/@keyframes/);
    expect(css).not.toMatch(/animation:/);
    // The only transitions are colour fades, which carry no information.
    for (const transition of css.match(/transition:[^;]+;/g) ?? []) {
      expect(transition).toMatch(/color|background/);
    }
  });
});

describe("Phone first", () => {
  it("lets long content shrink rather than push the page sideways", () => {
    // The middle column is the one that can hold a long source-supplied run
    // name; it has to be allowed to shrink below its content.
    expect(ruleBody(css, ".runs-screen .run-row {")).toMatch(
      /grid-template-columns: 20px minmax\(0, 1fr\) auto/,
    );
    expect(
      ruleBody(css, ".runs-screen .runner-snapshot__grid > .runner-snapshot__reading {"),
    ).toMatch(/min-width: 0/);
    expect(ruleBody(css, ".runs-screen .run-row__type {")).toMatch(/text-overflow: ellipsis/);
    // Only marks and rails carry a fixed width, and none of them is wide.
    for (const width of css.match(/(?<![-a-z])width: (\d+)px/g) ?? []) {
      expect(Number(width.replace(/\D/g, ""))).toBeLessThanOrEqual(24);
    }
  });

  it("carries an explicit narrow-phone pass rather than trusting the clamp", () => {
    expect(css).toMatch(/@media \(max-width: 340px\)/);
  });
});
