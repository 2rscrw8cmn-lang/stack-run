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

/*
 * The geometry the whole tower rests on (issues #204, #205, #206, #207).
 *
 * A brick is a *wide* object and a rotation is an honest one, and those two
 * wants collided. Making a column square got rotation right and turned the
 * tower into a wall of tiles; declaring a course height against `1fr` columns
 * got the proportions back and made a horizontal step a different length from
 * a vertical one, so a turned block stopped being the same rectangle.
 *
 * The stylesheet's half of the answer: place on a finer grid whose cell is
 * square, and build the visible brick out of two of them.
 */
describe("the square placement unit (issue #206)", () => {
  it("draws both grid axes with the same square unit", () => {
    const grid = ruleBody(".built-tower {");

    // The same length on both axes. This is the whole of what makes a turned
    // block keep its physical rectangle.
    expect(grid).toMatch(
      /grid-template-columns:\s*repeat\(var\(--grid-units\), var\(--tower-unit\)\)/,
    );
    expect(grid).toMatch(
      /grid-template-rows:\s*repeat\(var\(--grid-courses\), var\(--tower-unit\)\)/,
    );
    // And no context may quietly re-declare a course height in pixels, which
    // is what would un-square the unit again.
    expect(css.match(/--course-height:\s*\d+px/g) ?? []).toEqual([]);
  });

  it("builds a visible column out of two units, so the brick stays 2:1", () => {
    const field = ruleBody(".tower-field {");

    expect(field).toMatch(/--units-per-column:\s*2/);
    expect(field).toMatch(/--course-height:\s*var\(--tower-unit\)/);
    expect(field).toMatch(
      /--tower-column:\s*calc\(var\(--tower-unit\) \* var\(--units-per-column\)\)/,
    );
    // The oblique stays 2:1 by construction rather than by two numbers that
    // have to be kept in step, and it is a share of a unit so it holds at
    // every size the field resolves to.
    expect(field).toMatch(/--iso-run:\s*calc\(var\(--tower-unit\) \* var\(--iso-run-ratio/);
    expect(field).toMatch(/--iso-rise:\s*calc\(var\(--iso-run\) \/ 2\)/);
  });

  it("keeps the tower compact by capping the unit against the width it is given", () => {
    const field = ruleBody(".tower-field {");

    // A context asks for a course height; the field pays the smaller of that
    // and what sixteen units plus the oblique's own share actually fit in.
    // That is what keeps a phone's tower compact instead of panning sideways,
    // and it is why the unit is derived rather than declared.
    expect(field).toMatch(/--tower-unit:\s*min\(/);
    expect(field).toMatch(/var\(--course-nominal/);
    expect(field).toMatch(/100cqw \/ \(var\(--grid-units[^)]*\) \+ var\(--iso-run-ratio/);
    // ...measured against a real container on every surface that draws one.
    for (const selector of [
      "\n.build-site__stage {",
      "\n.crew-build__stage {",
    ]) {
      expect(ruleBody(selector)).toMatch(/container-type:\s*inline-size/);
    }
  });

  it("keeps the Personal Build brick the compact 2:1 STACK brick", () => {
    const site = ruleBody(".build-site {");

    // 26px a course, 52px a column: the proportions the tower had before
    // rotation, not the square tile #206 was written about.
    expect(customProperty(site, "--course-nominal")).toBe(26);
    expect(site).toMatch(/--iso-run-ratio:\s*0\.6/);
  });
});

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
   * its own tile, its own air, and its own colour.
   */
  it("separates each crew figure with air and a rule, not a frame", () => {
    const stats = ruleBody(".crew-build__stats {");
    const tile = ruleBody(".crew-build__stat {");

    // Air between the four, not a shared edge.
    const gap = /gap:\s*(\d+)px/.exec(stats);
    expect(gap, "no gap between the figures").not.toBeNull();
    expect(Number(gap![1])).toBeGreaterThan(0);

    // No box around the figure and no ground under it: the coloured rule
    // across the top is the whole of the separation.
    expect(tile).toMatch(/border:\s*0/);
    expect(tile).not.toMatch(/border-left:|border-right:|border-bottom:/);
    expect(tile).toMatch(/background:\s*none/);
    expect(tile).not.toMatch(/background:\s*var\(/);
    // Nothing left to round off either.
    expect(tile).toMatch(/border-radius:\s*0/);
  });

  /*
   * The bar across the top is what actually delimits one figure from the
   * next — it is read before any digit is. Each of the four is a different
   * hue, and every hue is its own token rather than one borrowed from the
   * activity or zone palettes, which would attach a meaning these do not have.
   */
  it("rules each figure off with its own colour bar", () => {
    const tile = ruleBody(".crew-build__stat {");
    const bar = /border-top:\s*(\d+)px solid var\(--crew-stat-colour\)/.exec(tile);
    expect(bar, "no colour bar above the figure").not.toBeNull();
    // Thick enough to register as a bar, not as an edge.
    expect(Number(bar![1])).toBeGreaterThanOrEqual(3);

    const hues = ["miles", "runs", "time", "runners"].map((stat) => {
      const rule = ruleBody(`.crew-build__stat--${stat} {`);
      const match = /--crew-stat-colour:\s*var\((--crew-stat-[a-z]+)\)/.exec(rule);
      expect(match, `${stat} has no colour`).not.toBeNull();
      return match![1];
    });
    // Four figures, four distinct colours.
    expect(new Set(hues).size).toBe(4);

    // And each one is defined, as its own token rather than an activity or
    // zone colour wearing a second meaning.
    const tokens = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "tokens.css"),
      "utf8",
    );
    for (const hue of hues) {
      expect(tokens, `${hue} is not defined`).toMatch(
        new RegExp(`${hue}:\\s*#[0-9a-f]{6}`, "i"),
      );
    }
  });

  /*
   * The mock this row was drawn from set a small block icon beside every
   * number. It went: the tile shows one figure, an icon is a second thing to
   * decode, and four of them start competing with the blocks below.
   */
  it("puts nothing beside the number but the number", () => {
    const stats = ruleBody(".crew-build__stats {");
    expect(stats).not.toMatch(/flex/);
    // No generated content hanging off the figure or its label.
    expect(css).not.toMatch(/\.crew-build__stat(s)?[^{]*::(before|after)/);
  });

  /*
   * The label is what names the figure above it, so it has to survive being
   * read at a glance — `--text-subtle` at 8px did not. Issue #150 moved the
   * size onto the product-wide token for exactly this job, so the floor now
   * moves with `--type-label` instead of with a number written here.
   */
  it("keeps the figure labels legible rather than decorative", () => {
    const label = ruleBody(".crew-build__stats dt {");

    expect(label).toMatch(/color:\s*var\(--text-muted\)/);
    expect(label).toMatch(/font-size:\s*var\(--type-label\)/);
  });

  /*
   * The panels are a caption for the tower. They sit on `--surface-strong`,
   * which is dimmer than the field's own frame, so the row cannot become the
   * brightest thing on a page whose whole point is the structure below it.
   */
  it("carries the figure's colour in the number rather than a filled panel", () => {
    const tile = ruleBody(".crew-build__stat {");
    const figure = ruleBody(".crew-build__stats dd {");

    // The number takes the same hue as the rule above it, which is what ties
    // the two together now that no box does.
    expect(figure).toMatch(/color:\s*var\(--crew-stat-colour\)/);
    // And the colour stays in the rule and the digits: no wash of it behind
    // them, which would put the row ahead of the tower it captions.
    expect(tile).not.toMatch(/background:\s*var\(--crew-stat/);
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
    // would make the section bigger and the build no bigger at all. The unit
    // stays square whatever it resolves to, so this changes the tower's size
    // and never its proportions.
    expect(customProperty(page, "--course-nominal")).toBeGreaterThan(
      customProperty(shared, "--course-nominal"),
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

describe("Crew Build placement hierarchy (issues #154, #204)", () => {
  /*
   * Issue #154 put the Crew controls in the construction field so a bottom
   * sheet could not cover the tower being built on. Issue #204 found the cost:
   * in the flow of the field the row landed wherever the tower happened to
   * end, which on a tall tower is underneath the sticky nav — and with
   * `z-index: 2` against the nav's `1`, it painted straight through it.
   *
   * So the rule changed from "never fixed" to what #154 was actually
   * protecting: the controls stay one compact row that does not cover the
   * tower, and they are always reachable. Pinning above the nav delivers both;
   * sitting in the flow delivered neither once the tower grew.
   */
  it("keeps the controls clear of the bottom nav rather than painting over it", () => {
    const bar = ruleBody("\n.placement-bar {");

    expect(bar).toMatch(/position:\s*fixed/);
    // Clearance is the nav's *rendered* height plus its safe-area inset.
    // `--bottom-nav-height` is only the item's min-height floor, and the nav
    // draws about 12px taller than it — clearing the floor is what left the
    // controls sitting on the tab bar in the first place.
    expect(bar).toMatch(/bottom:\s*calc\(var\(--bottom-nav-clearance\)/);
    expect(bar).toMatch(/env\(safe-area-inset-bottom\)/);
    expect(bar).not.toMatch(/bottom:\s*calc\(var\(--bottom-nav-height\)/);

    // Above the nav's stacking level, so a translucent nav cannot show
    // through the controls sitting on top of it.
    const barZ = Number(/z-index:\s*(\d+)/.exec(bar)![1]);
    const navZ = Number(
      /z-index:\s*(\d+)/.exec(
        readFileSync(
          join(dirname(fileURLToPath(import.meta.url)), "layout.css"),
          "utf8",
        ).split(".app-shell__nav {")[1],
      )![1],
    );
    expect(barZ).toBeGreaterThan(navZ);
  });

  it("stays one compact row rather than a sheet over the tower", () => {
    // What #154 was really guarding. The old Personal sheet carried a colour
    // chip, a title, a position readout and a separate Auto Place link — four
    // rows of furniture across the tower it was placing onto. None of it
    // exists any more: the block in hand names itself in the field instead.
    for (const gone of [
      ".placement-bar__chip",
      ".placement-bar__detail",
      ".placement-bar__title",
      ".placement-bar__position",
      ".placement-bar--field",
    ]) {
      expect(css.includes(gone), `sheet furniture came back: ${gone}`).toBe(false);
    }
  });

  it("keeps every compact utility target at the 44px interaction floor", () => {
    const controls = ruleBody(".placement-bar__controls .icon-button {");

    expect(controls).toMatch(/min-width:\s*44px/);
    expect(controls).toMatch(/min-height:\s*44px/);
  });

  it("makes valid landings legible and the candidate structurally stronger", () => {
    const valid = ruleBody(
      '.crew-build[data-placing="true"] .built-tower__slot-button {',
    );
    const chosen = ruleBody(
      '.crew-build[data-placing="true"] .built-tower__slot[data-chosen="true"] .built-tower__slot-button {',
    );

    expect(valid).toMatch(/border-color:.*--accent/);
    expect(valid).toMatch(/background:.*--accent/);
    expect(chosen).toMatch(/border-width:\s*2px/);
    expect(chosen).toMatch(/background:.*--piece-color/);
    expect(chosen).toMatch(/box-shadow:/);
  });

  it("uses a quiet identity strip rather than another instruction panel", () => {
    // Shared by both towers now, so the class is no longer Crew's own.
    const context = ruleBody(".placement-context {");

    expect(context).toMatch(/border-bottom:\s*1px solid var\(--border-strong\)/);
    expect(context).not.toMatch(/background:/);
    expect(context).not.toMatch(/border-left:/);
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
