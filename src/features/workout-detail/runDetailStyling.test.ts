/// <reference types="node" />
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const directory = dirname(fileURLToPath(import.meta.url));
const styles = join(directory, "..", "..", "styles");
const componentsCss = readFileSync(join(styles, "components.css"), "utf8");
const tokensCss = readFileSync(join(styles, "tokens.css"), "utf8");

/**
 * The structural rules Run Detail's presentation depends on.
 *
 * There is no visual-regression harness in this repository, so the stylesheet
 * itself is what these read. Every rule below is one a redesign could plausibly
 * lose by accident and which a runner would feel immediately: a touch target
 * that stopped being a touch target, a metric that stopped having an identity,
 * or a chart that stopped letting the page scroll past it.
 */
describe("Run Detail layout", () => {
  it("keeps the analysis tabs at the 44px interaction floor", () => {
    expect(componentsCss).toMatch(/\.run-profile__selector\s*\{[^}]*min-height: 44px/s);
    // The visible chip stays small; the target around it does not.
    expect(componentsCss).toMatch(
      /\.run-profile__selector > span\s*\{[^}]*font-size: var\(--type-label\)/s,
    );
  });

  it("gives the selected analysis tab an accent state that is not colour alone", () => {
    // An underline, and a step up in contrast from the quiet unselected tabs:
    // the selected metric stays obvious in greyscale and to anyone who does not
    // separate the four metric hues.
    expect(componentsCss).toMatch(
      /\.run-profile__selector\[aria-pressed="true"\] > span\s*\{[^}]*border-bottom-color: var\(--metric-color, var\(--accent\)\)/s,
    );
    expect(componentsCss).toMatch(
      /\.run-profile__selector > span\s*\{[^}]*color: var\(--text-subtle\)/s,
    );
    expect(componentsCss).toMatch(
      /\.run-profile__selector > span svg\s*\{[^}]*color: var\(--metric-color/s,
    );
  });

  it("gets the result's hierarchy from type rather than from a card", () => {
    // Hairline rules and thin dividers, no panel: the three most important
    // numbers on the screen must not read as a widget on a dashboard.
    expect(componentsCss).toMatch(/\.run-hero\s*\{(?![^}]*background)[^}]*border-bottom: 1px solid var\(--border\)/s);
    expect(componentsCss).toMatch(/\.run-hero > div \+ div\s*\{[^}]*border-left: 1px solid var\(--border\)/s);
  });

  it("draws the supporting facts as one strip rather than four cards", () => {
    // One container, internal dividers. Four bordered cells is the pattern the
    // approved reference does not use.
    expect(componentsCss).toMatch(
      /\.run-metrics\s*\{[^}]*border: 1px solid var\(--border\)[^}]*border-radius: var\(--radius-sm\)/s,
    );
    expect(componentsCss).toMatch(/\.run-metrics > div \+ div\s*\{\s*border-left: 1px solid var\(--border\)/s);
  });

  it("locks the analysis tabs, facts, plot and footer into one module", () => {
    // One border around the instrument …
    expect(componentsCss).toMatch(/\.run-analysis\s*\{[^}]*border: 1px solid var\(--border\)/s);
    // … and none around the chart inside it.
    expect(componentsCss).toMatch(/\.activity-chart\s*\{(?![^}]*border:)[^}]*padding/s);
  });

  it("does not restore persistent metric cards beneath Analysis", () => {
    expect(componentsCss).not.toMatch(/\.run-summaries\s*\{/);
    expect(componentsCss).not.toMatch(/\.run-summary\s*\{/);
    expect(componentsCss).not.toMatch(/\.sparkline\s*\{/);
  });

  it("fits the result to the facts the source actually stated", () => {
    // A historical run whose source gave no duration must not leave two empty
    // columns beside its distance.
    expect(componentsCss).toMatch(
      /\.run-hero\[data-count="1"\]\s*\{\s*grid-template-columns: minmax\(0, 1fr\)/s,
    );
    expect(componentsCss).toMatch(
      /\.run-hero\[data-count="2"\]\s*\{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/s,
    );
    // Distance is the dominant figure and the one thing wearing the brand
    // accent; pace shrinks because it is pace, not because it is last.
    expect(componentsCss).toMatch(
      /\.run-hero > div\[data-metric="distance"\] dd\s*\{[^}]*color: var\(--accent\)/s,
    );
    expect(componentsCss).toMatch(
      /\.run-hero > div\[data-metric="pace"\] dd\s*\{[^}]*font-size: clamp\(21px/s,
    );
  });

  it("keeps Run Detail's chrome to its controls, with the identity in the body", () => {
    // No heading bar for the content to scroll under.
    expect(componentsCss).toMatch(
      /\.sheet--run-detail \.sheet__header--chrome\s*\{[^}]*border-bottom: 0/s,
    );
    // The identity that replaces it is the largest type after the result.
    expect(componentsCss).toMatch(/\.run-identity__title\s*\{[^}]*font-size: clamp\(21px/s);
  });

  it("defines one colour per metric, in tokens, and reads it through a single custom property", () => {
    for (const token of [
      "--metric-pace",
      "--metric-heart-rate",
      "--metric-elevation",
      "--metric-cadence",
      "--metric-load",
    ]) {
      expect(tokensCss, `missing ${token}`).toMatch(new RegExp(`${token}:`));
    }
    for (const [attribute, token] of [
      ["heart-rate", "--metric-heart-rate"],
      ["elevation", "--metric-elevation"],
      ["cadence", "--metric-cadence"],
      ["load", "--metric-load"],
    ]) {
      expect(componentsCss).toMatch(
        new RegExp(`\\[data-metric="${attribute}"\\][^{]*\\{[^}]*--metric-color: var\\(${token}\\)`, "s"),
      );
    }
  });

  it("lets a vertical drag scroll the sheet while a horizontal one scrubs the chart", () => {
    expect(componentsCss).toMatch(/\.activity-chart__scrub\s*\{[^}]*touch-action: pan-y/s);
    // Covering the plot itself, so every position across it is a position
    // through the run and the whole plot is scrubbable rather than the line.
    expect(componentsCss).toMatch(/\.activity-chart__scrub\s*\{[^}]*left: var\(--plot-left/s);
  });

  it("keeps the metric strip and the analysis tabs whole rather than stranding one cell", () => {
    // Four compact facts across a phone, dropping to an even 2x2 rather than
    // three-and-one when there is no longer room.
    expect(componentsCss).toMatch(
      /@media \(max-width: 359px\)\s*\{\s*\.run-metrics\s*\{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/s,
    );
    // All four metrics stay visible at once, as one tab bar rather than a
    // block of pills that cannot fit across a phone.
    expect(componentsCss).toMatch(
      /\.run-analysis__tabs\s*\{[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/s,
    );
  });
});
