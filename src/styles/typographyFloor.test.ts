/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Stabilization 1.08 — the readable phone floor, enforced.
 *
 * STACK collected 7–9px labels because each pass only looked at the surface it
 * was changing, and nothing in the build could see the whole picture. There is
 * no visual-regression harness here (no Playwright, no `css: true` in the
 * vitest config), so this reads the stylesheets themselves: no product CSS may
 * declare a font size below the floor, and the two exceptions are named here
 * rather than left to be rediscovered.
 *
 * `docs/DESIGN_SYSTEM.md` — "Type scale and the phone floor" — is the contract
 * this test enforces.
 */
const src = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Text stamped into a Build object's face. Both are `aria-hidden` decoration
 * of facts the block's accessible name states in full, on an object whose
 * width is its footprint in the tower. See the comments at each rule.
 */
const BLOCK_FACE_EXCEPTIONS = ["placed-block__unit", "placed-block__manual"];

/** The QA review harness is not product UI; it ships behind the QA account. */
const NOT_PRODUCT_UI = ["qa/"];

const FLOOR = 10;

function stylesheets(directory = ""): string[] {
  return readdirSync(join(src, directory), { withFileTypes: true }).flatMap((entry) => {
    const path = directory ? `${directory}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return stylesheets(path);
    return entry.name.endsWith(".css") ? [path] : [];
  });
}

function productStylesheets(): { path: string; css: string }[] {
  return stylesheets()
    .filter((path) => !NOT_PRODUCT_UI.some((prefix) => path.startsWith(prefix)))
    .sort()
    .map((path) => ({ path, css: readFileSync(join(src, path), "utf8") }));
}

/** Every `font-size: <n>px` in a stylesheet, with the rule it belongs to. */
function pixelSizes(css: string): { size: number; selector: string; line: number }[] {
  const lines = css.split("\n");
  const found: { size: number; selector: string; line: number }[] = [];
  lines.forEach((line, index) => {
    const match = /font-size:\s*([0-9.]+)px/.exec(line);
    if (!match) return;
    let selector = line.trim();
    for (let back = index; back >= 0 && back > index - 40; back -= 1) {
      if (lines[back].includes("{")) {
        selector = lines[back].trim();
        break;
      }
    }
    found.push({ size: Number(match[1]), selector, line: index + 1 });
  });
  return found;
}

describe("Typography floor (issue #150)", () => {
  it("finds the stylesheets it is supposed to be reading", () => {
    const paths = productStylesheets().map((sheet) => sheet.path);
    expect(paths).toContain("styles/components.css");
    expect(paths).toContain("features/today/todayDecisionSurface.css");
    expect(paths.length).toBeGreaterThan(10);
  });

  it("declares no product font size below the floor outside the block face", () => {
    const violations: string[] = [];
    for (const { path, css } of productStylesheets()) {
      for (const { size, selector, line } of pixelSizes(css)) {
        if (size >= FLOOR) continue;
        if (BLOCK_FACE_EXCEPTIONS.some((name) => selector.includes(name))) continue;
        violations.push(`${path}:${line} ${selector} → ${size}px`);
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  /**
   * A size expressed as a fraction of its parent inherits that parent's
   * responsive clamp, which is how a unit beside a secondary metric ended up
   * around 7px on a 320px phone with nothing in the source reading below 10.
   * Fractional `rem` is not that hazard, but it hides the rendered size just
   * as well, and STACK has one px scale to read sizes off.
   */
  it("sizes type in the shared px scale, not as a fraction of something else", () => {
    const violations: string[] = [];
    for (const { path, css } of productStylesheets()) {
      for (const match of css.matchAll(/font-size:\s*(0?\.[0-9]+)(em|rem)/g)) {
        violations.push(`${path}: ${match[0]}`);
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("names the two small-type roles as tokens", () => {
    const tokens = readFileSync(join(src, "styles/tokens.css"), "utf8");
    expect(tokens).toMatch(/--type-label:\s*12px/);
    expect(tokens).toMatch(/--type-meta:\s*11px/);
  });

  /**
   * Chart type is measured in viewBox units. A 320-unit chart is drawn about
   * 288px wide on a 320px phone, so a tick has to ask for more than 12 units
   * to reach the 12px `docs/DESIGN_SYSTEM.md` sets for a phone axis.
   */
  it("keeps chart axis type above the phone floor once the viewBox is scaled", () => {
    const css = readFileSync(join(src, "styles/components.css"), "utf8");
    const tick = /\.chart__tick\s*\{[^}]*font-size:\s*([0-9.]+)px/.exec(css);
    expect(tick, "no .chart__tick font-size").not.toBeNull();
    expect(Number(tick![1]) * 0.9).toBeGreaterThanOrEqual(12);
  });
});
