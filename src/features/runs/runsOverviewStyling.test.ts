/// <reference types="node" />
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const directory = dirname(fileURLToPath(import.meta.url));
const overviewCss = readFileSync(join(directory, "runsOverview.css"), "utf8");
const explorerCss = readFileSync(join(directory, "historyExplorer.css"), "utf8");
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

  it("flattens run rows to spacing and a hairline instead of a card each", () => {
    expect(overviewCss).toMatch(
      /\.runs-screen \.run-row\s*\{[^}]*border:\s*0[^}]*border-bottom: 1px solid var\(--border\)/s,
    );
    expect(overviewCss).toMatch(/\.runs-screen \.run-row\s*\{[^}]*background: transparent/s);
    expect(overviewCss).toMatch(/\.runs-screen \.run-row\s*\{[^}]*border-radius:\s*0/s);
    // Where a run came from is metadata, not rank.
    expect(overviewCss).toMatch(
      /\.runs-screen \.run-row\[data-origin="historical-activity"\] \.run-row__type\s*\{[^}]*color: var\(--text\)/s,
    );
  });

  it("keeps run facts in machine type and run identity in sans", () => {
    expect(overviewCss).toMatch(
      /\.runs-screen \.run-row__distance\s*\{[^}]*font-family: var\(--font-data\)/s,
    );
    expect(overviewCss).toMatch(
      /\.runs-screen \.run-row__secondary\s*\{[^}]*font-family: var\(--font-data\)/s,
    );
    expect(overviewCss).not.toMatch(
      /\.runs-screen \.run-row__type\s*\{[^}]*font-family: var\(--font-data\)/s,
    );
  });

  /** `Show more` / `Show all` / `Show fewer` are utility actions, not machine labels. */
  it("returns the overview disclosures to the normal STACK voice", () => {
    for (const css of [overviewCss, signalCss, explorerCss]) {
      expect(css).toMatch(/\.button\s*\{[^}]*font-family: inherit[^}]*text-transform: none/s);
    }
  });

  it("makes History a destination row rather than a second utility label", () => {
    expect(overviewCss).toMatch(/\.runs-screen__history\s*\{[^}]*border:\s*0/s);
    expect(overviewCss).toMatch(/\.runs-screen__history-title\s*\{[^}]*font-size: 15px/s);
    expect(overviewCss).toMatch(/\.runs-screen__history-meta\s*\{/);
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

/**
 * The R2 polish contract: interface quiet, data STACK. These assert the parts
 * of the rule that live in CSS rather than in the DOM the component tests read.
 */
describe("History Explorer control treatment", () => {
  it("reduces metric and range controls to compact sans navigation", () => {
    expect(explorerCss).toMatch(
      /\.history-metrics button,\s*\.history-ranges button\s*\{[^}]*border:\s*0[^}]*background: none/s,
    );
    expect(explorerCss).toMatch(
      /\.history-metrics button,\s*\.history-ranges button\s*\{[^}]*font: inherit/s,
    );
    // The visible control may be smaller than its target; the target may not shrink.
    expect(explorerCss).toMatch(
      /\.history-metrics button,\s*\.history-ranges button\s*\{[^}]*min-height: 44px/s,
    );
    expect(explorerCss).toMatch(/\.history-explorer__back\s*\{[^}]*width: 44px[^}]*height: 44px/s);
  });

  it("spends lime only on the active choice", () => {
    expect(explorerCss).toMatch(
      /\.history-metrics button\[aria-selected="true"\]\s*\{\s*color: var\(--accent\)/s,
    );
    expect(explorerCss).toMatch(
      /\.history-ranges button\[aria-pressed="true"\]\s*\{\s*color: var\(--accent\)/s,
    );
    expect(explorerCss).not.toMatch(/\.history-metrics button\s*\{[^}]*border: 1px solid/s);
  });

  it("keeps the screen title in sans and the readout in machine type", () => {
    expect(explorerCss).not.toMatch(
      /\.history-explorer__header h1\s*\{[^}]*font-family: var\(--font-data\)/s,
    );
    expect(explorerCss).toMatch(
      /\.history-readout__value strong\s*\{[^}]*var\(--font-data\)/s,
    );
    expect(explorerCss).toMatch(/\.history-readout__period\s*\{[^}]*var\(--font-data\)/s);
  });

  it("holds the phone axis at the documented readability floor", () => {
    const axis = /\.history-chart__x span\s*\{[^}]*font: (\d+(?:\.\d+)?)px/s.exec(explorerCss);
    expect(axis).not.toBeNull();
    expect(Number.parseFloat(axis![1])).toBeGreaterThanOrEqual(12);
    // Ticks are positioned over their own bucket, so a label cannot be pushed
    // into its neighbour by a column grid.
    expect(explorerCss).toMatch(/\.history-chart__x span\s*\{[^}]*left: var\(--tick-x\)/s);
  });

  it("lets a vertical drag scroll the page even over the chart scrubber", () => {
    expect(explorerCss).toMatch(/\.history-chart__scrubber\s*\{[^}]*touch-action: pan-y/s);
  });

  it("has no permanent filter row left to style", () => {
    expect(explorerCss).not.toMatch(/history-selector--filter/);
  });
});
