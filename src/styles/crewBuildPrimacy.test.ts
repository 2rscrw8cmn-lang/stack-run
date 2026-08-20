/// <reference types="node" />
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Issue #137: the Crew page, rebuilt around the tower.
 *
 * There is no CSS/visual-regression harness here (no Playwright, no
 * `css: true` in the vitest config), so a component test cannot observe a
 * computed border or a viewport height. This asserts the stylesheet source
 * directly, the same way `crewBuildOwnership.test.ts` does.
 *
 * What it guards is the part of the redesign a component test genuinely
 * cannot see: one frame instead of two, a quiet frame rather than a neon one,
 * and a field that is actually bigger rather than one with more empty sky
 * above the same-sized tower.
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

function customProperty(body: string, name: string): number {
  const match = new RegExp(`${name}:\\s*(\\d+)px`).exec(body);
  expect(match, `${name} not set`).not.toBeNull();
  return Number(match![1]);
}

function viewportCap(body: string): number {
  const match = /min\((\d+)dvh/.exec(body);
  expect(match, "no dvh cap on the viewport").not.toBeNull();
  return Number(match![1]);
}

describe("Crew Build primacy styling (issue #137)", () => {
  const page = ruleBody(".crew-build--page {");
  const shared = ruleBody("\n.crew-build {");

  it("drops the outer card so only the build field is framed", () => {
    // The section itself: no border, no card padding, nothing to nest the
    // stage's own frame inside.
    expect(page).toMatch(/border:\s*0/);
    expect(page).toMatch(/padding:\s*0/);
    // And the `technical-grid` card class is off the element entirely, so the
    // section cannot bring a second border and a second grid back with it.
    expect(css).not.toMatch(/\.crew-build\.technical-grid/);
  });

  /*
   * Four numbers in a row at heading size read as one long number. The row is
   * only useful if the eye can tell where each figure stops, so each one gets
   * its own panel and its own air.
   */
  it("gives each crew figure its own panel instead of a hairline divider", () => {
    const stats = ruleBody(".crew-build__stats {");
    const figure = ruleBody(".crew-build__stats > div {");

    // Air between the four, not a shared edge.
    const gap = /gap:\s*(\d+)px/.exec(stats);
    expect(gap, "no gap between the figures").not.toBeNull();
    expect(Number(gap![1])).toBeGreaterThan(0);

    // A panel: bordered on every side and lifted off the page, rather than a
    // single `border-left` rule standing between two numbers.
    expect(figure).toMatch(/border:\s*1px solid/);
    expect(figure).not.toMatch(/border-left:/);
    expect(figure).toMatch(/background:\s*var\(--surface-strong\)/);
    expect(figure).toMatch(/padding:\s*\d/);
  });

  /*
   * The label is what names the figure above it, so it has to survive being
   * read at a glance — `--text-subtle` at 8px did not.
   */
  it("keeps the figure labels legible rather than decorative", () => {
    const label = ruleBody(".crew-build__stats dt {");

    expect(label).toMatch(/color:\s*var\(--text-muted\)/);
    const size = /font-size:\s*(\d+)px/.exec(label);
    expect(size, "no label font size").not.toBeNull();
    expect(Number(size![1])).toBeGreaterThanOrEqual(9);
  });

  /*
   * The panels are a caption for the tower. They sit on `--surface-strong`,
   * which is dimmer than the field's own frame, so the row cannot become the
   * brightest thing on a page whose whole point is the structure below it.
   */
  it("keeps the stats row dimmer than the field it captions", () => {
    const figure = ruleBody(".crew-build__stats > div {");

    expect(figure).not.toMatch(/var\(--accent\)/);
    expect(figure).toMatch(/border:\s*1px solid var\(--border\)/);
  });

  it("keeps the one remaining frame quieter than the blocks it holds", () => {
    const stage = ruleBody(".crew-build--page .crew-build__stage {");
    expect(stage).toMatch(/border-color:\s*var\(--border-strong\)/);
    // The lime inset glow went with the outer card: the frame says where the
    // site ends and stops competing with the bricks for the page's colour.
    expect(stage).toMatch(/box-shadow:\s*none/);
    expect(stage).not.toMatch(/accent/);
  });

  it("still lights the frame while a block is being placed", () => {
    // The one moment the frame should speak: the site is live.
    const placing = ruleBody('.crew-build--page[data-placing="true"] .crew-build__stage {');
    expect(placing).toMatch(/border-color:.*--accent/);
  });

  it("scales the tower itself rather than pouring in more empty sky", () => {
    // A taller course grows the bricks and the grid together. Headroom alone
    // would make the section bigger and the build no bigger at all.
    expect(customProperty(page, "--course-height")).toBeGreaterThan(
      customProperty(shared, "--course-height"),
    );
    // The oblique stays 2:1 with the course, so the bricks keep their shape.
    expect(customProperty(page, "--iso-run")).toBe(
      customProperty(page, "--iso-rise") * 2,
    );
  });

  it("gives the field roughly a quarter more height than the old treatment", () => {
    const before = viewportCap(ruleBody(".crew-build__viewport {"));
    const after = viewportCap(ruleBody(".crew-build--page .crew-build__viewport {"));
    expect(after).toBeGreaterThanOrEqual(Math.round(before * 1.2));
  });

  it("keeps the Member Build inside Crew Profile out of all of it", () => {
    // `.crew-build` is shared with a small tower on a sheet, which wants none
    // of the page treatment — every rule above is `--page`-scoped for that
    // reason, and the shared base still carries its own card padding.
    expect(shared).toMatch(/padding:/);
  });
});

describe("Manually logged block styling (issue #129)", () => {
  it("marks a manual block with a subordinate asterisk and nothing else", () => {
    const body = ruleBody(".placed-block__manual {");
    // Smaller and dimmer than the mileage it qualifies.
    expect(body).toMatch(/font-size:\s*9px/);
    expect(body).toMatch(/opacity:/);
    // No badge, no icon, no corner treatment, no colour of its own: it
    // inherits the face's.
    expect(body).not.toMatch(/background|border|color:|content:/);
  });
});
