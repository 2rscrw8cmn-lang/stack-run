/// <reference types="node" />
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const directory = dirname(fileURLToPath(import.meta.url));
const overviewCss = readFileSync(join(directory, "runsOverview.css"), "utf8");
const signalCss = readFileSync(
  join(directory, "..", "signals", "signalPresentationCleanup.css"),
  "utf8",
);

describe("Runs Overview responsive structure", () => {
  it("keeps the 320px surface clipped to the viewport with a compact hierarchical snapshot", () => {
    expect(overviewCss).toMatch(/\.runs-screen\s*\{[^}]*overflow-x: hidden/s);
    expect(overviewCss).toMatch(
      /runner-snapshot__grid\s*\{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/s,
    );
    expect(overviewCss).toMatch(/@media \(max-width: 340px\)/);
    expect(overviewCss).toMatch(/data-lead="true"[^}]*grid-column: 1 \/ -1/s);
  });

  it("uses one full-width signal summary per phone row without an essential carousel", () => {
    expect(signalCss).toMatch(/\.signal-cards \.signal-card\s*\{[^}]*display: grid/s);
    expect(signalCss).toMatch(/\.signal-visual__row\s*\{[^}]*minmax\(0, 1fr\)/s);
    expect(signalCss).not.toMatch(/\.signal-cards__list[^}]*overflow-x:\s*(auto|scroll)/s);
  });

  it("keeps both overview disclosures at the 44px interaction floor", () => {
    expect(overviewCss).toMatch(/runs-screen__more > \.button\s*\{[^}]*min-height: 44px/s);
    expect(signalCss).toMatch(/signal-cards__all \.button\s*\{[^}]*min-height: 44px/s);
  });
});
