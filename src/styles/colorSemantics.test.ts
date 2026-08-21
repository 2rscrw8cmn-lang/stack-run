/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Stabilization 1.08 — one semantic role, one colour.
 *
 * STACK runs several legitimate colour systems at once: activity identity, HR
 * zones, runner/member ownership, Training Signal families, Crew award marks,
 * and danger. The failure this guards against is not "too many colours"; it is
 * the same role arriving in two different colours on two screens of the same
 * feature, which is exactly what happened to Crew Special Blocks — the ready
 * panel gave Best Zone 2 a cyan mark and the brick it becomes gave it red.
 *
 * `docs/DESIGN_SYSTEM.md` — "Colour semantics" — is the contract here.
 */
const src = join(dirname(fileURLToPath(import.meta.url)), "..");
const tokens = readFileSync(join(src, "styles/tokens.css"), "utf8");

function stylesheets(directory = ""): string[] {
  return readdirSync(join(src, directory), { withFileTypes: true }).flatMap((entry) => {
    const path = directory ? `${directory}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return stylesheets(path);
    return entry.name.endsWith(".css") ? [path] : [];
  });
}

const AWARDS = ["zone2", "pace", "runs", "longHaul", "steady", "onTarget", "levelUp"];

describe("Colour semantics (issue #150)", () => {
  it("gives every award identity one definition, in tokens", () => {
    for (const token of [
      "--award-miles",
      "--award-zone2",
      "--award-pace",
      "--award-runs",
      "--award-long-haul",
      "--award-steady",
      "--award-on-target",
      "--award-level-up",
    ]) {
      expect(tokens, `missing ${token}`).toMatch(new RegExp(`${token}:\\s*#[0-9a-f]{6}`));
    }
  });

  it("lets no surface assign an award a colour of its own", () => {
    const assignments: string[] = [];
    for (const path of stylesheets()) {
      const css = readFileSync(join(src, path), "utf8");
      for (const match of css.matchAll(/--award-mark:\s*([^;]+);/g)) {
        const value = match[1].trim();
        if (!value.startsWith("var(--award-")) assignments.push(`${path}: ${value}`);
      }
    }
    expect(assignments, assignments.join("\n")).toEqual([]);
  });

  it("resolves each award to the same mark wherever it appears", () => {
    const css = stylesheets()
      .map((path) => readFileSync(join(src, path), "utf8"))
      .join("\n");
    for (const award of AWARDS) {
      const values = new Set(
        [...css.matchAll(new RegExp(`\\[data-award="${award}"\\][^{]*\\{[^}]*--award-mark:\\s*([^;]+);`, "g"))]
          .map((match) => match[1].trim()),
      );
      expect(values.size, `${award} is defined ${values.size} ways: ${[...values].join(", ")}`)
        .toBe(1);
    }
  });

  /**
   * A signal wears the hue of the running it reads. Reading it through a
   * `--signal-*` token keeps that borrowing deliberate: `--easy` still means
   * "this run was an easy run" everywhere else, and a future change to a
   * signal's identity must not silently repaint every easy run in STACK.
   */
  it("reads Training Signal accents through the signal tokens", () => {
    const css = readFileSync(join(src, "styles/components.css"), "utf8");
    for (const match of css.matchAll(/\.signal-card\[data-signal="([a-z-]+)"\][^{]*\{[^}]*--signal-accent:\s*([^;]+);/g)) {
      expect(match[2].trim(), `${match[1]} does not use a --signal-* token`)
        .toBe(`var(--signal-${match[1]})`);
      expect(tokens).toMatch(new RegExp(`--signal-${match[1]}:`));
    }
  });

  /**
   * Every colour a component spends should be a role, not a value found once
   * and copied. Backgrounds and gradients are still allowed their own mixes;
   * this covers `color`, which is where a duplicated literal turns into two
   * surfaces quietly disagreeing about what a reading looks like.
   */
  it("keeps text colour on tokens rather than repeated literals", () => {
    const literals = new Map<string, string[]>();
    for (const path of stylesheets()) {
      if (path.startsWith("qa/")) continue;
      const css = readFileSync(join(src, path), "utf8");
      for (const match of css.matchAll(/[^-]color:\s*(#[0-9a-fA-F]{3,8})\s*(?:!important)?;/g)) {
        const value = match[1].toLowerCase();
        literals.set(value, [...(literals.get(value) ?? []), path]);
      }
    }
    const repeated = [...literals.entries()].filter(([, uses]) => uses.length > 1);
    expect(repeated.map(([value, uses]) => `${value} in ${uses.join(", ")}`)).toEqual([]);
  });
});
