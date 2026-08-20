/// <reference types="node" />
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const directory = dirname(fileURLToPath(import.meta.url));
const integrationCss = readFileSync(
  join(directory, "..", "..", "styles", "runsIntegration.css"),
  "utf8",
);

describe("R4 Runs integration styling", () => {
  it("brings Run Profile chart labels up to the accepted Runs readability floor", () => {
    expect(integrationCss).toMatch(
      /\.run-profile-chart__axis\s*\{[^}]*font-size: 12px/s,
    );
    expect(integrationCss).toMatch(
      /\.run-profile-chart__facts dt\s*\{[^}]*font-size: 10px/s,
    );
  });

  it("keeps keyboard focus on the visible profile chip instead of the 44px hit target", () => {
    expect(integrationCss).toMatch(
      /\.run-profile__selector:focus-visible\s*\{[^}]*outline: none/s,
    );
    expect(integrationCss).toMatch(
      /\.run-profile__selector:focus-visible > span\s*\{[^}]*outline: 2px solid var\(--accent\)[^}]*outline-offset: 2px/s,
    );
  });
});
