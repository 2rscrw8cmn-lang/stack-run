/// <reference types="node" />
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const directory = dirname(fileURLToPath(import.meta.url));
const componentsCss = readFileSync(
  join(directory, "..", "..", "styles", "components.css"),
  "utf8",
);

/**
 * The two structural rules R3's shared source-detail surface depends on.
 *
 * Both exist because the surface now serves a run the source described richly
 * and a run it barely described at all, on the same phone.
 */
describe("shared source-detail layout", () => {
  it("keeps the Run Profile selectors at the 44px interaction floor", () => {
    expect(componentsCss).toMatch(/\.run-profile__selector\s*\{[^}]*min-height: 44px/s);
    // The visible chip stays small; the target around it does not.
    expect(componentsCss).toMatch(/\.run-profile__selector > span\s*\{[^}]*font-size: 9px/s);
    expect(componentsCss).toMatch(
      /\.run-profile__selector\[aria-pressed="true"\] > span\s*\{[^}]*border-color: var\(--accent\)/s,
    );
  });

  it("fits the primary result to the facts the source actually stated", () => {
    // A historical run whose source gave no duration must not leave two empty
    // columns beside its distance.
    expect(componentsCss).toMatch(
      /\.run-result-detail__primary\[data-count="1"\]\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\)/s,
    );
    expect(componentsCss).toMatch(
      /\.run-result-detail__primary\[data-count="2"\]\s*\{[^}]*repeat\(2, minmax\(0, 1fr\)\)/s,
    );
    // Pace shrinks because it is pace, not because it happens to be last.
    expect(componentsCss).toMatch(
      /\.run-result-detail__primary > div\[data-metric="pace"\] dd\s*\{[^}]*font-size: clamp\(17px/s,
    );
  });
});
