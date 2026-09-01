/// <reference types="node" />
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The mobile shell's architecture, not its current spelling.
 *
 * The version of this file it replaces asserted the implementation it was
 * written beside — `position: fixed` on the nav, one particular keyboard
 * threshold in `Sheet.tsx`, one particular z-index expression in
 * `CrewBuild.tsx`, one safe-area pseudo-element. All four passed while the
 * iPhone showed the nav floating in the middle of a Crew page and a read-only
 * sheet parked halfway up the screen, because each of them described a guess
 * rather than a property the screen has to have.
 *
 * So what is checked here is ownership and structure: which element scrolls,
 * what is inside it and what is outside it, and which of them pays which
 * safe-area inset. Those are the things any correct implementation has to get
 * right, and no correct implementation is free to change.
 *
 * Layout itself is not measurable here — jsdom computes no boxes and vitest
 * runs with `css: false`. It is checked in the browser, on the phone sizes in
 * the PR, and what makes that check meaningful is that the architecture below
 * removes the need to measure: there is nothing left to position by hand.
 */
const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(join(here, path), "utf8");

const layout = read("layout.css");
const components = read("components.css");
const tokens = read("tokens.css");
const appShell = read("../app/AppShell.tsx");
const sheetSource = read("../components/ui/Sheet.tsx");
const placementBar = read("../features/build/PlacementBar.tsx");

function ruleBody(source: string, selector: string): string {
  const start = source.indexOf(selector);
  expect(start, `selector not found: ${selector}`).toBeGreaterThanOrEqual(0);
  const open = source.indexOf("{", start);
  return source.slice(open + 1, source.indexOf("}", open));
}

/** The markup between an opening tag and the shell's closing of it. */
function elementRange(source: string, opener: string): string {
  const start = source.indexOf(opener);
  expect(start, `element not found: ${opener}`).toBeGreaterThanOrEqual(0);
  return source.slice(start);
}

