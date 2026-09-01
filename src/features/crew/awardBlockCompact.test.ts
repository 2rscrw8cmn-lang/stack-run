/// <reference types="node" />
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("compact tower award artwork", () => {
  const css = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "awardBlockCompact.css"),
    "utf8",
  );

  it("shrinks the existing glyph only inside real tower blocks", () => {
    expect(css).toMatch(/\.placed-block \.award-brick__glyph\s*\{[^}]*width:\s*13px;[^}]*height:\s*13px;/s);
    expect(css).toMatch(/\.placed-block \.award-brick\s*\{[^}]*--award-frame:\s*3px;/s);
  });
});
