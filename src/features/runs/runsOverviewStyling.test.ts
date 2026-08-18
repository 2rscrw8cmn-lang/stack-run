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
    expect(overviewCss).toMatch(
      /\.runner-snapshot__readings\s*\{[^}]*border:\s*0[^}]*background:\s*transparent/s,
    );
  });

  it("uses one full-width signal summary per phone row without an essential carousel", () => {
    expect(signalCss).toMatch(/\.signal-cards \.signal-card\s*\{[^}]*display: grid/s);
    expect(signalCss).toMatch(
      /\.all-signals \.signal-cards__list\[data-density="compact"\] \.signal-card\s*\{[^}]*display: grid/s,
    );
    expect(signalCss).toMatch(/\.signal-visual__row\s*\{[^}]*minmax\(0, 1fr\)/s);
    expect(signalCss).not.toMatch(/\.signal-cards__list[^}]*overflow-x:\s*(auto|scroll)/s);
  });

  it("keeps both overview disclosures at the 44px interaction floor", () => {
    expect(overviewCss).toMatch(/runs-screen__more > \.button\s*\{[^}]*min-height: 44px/s);
    expect(signalCss).toMatch(/signal-cards__all \.button\s*\{[^}]*min-height: 44px/s);
    expect(signalCss).toMatch(/signal-methodology summary\s*\{[^}]*min-height: 44px/s);
  });

  it("lets the weekly data and current selection lead the chart chrome", () => {
    expect(overviewCss).toMatch(
      /\.runner-volume-section \.plan-actual-chart\s*\{[^}]*border:\s*0[^}]*background:\s*transparent/s,
    );
    expect(overviewCss).toMatch(
      /\.runner-volume-section \.chart__grid-line\s*\{[^}]*opacity:\s*0\.2/s,
    );
    expect(overviewCss).toMatch(
      /\.runner-volume-section \.plan-actual-chart__actual--selected\s*\{[^}]*fill:\s*var\(--accent\)[^}]*opacity:\s*1/s,
    );
  });

  it("uses normal STACK typography for section and sheet titles", () => {
    expect(overviewCss).toMatch(
      /\.runs-screen \.signal-cards \.section__title[^}]*font-family:\s*inherit/s,
    );
    expect(signalCss).toMatch(
      /\.sheet\.sheet--instrument \.sheet__title\s*\{[^}]*font-family:\s*inherit/s,
    );
    expect(signalCss).toMatch(
      /\.sheet--instrument \.signal-detail__section h3\s*\{[^}]*font-family:\s*inherit/s,
    );
  });
});