describe("the app owns the visible viewport", () => {
  it("bounds the shell to the viewport instead of letting the document grow", () => {
    const shell = ruleBody(layout, ".app-shell {");
    expect(shell).toMatch(/height:\s*100dvh/);
    expect(shell).toMatch(/min-height:\s*0/);
    expect(shell).toMatch(/overflow:\s*hidden/);
    // A `min-height` shell is the document-scroll architecture this replaces:
    // it lets the page grow past the screen, which is what put the nav in the
    // middle of a long Crew page.
    expect(shell).not.toMatch(/min-height:\s*100dvh/);
  });

  it("has exactly one intended scrolling region", () => {
    const scroll = ruleBody(layout, ".app-shell__scroll {");
    expect(scroll).toMatch(/overflow-y:\s*auto/);
    expect(scroll).toMatch(/min-height:\s*0/);
    expect(scroll).toMatch(/flex:\s*1/);

    // One in the stylesheet, and one in the shell, marked for the screens that
    // have to move the page (`app/appViewport.ts`).
    expect(layout.match(/\.app-shell__scroll\s*\{/g)).toHaveLength(1);
    expect(appShell.match(/app-shell__scroll/g)).toHaveLength(1);
    expect(appShell).toMatch(/APP_SCROLL_ATTRIBUTE/);
  });

  it("keeps the primary nav outside that region, as an ordinary shell row", () => {
    const scrollRegion = elementRange(appShell, '<div className="app-shell__scroll"');
    const scrollEnd = scrollRegion.indexOf("</main>");
    expect(scrollEnd).toBeGreaterThan(0);
    const insideScroll = scrollRegion.slice(0, scrollEnd);
    const afterScroll = scrollRegion.slice(scrollEnd);

    // The page and its header scroll; the nav and the dock do not.
    expect(insideScroll).toContain("app-shell__header");
    expect(insideScroll).toContain("app-shell__main");
    expect(insideScroll).not.toContain("app-shell__nav");
    expect(afterScroll).toContain("app-shell__nav");
    expect(afterScroll).toContain("app-shell__dock");

    const nav = ruleBody(layout, ".app-shell__nav {");
    expect(nav).not.toMatch(/position:\s*(fixed|sticky|absolute)/);
    expect(nav).not.toMatch(/z-index/);
  });

  it("pays each safe-area inset exactly once", () => {
    // Top: the shell, so the scroll region's own box starts below the status
    // bar and clips there. Nothing is drawn over the page to hide content.
    expect(ruleBody(layout, ".app-shell {")).toMatch(
      /padding-top:\s*env\(safe-area-inset-top\)/,
    );
    expect(layout).not.toMatch(/\.app-shell::before/);

    // Bottom: the nav, and only the nav — it is the last row of the shell.
    expect(ruleBody(layout, ".app-shell__nav {")).toMatch(
      /padding-bottom:\s*env\(safe-area-inset-bottom\)/,
    );
    for (const selector of [".app-shell__main {", ".app-shell__dock {"]) {
      expect(ruleBody(layout, selector)).not.toMatch(/safe-area-inset-bottom/);
    }
  });

  it("holds no clearance open for chrome that no longer floats over the page", () => {
    // Both tokens existed only to reserve room under a page for bars drawn on
    // top of it. Nothing is drawn on top of the page any more, so reserving
    // the room would simply be a second gap above the nav.
    for (const gone of ["--bottom-nav-clearance", "--placement-bar-reserve"]) {
      expect(components.includes(`var(${gone})`), `${gone} still used`).toBe(false);
      expect(layout.includes(`var(${gone})`), `${gone} still used`).toBe(false);
      expect(tokens.includes(`${gone}:`), `${gone} still declared`).toBe(false);
    }
  });
});

describe("the placement controls are shell chrome, not an overlay", () => {
  it("docks them in the shell row above the nav", () => {
    expect(placementBar).toMatch(/createPortal/);
    expect(placementBar).toMatch(/AppDockContext/);

    const dockIndex = appShell.indexOf("app-shell__dock");
    const navIndex = appShell.indexOf("app-shell__nav");
    expect(dockIndex).toBeGreaterThan(0);
    expect(dockIndex).toBeLessThan(navIndex);
  });

  it("gives them no position, offset or stacking order of their own", () => {
    const bar = ruleBody(components, "\n.placement-bar {");
    expect(bar).not.toMatch(/position:\s*(fixed|sticky|absolute)/);
    expect(bar).not.toMatch(/z-index/);
    expect(bar).not.toMatch(/bottom:/);
    expect(bar).not.toMatch(/safe-area-inset-bottom/);
  });
});

describe("a mobile sheet is a bottom sheet", () => {
  it("is the visible viewport with its panel against the bottom edge", () => {
    const sheet = ruleBody(components, "\n.sheet {");
    expect(sheet).toMatch(/position:\s*fixed/);
    expect(sheet).toMatch(/inset:\s*0/);
    expect(sheet).toMatch(/justify-content:\s*flex-end/);
    // The default height is the dynamic viewport, so the browser keeps the
    // panel on the bottom edge through a toolbar collapsing on its own.
    expect(sheet).toMatch(/height:\s*var\(--sheet-height,\s*100dvh\)/);
  });

  /**
   * The behaviour is covered properly in `Sheet.test.tsx`, which drives focus
   * and a fake visual viewport. This is the one thing a rendered test cannot
   * state: that no size comparison is the *reason* the override runs.
   */
  it("reads the keyboard from focus rather than from the size of the window", () => {
    expect(sheetSource).toMatch(/editingField/);
    expect(sheetSource).toMatch(/focusin/);
    expect(sheetSource).toMatch(/focusout/);
    expect(sheetSource).not.toMatch(/window\.innerHeight/);
    expect(sheetSource).not.toMatch(/viewport\.height\s*[<>]/);
  });
});
