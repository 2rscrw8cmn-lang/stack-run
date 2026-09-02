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
  it("holds the result to one row of three, sized by its own figures", () => {
    /*
     * Two rules keep `6 mi | 1:05:00 | 10:50 /mi` on one line without clipping
     * and without setting every 5k as small as a half marathon:
     *
     * 1. the columns hug their content and the slack goes between them, because
     *    a proportional grid overruns one column while the next sits half
     *    empty;
     * 2. a run whose own figures are long — a duration past an hour, a distance
     *    into double figures — is set smaller, which `SourceRunDetail` marks
     *    with `data-density` from the formatted values themselves.
     */
    expect(componentsCss).toMatch(
      /\.run-hero\s*\{[^}]*grid-template-columns: max-content max-content max-content[^}]*justify-content: space-between/s,
    );
    expect(componentsCss).toMatch(
      /\.run-hero\s*\{[^}]*--hero-distance: clamp\(29px[^}]*--hero-pace: clamp\(23px/s,
    );
    expect(componentsCss).toMatch(
      /\.run-hero\[data-density="compact"\]\s*\{[^}]*--hero-distance: clamp\(23px[^}]*--hero-pace: clamp\(19px/s,
    );
    // Every figure reads its size through those properties, so the compact
    // setting cannot be defeated by a rule that hard-codes one of them.
    expect(componentsCss).toMatch(/\.run-hero dd\s*\{[^}]*font-size: var\(--hero-figure\)/s);
    expect(componentsCss).toMatch(
      /\.run-hero > div\[data-metric="distance"\] dd\s*\{[^}]*font-size: var\(--hero-distance\)/s,
    );
    expect(componentsCss).toMatch(
      /\.run-hero > div\[data-metric="pace"\] dd\s*\{[^}]*font-size: var\(--hero-pace\)/s,
    );
    // The unit shrinks with the figures rather than being dropped to make room.
    expect(componentsCss).toMatch(/\.run-hero__unit\s*\{[^}]*font-size: var\(--hero-unit\)/s);
  });

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
    expect(componentsCss).toMatch(/\.run-hero > div \+ div\s*\{[^}]*border-left: 1px solid/s);
  });

  it("has no secondary metric strip to style at all", () => {
    /*
     * The always-visible `AVG HR | GAIN | CADENCE | LOAD` row is gone, not
     * restyled. Heart rate, elevation and cadence each own an Analysis tab that
     * states the same figures with the run's shape behind them, and training
     * load — which has no stream and so no tab — moved into `…`. A strip above
     * Analysis made the top of a run read as a dashboard and printed every one
     * of those numbers twice.
     */
    expect(componentsCss).not.toMatch(/\.run-metrics\s*\{/);
    expect(componentsCss).not.toMatch(/\.run-metrics__icon/);
  });

  it("draws the run's mark as a type-coloured glyph rather than a badge", () => {
    // No ring: a circle around the runner made a glyph into a badge, and at
    // heading size the badge outweighed the title beside it.
    expect(componentsCss).toMatch(
      /\.run-identity__mark\s*\{(?![^}]*border-radius)[^}]*color: var\(--run-type-color\)/s,
    );
    // One colour per kind of running, resolved once so the mark and the word
    // for the type cannot drift apart.
    for (const type of ["easy", "intervals", "simulation", "long", "cross", "race"]) {
      expect(componentsCss, `missing type colour for ${type}`).toMatch(
        new RegExp(`\\.run-identity\\[data-type="${type}"\\] \\{ --run-type-color: var\\(--${type}\\); \\}`),
      );
    }
    expect(componentsCss).toMatch(
      /\.run-identity__status\[data-tone="type"\] \{ color: var\(--run-type-color\); \}/,
    );
  });

  it("puts the run's status beside its title instead of under it as a chip", () => {
    expect(componentsCss).toMatch(/\.run-identity__heading\s*\{[^}]*align-items: baseline/s);
    // Not a pill: no border of its own, and smaller than the title it follows.
    expect(componentsCss).toMatch(
      /\.run-identity__status\s*\{(?![^}]*border)[^}]*font-size: var\(--type-meta\)/s,
    );
    expect(componentsCss).not.toMatch(/\.run-identity__chip\b/);
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
    // accent — by a step, not by a display size that dwarfs the two beside it.
    expect(componentsCss).toMatch(
      /\.run-hero > div\[data-metric="distance"\] dd\s*\{[^}]*color: var\(--accent\)/s,
    );
  });

  it("keeps Run Detail's chrome to its controls, with the identity in the body", () => {
    // No heading bar for the content to scroll under.
    expect(componentsCss).toMatch(
      /\.sheet--run-detail \.sheet__header--chrome\s*\{[^}]*border-bottom: 0/s,
    );
    // The identity that replaces it is the largest type after the result.
    expect(componentsCss).toMatch(/\.run-identity__title\s*\{[^}]*font-size: clamp\(20px/s);
  });

  it("holds the sheet still while the runner changes metric", () => {
    /*
     * Heart Rate carries the zone rows and is around 240px taller than the
     * other three tabs. On a screen tall enough for the sheet to fit its
     * content that resized the whole panel on every tab change, moving the
     * chart out from under the runner's finger.
     *
     * The height is pinned only where there is an Analysis module to switch
     * between: a run whose source sent no stream is genuinely short, and a
     * near-full-screen sheet for it would be a wall of empty surface.
     */
    expect(componentsCss).toMatch(
      /@media \(max-width: 767px\)[\s\S]*?\.sheet--run-detail:has\(\.run-analysis\) \.sheet__panel \{\s*height: 90%;/,
    );
    expect(componentsCss).toMatch(
      /@media \(min-width: 768px\)[\s\S]*?\.sheet--run-detail:has\(\.run-analysis\) \.sheet__panel \{\s*height: min\(88vh, 860px\);/,
    );
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

  it("swaps the tab labels to their short form before two names can touch", () => {
    // At 320px `HEART RATE` and `ELEVATION` fill their columns exactly and read
    // as one long word. The narrow spelling is the chart callout's own — `HR`,
    // `Elev`, `Cad` — and the type never drops below the phone floor to fit.
    expect(componentsCss).toMatch(
      /\.run-profile__selector-label--short \{ display: none; \}/,
    );
    expect(componentsCss).toMatch(
      /@media \(max-width: 359px\)[^@]*\.run-profile__selector-label \{ display: none; \}/s,
    );
    expect(componentsCss).toMatch(
      /@media \(max-width: 359px\)[^@]*\.run-profile__selector-label--short \{ display: block; \}/s,
    );
    // Whichever form is drawn, it stays inside its own column.
    expect(componentsCss).toMatch(
      /\.run-profile__selector-label \{[^}]*text-overflow: ellipsis/s,
    );
  });

  it("keeps the analysis tabs whole rather than stranding one cell", () => {
    // All four metrics stay visible at once, as one tab bar rather than a
    // block of pills that cannot fit across a phone.
    expect(componentsCss).toMatch(
      /\.run-analysis__tabs\s*\{[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/s,
    );
  });
});
