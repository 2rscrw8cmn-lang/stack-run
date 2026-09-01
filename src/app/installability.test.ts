import { describe, expect, it } from "vitest";
// Vite hands these over as text, so this test needs no Node types — the app
// project deliberately does not have any.
import html from "../../index.html?raw";
import favicon from "../../public/favicon.svg?raw";
import manifestSource from "../../public/manifest.webmanifest?raw";
import runnerAsset from "../../public/stack-runner-mark.svg?raw";
import { STACK_RUNNER_PATHS } from "../components/shared/stackRunnerMark.js";

const manifest = JSON.parse(manifestSource);

/** Every icon shipped from `public/`, by the path the manifest would name. */
const icons = Object.fromEntries(
  Object.keys(
    import.meta.glob("../../public/*.{png,svg}", { eager: true, query: "?url" }),
  ).map((path) => [path.replace("../../public", ""), true]),
);

/**
 * The release surface: the things that decide whether STACK installs to a
 * phone and looks like itself when it does. No component test touches any of
 * it, and all of it is one character away from silently not working.
 */
describe("document metadata", () => {
  it("names itself, describes itself, and points at the manifest", () => {
    expect(html).toContain("<title>STACK — Build your race</title>");
    expect(html).toMatch(/<meta\s+name="description"/);
    expect(html).toContain('rel="manifest" href="/manifest.webmanifest"');
    expect(html).toContain('name="theme-color" content="#071018"');
  });

  it("reaches the edges of a notched phone and calls itself STACK there", () => {
    expect(html).toContain("viewport-fit=cover");
    expect(html).toContain('name="apple-mobile-web-app-title" content="STACK"');
    expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"');
    expect(html).toContain('rel="apple-touch-icon" href="/apple-touch-icon.png"');
  });
});

describe("web app manifest", () => {
  it("is installable: a name, a start, a display mode, and colours", () => {
    expect(manifest.name).toBe("STACK — Build your race");
    expect(manifest.short_name).toBe("STACK");
    expect(manifest.start_url).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.background_color).toBe("#071018");
    expect(manifest.theme_color).toBe("#071018");
  });

  it("carries a 192, a 512, and a maskable icon", () => {
    const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect(
      manifest.icons.some(
        (icon: { purpose: string }) => icon.purpose === "maskable",
      ),
    ).toBe(true);
  });

  it("references only icons that are actually shipped", () => {
    for (const icon of manifest.icons as { src: string }[]) {
      expect(icons).toHaveProperty([icon.src]);
    }
  });

  it("ships the icons the manifest does not cover", () => {
    // iOS never reads the manifest, and a browser tab wants a vector.
    expect(icons).toHaveProperty(["/apple-touch-icon.png"]);
    expect(icons).toHaveProperty(["/favicon.svg"]);
    expect(html).toContain('href="/favicon.svg"');
  });

  it("uses the runner-man artwork in both vector brand assets", () => {
    expect(runnerAsset.match(/<path /g)).toHaveLength(STACK_RUNNER_PATHS.length);
    expect(favicon.match(/<path /g)).toHaveLength(STACK_RUNNER_PATHS.length);
    expect(favicon.match(/<rect /g)).toHaveLength(1);
  });
});

describe("product-review tooling", () => {
  it("is gone from the source tree, not merely gated", () => {
    const source = import.meta.glob("../**/*.{ts,tsx}", {
      eager: true,
      query: "?raw",
      import: "default",
    }) as Record<string, string>;

    const offenders = Object.entries(source)
      .filter(([path]) => !path.endsWith("installability.test.ts"))
      .filter(([, text]) => text.includes("DevDataPanel"))
      .map(([path]) => path);

    expect(offenders).toEqual([]);
  });
});
