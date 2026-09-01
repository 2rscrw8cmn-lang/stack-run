/// <reference types="node" />
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const layout = readFileSync(join(here, "layout.css"), "utf8");
const sheet = readFileSync(join(here, "../components/ui/Sheet.tsx"), "utf8");
const crewBuild = readFileSync(join(here, "../features/crew/CrewBuild.tsx"), "utf8");

function ruleBody(source: string, selector: string): string {
  const start = source.indexOf(selector);
  expect(start, `selector not found: ${selector}`).toBeGreaterThanOrEqual(0);
  const open = source.indexOf("{", start);
  const close = source.indexOf("}", open);
  return source.slice(open + 1, close);
}

describe("mobile shell regressions", () => {
  it("pins primary navigation to the viewport bottom instead of document flow", () => {
    const nav = ruleBody(layout, ".app-shell__nav {");
    expect(nav).toMatch(/position:\s*fixed/);
    expect(nav).toMatch(/left:\s*0/);
    expect(nav).toMatch(/right:\s*0/);
    expect(nav).toMatch(/bottom:\s*0/);

    const main = ruleBody(layout, ".app-shell__main {");
    expect(main).toMatch(/--bottom-nav-clearance/);
    expect(main).toMatch(/safe-area-inset-bottom/);
  });

  it("keeps scrolled content out of the iOS status safe area", () => {
    const scrim = ruleBody(layout, ".app-shell::before {");
    expect(scrim).toMatch(/position:\s*fixed/);
    expect(scrim).toMatch(/height:\s*env\(safe-area-inset-top\)/);
    expect(scrim).toMatch(/background:\s*var\(--bg\)/);
  });

  it("uses visualViewport for sheets only when a keyboard-sized shrink is present", () => {
    expect(sheet).toContain("keyboardLikelyOpen");
    expect(sheet).toMatch(/missingHeight > 160/);
    expect(sheet).toMatch(/viewport\.height < layoutHeight \* 0\.75/);
    expect(sheet).toContain("clearVisualViewportOverride();");
    expect(sheet).toContain('dialog.style.setProperty("--sheet-height"');
    expect(sheet).toContain('dialog.style.setProperty("--sheet-top"');
  });

  it("breaks equal-height Crew block paint ties by horizontal position", () => {
    expect(crewBuild).toContain(
      "zIndex: block.depth * (GRID_UNITS + 1) + block.columnStart",
    );
  });
});
