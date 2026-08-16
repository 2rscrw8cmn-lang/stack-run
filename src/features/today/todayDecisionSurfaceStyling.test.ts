/// <reference types="node" />
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * NEXT-4 Today styling.
 *
 * There is no visual-regression harness in this repository, so a component test
 * cannot observe a computed style. These assert the stylesheet source directly,
 * for the properties of this screen that are product decisions rather than
 * taste: Today must stay calmer than Runs, it must not grade the runner, and it
 * must not leave behind the rules of the surfaces it replaced.
 */
const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "todayDecisionSurface.css"), "utf8");
const components = readFileSync(
  join(here, "..", "..", "styles", "components.css"),
  "utf8",
);

function ruleBody(source: string, selector: string): string {
  const start = source.indexOf(selector);
  expect(start, `selector not found: ${selector}`).toBeGreaterThanOrEqual(0);
  const open = source.indexOf("{", start);
  const close = source.indexOf("}", open);
  return source.slice(open + 1, close);
}

describe("Today observation styling", () => {
  it("never colours the observation by which way the measure moved", () => {
    // A rising/falling colour would turn an observation into a grade, which is
    // exactly what the signal domain refuses to produce.
    expect(css).not.toMatch(/data-direction="(rising|falling|steady)"/);
    expect(ruleBody(css, ".today-signal__mark,")).toMatch(
      /color: var\(--text-muted\)/,
    );
  });

  it("stays a comfortable target and grows with its sentence", () => {
    const body = ruleBody(css, ".today-signal {");
    expect(body).toMatch(/min-height: 44px/);
    expect(body).toMatch(/width: 100%/);
    expect(body).not.toMatch(/(^|\s)height:/);
  });

  it("keeps a visible focus ring, because the whole row is the control", () => {
    expect(ruleBody(css, ".today-signal:focus-visible {")).toMatch(/outline:/);
  });
});

describe("Today recent-training styling", () => {
  it("is a line of facts rather than a shelf of KPI tiles", () => {
    const body = ruleBody(css, ".today-context__reading {");
    expect(body).not.toMatch(/border/);
    expect(body).not.toMatch(/background/);
    expect(body).not.toMatch(/box-shadow/);
  });

  it("never lays out more than the three readings the model allows", () => {
    expect(ruleBody(css, ".today-context {")).toMatch(
      /grid-template-columns: repeat\(var\(--today-readings, 3\)/,
    );
    expect(css).toMatch(/\.today-context\[data-readings="2"\]/);
  });

  it("keeps three readings legible at the narrowest supported width", () => {
    const narrow = css.indexOf("@media (max-width: 340px)");
    expect(narrow).toBeGreaterThan(0);
    expect(css.slice(narrow)).toMatch(/\.today-context__value \{ font-size/);
  });
});

describe("Today rules the revision replaced", () => {
  it("leaves no styling behind for the week's deleted actual-totals list", () => {
    expect(components).not.toMatch(/this-week__actuals/);
  });

  it("leaves no rest-day card styling behind, now that rest is a note", () => {
    expect(components).not.toMatch(/today-workout-card--rest/);
  });
});
