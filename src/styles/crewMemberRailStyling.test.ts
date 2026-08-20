/// <reference types="node" />
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Crew Build/Comparison have no CSS/visual-regression harness (no
 * Playwright, no `css: true` in the vitest config), so component tests
 * can't observe real computed styles. This asserts the stylesheet source
 * directly to guard the Crew Build's member rail and its comparison rows:
 * the rail must stay one row however many runners join (issue #120), and a
 * comparison row must hold the same height across metrics (issue #86).
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

describe("Crew Build member rail styling (issue #120)", () => {
  it("keeps the runner rail to a single scrolling row rather than wrapping", () => {
    const body = ruleBody(".crew-build__rail {");
    expect(body).toMatch(/flex-wrap:\s*nowrap/);
    expect(body).toMatch(/overflow-x:\s*auto/);
    expect(body).not.toMatch(/flex-wrap:\s*wrap/);
  });

  it("gives each runner icon a full 44px target", () => {
    const body = ruleBody(".crew-build__rail-runner {");
    expect(body).toMatch(/width:\s*44px/);
    expect(body).toMatch(/min-height:\s*44px/);
  });

  it("no longer ships the removed Member Build card styles", () => {
    // The main Crew screen's mini-Build rail is gone (issue #120); the full
    // Build lives in Crew Profile, which draws it with `.crew-build`.
    expect(css).not.toMatch(/\.crew-build-card\b/);
    expect(css).not.toMatch(/\.crew-mini-build\b/);
    expect(css).not.toMatch(/\.crew-builds__rail\b/);
  });

  it("keeps the comparison value and its detail on one reading line", () => {
    // A two-row stack here is what made rows taller than the single-value
    // metrics; it must stay a single flex line.
    const body = ruleBody(".crew-comparison__reading {");
    expect(body).toMatch(/display:\s*flex/);
    expect(body).not.toMatch(/display:\s*grid/);
  });
});
