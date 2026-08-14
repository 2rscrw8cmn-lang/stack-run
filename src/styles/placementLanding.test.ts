/// <reference types="node" />
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The Build landing is CSS, and there is no visual-regression harness here
 * (no Playwright, no `css: true` in the vitest config), so the stylesheet
 * source is asserted directly — the same approach `crewBuildOwnership.test.ts`
 * takes.
 *
 * What this guards is issue #76's central rule: **one** landing, worn by both
 * Builds. A Crew-only drop animation appearing beside this one is the failure
 * mode, and it would pass every component test.
 */
const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "components.css"),
  "utf8",
);

function ruleBody(selector: string, from = 0): string {
  const start = css.indexOf(selector, from);
  expect(start, `selector not found: ${selector}`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf("{", start);
  // Brace-matched, because keyframes and media queries nest their own rules.
  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === "{") depth += 1;
    if (css[index] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, index);
    }
  }
  throw new Error(`unterminated rule: ${selector}`);
}

describe("shared Build landing (issue #76)", () => {
  it("falls, squashes and settles from one rule on the shared block class", () => {
    const brick = ruleBody(
      '.placed-block[data-just-placed="true"] .placed-block__brick {',
    );
    // Personal and Crew both render `.placed-block`, so this one selector is
    // the whole implementation for both towers.
    expect(brick).toMatch(/animation:\s*placed-block-drop/);
    // Compression happens against the course below, not around the middle.
    expect(brick).toMatch(/transform-origin:\s*bottom/);

    const drop = ruleBody("@keyframes placed-block-drop {");
    expect(drop).toMatch(/translateY\(calc\(-1 \* var\(--drop-fall\)\)\)/);
    expect(drop).toMatch(/var\(--drop-squash\)/);
    expect(drop).toMatch(/var\(--drop-rebound\)/);
    // No spin, and nothing that would leave the block off its placement.
    expect(drop).not.toMatch(/rotate|perspective/);
  });

  it("scales the impact by footprint without leaving the arcade", () => {
    const light = ruleBody(
      '.placed-block[data-just-placed="true"][data-impact="light"] {',
    );
    const heavy = ruleBody(
      '.placed-block[data-just-placed="true"][data-impact="heavy"] {',
    );
    const squashOf = (body: string) =>
      Number(/--drop-squash:\s*([\d.]+)/.exec(body)![1]);

    // Heavier compresses more than lighter...
    expect(squashOf(heavy)).toBeLessThan(squashOf(light));
    // ...and even the heaviest stays a compression, not a pancake.
    expect(squashOf(heavy)).toBeGreaterThan(0.85);
  });

  /**
   * The fall has to be tall enough to watch and short enough to stay inside
   * the site. `--drop-fall-max` is both halves of that bargain: the ceiling on
   * every fall, and the headroom each sky holds open above its tower.
   */
  it("never falls further than the sky it falls through", () => {
    const coursesIn = (body: string, property: string) =>
      Number(
        new RegExp(
          `${property}:\\s*calc\\(var\\(--course-height\\) \\* ([\\d.]+)\\)`,
        ).exec(body)![1],
      );
    const max = coursesIn(ruleBody(".build-site {"), "--drop-fall-max");
    expect(coursesIn(ruleBody(".crew-build {"), "--drop-fall-max")).toBe(max);

    // High enough to enjoy — this is a fall, not a nudge.
    expect(max).toBeGreaterThanOrEqual(3);

    const fallOf = (selector: string) =>
      coursesIn(ruleBody(selector), "--drop-fall");
    expect(fallOf('.placed-block[data-just-placed="true"] {')).toBeLessThanOrEqual(max);
    expect(
      fallOf('.placed-block[data-just-placed="true"][data-impact="light"] {'),
    ).toBeLessThanOrEqual(max);
    // The heaviest block falls the whole height there is.
    expect(
      ruleBody('.placed-block[data-just-placed="true"][data-impact="heavy"] {'),
    ).toMatch(/--drop-fall:\s*var\(--drop-fall-max\)/);

    // Both sites hold that much sky open, so neither clips the start of a fall.
    expect(ruleBody(".build-site__sky {")).toMatch(
      /min-height:\s*var\(--drop-fall-max\)/,
    );
    expect(ruleBody(".crew-build__sky {")).toMatch(
      /min-height:\s*var\(--drop-fall-max\)/,
    );
  });

  it("keeps a field open on Personal Build while a block is in hand", () => {
    // Collapsing the stage to nothing left Personal placement in a box half
    // the height of Crew's field, with no room for the block to fall from.
    const body = ruleBody(
      '.build-screen[data-placing="true"] .build-site__stage {',
    );
    expect(body).not.toMatch(/min-height:\s*0/);
    expect(body).toMatch(/min-height:\s*min\(/);
  });

  it("answers the landing on both grounds and nowhere else", () => {
    // The site response is subtle and shared: no screen shake, no camera.
    expect(css).toMatch(
      /\.build-site__ground\[data-impact\],\s*\n\s*\.crew-build__ground\[data-impact\] \{/,
    );
    const settle = ruleBody("@keyframes build-ground-settle {");
    // A 1px settle of the ground plane for the largest footprints, with the
    // plane's own skew preserved so it cannot flatten mid-landing.
    expect(settle).toMatch(/skewX\(-63\.435deg\)/);
    expect(settle).toMatch(/translateY\(1px\)/);
  });

  it("has no second, Crew-only landing animation", () => {
    for (const deadSelector of [
      "crew-build-drop",
      "crew-block-settle",
      ".crew-build__tower li[data-just-placed",
    ]) {
      expect(
        css.includes(deadSelector),
        `Crew grew its own landing: ${deadSelector}`,
      ).toBe(false);
    }
  });

  it("switches the whole landing off under Reduce Motion", () => {
    // The landing's own reduced-motion clause: the first one after the ground
    // keyframes, rather than any of the stylesheet's others.
    const block = ruleBody(
      "@media (prefers-reduced-motion: reduce)",
      css.indexOf("@keyframes build-ground-settle {"),
    );
    // The brick, the glow and both grounds: nothing moves, and the new brick
    // is marked by a static ring instead.
    expect(block).toMatch(/\.placed-block__brick \{\s*animation: none/);
    expect(block).toMatch(/\.build-site__ground\[data-impact\]/);
    expect(block).toMatch(/\.crew-build__ground\[data-impact\]/);
    expect(block).toMatch(/inset 0 0 0 2px var\(--accent\)/);
  });
});
