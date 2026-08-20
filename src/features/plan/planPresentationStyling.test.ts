/// <reference types="node" />
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * NEXT-5 Plan styling.
 *
 * There is no visual-regression harness in this repository, so these assert the
 * stylesheet source directly, for the properties of this screen that are
 * product decisions rather than taste: Plan states intent beside actual history
 * without grading either one, and it leaves behind no rule from the completion
 * hero it replaced.
 */
const here = dirname(fileURLToPath(import.meta.url));
/** Comments explain the decisions; the rules are what ships. */
function rules(path: string[]): string {
  return readFileSync(join(here, ...path), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
}

const css = rules(["planNext.css"]);
const components = rules(["..", "..", "styles", "components.css"]);

/** The body of the rule for `selector` that declares `property`. */
function declaration(
  source: string,
  selector: string,
  property: string,
): string {
  for (const match of source.matchAll(
    new RegExp(`${selector.replace(/[.[\]"$^*+?()|\\]/g, "\\$&")}[^{}]*\\{([^}]*)\\}`, "g"),
  )) {
    if (match[1].includes(property)) return match[1];
  }
  throw new Error(`no rule for ${selector} declares ${property}`);
}

describe("Plan week presentation", () => {
  it("never scores the week", () => {
    // No progress bar, no percentage, no pass/fail colour pair: the week lead
    // reports planned, actual and linked, and ranks none of them.
    expect(css).not.toMatch(/progress|percent|--success|--danger|--error/i);

    expect(components).not.toContain(".week-lead__progress");
    expect(components).not.toContain(".week-lead__count");
  });

  it("gives a week with no actual story a single reading, not an empty cell", () => {
    expect(
      declaration(
        css,
        '.week-lead__summary[data-readings="1"]',
        "grid-template-columns",
      ),
    ).toContain("grid-template-columns: minmax(0, 1fr)");
  });

  it("keeps supporting labels above phone microtype", () => {
    for (const selector of [
      ".week-lead__reading-meta",
      ".week-lead__linked",
      ".plan-lifecycle__headline",
    ]) {
      const size = /font-size: (\d+)px/.exec(
        declaration(css, selector, "font-size"),
      )?.[1];
      expect(Number(size), `${selector} font-size`).toBeGreaterThanOrEqual(11);
    }
  });

  it("keeps the next-race action at a full touch target", () => {
    expect(declaration(css, ".plan-lifecycle__action", "min-height")).toContain(
      "min-height: 44px",
    );
  });
});

describe("Plan day relationship styling", () => {
  it("draws an unlinked past day no differently from any other quiet day", () => {
    // `No linked run` is the absence of a link, not a verdict on the runner, so
    // it carries no warning colour of its own.
    expect(components).not.toContain('.workout-row__status[data-status="missed"]');
    expect(declaration(components, ".workout-row__status", "width")).toContain(
      "color: var(--text-subtle)",
    );
  });

  it("says the relationship in interface sans rather than machine type", () => {
    const label = declaration(components, ".workout-row__status-label", "font-size");
    expect(label).not.toContain("text-transform: uppercase");
    expect(label).not.toContain("var(--font-data)");
    // Dates stay machine type: they are data.
    expect(components).toContain(".workout-row__weekday,");
  });
});
