import { describe, expect, it } from "vitest";
// Vite hands the file over as text, so this needs no Node types.
import appSource from "../app/App.tsx?raw";

/**
 * D-025: the temporary data panel must never appear in a build anyone reviews
 * the product in. Vite substitutes `import.meta.env.DEV` with `false` in a
 * production build and drops the branch, so the gate is what keeps it out of
 * the bundle — this guards the gate itself, and the production bundle is
 * checked for the same absence during release verification.
 */
describe("DevDataPanel gating", () => {
  it("renders the panel only under import.meta.env.DEV", () => {
    const render = /\{import\.meta\.env\.DEV && \(\s*<DevDataPanel/;
    expect(appSource).toMatch(render);
  });

  it("has no other route to the panel", () => {
    const rendered = appSource.match(/<DevDataPanel/g) ?? [];
    expect(rendered).toHaveLength(1);
  });
});
