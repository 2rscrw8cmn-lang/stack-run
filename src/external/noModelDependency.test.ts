/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * #183 (Evolution 2.10F): "No STACK-funded model inference or model key is
 * used" is asserted throughout `docs/EXTERNAL_TRAINING_CONTEXT.md` and
 * `docs/EXTERNAL_INTEGRATION.md` as a design fact, not a runtime check —
 * this is the standing guard that keeps it a fact. STACK reasons about
 * nothing; an external assistant the runner chooses does, through the plain
 * REST surface under `api/`. If that boundary is ever crossed, this test —
 * not a doc a reader has to trust — is what fails the build.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const FORBIDDEN_PACKAGES = [
  "openai",
  "@anthropic-ai",
  "anthropic",
  "@google/generative-ai",
  "@google-ai/generativelanguage",
  "cohere-ai",
  "@azure/openai",
  "replicate",
  "@huggingface/inference",
  "@mistralai/mistralai",
  "langchain",
  "@ai-sdk",
];

const FORBIDDEN_ENV_VARS = [
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "CLAUDE_API_KEY",
  "GOOGLE_API_KEY",
  "GEMINI_API_KEY",
  "COHERE_API_KEY",
  "AZURE_OPENAI_API_KEY",
  "MISTRAL_API_KEY",
  "REPLICATE_API_TOKEN",
  "HUGGINGFACE_API_KEY",
];

function apiSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return apiSourceFiles(path);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

describe("No STACK-funded model dependency (#183)", () => {
  it("declares no AI/model-provider SDK as a project dependency", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const declared = [
      ...Object.keys(packageJson.dependencies ?? {}),
      ...Object.keys(packageJson.devDependencies ?? {}),
    ];
    const found = declared.filter((name) =>
      FORBIDDEN_PACKAGES.some((forbidden) => name === forbidden || name.startsWith(`${forbidden}/`)),
    );
    expect(found, `found forbidden model-provider dependencies: ${found.join(", ")}`).toEqual([]);
  });

  it("references no model-provider API key in any api/ route", () => {
    const files = apiSourceFiles(join(root, "api"));
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const envVar of FORBIDDEN_ENV_VARS) {
        if (source.includes(envVar)) offenders.push(`${file}: ${envVar}`);
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("imports no forbidden model-provider SDK anywhere under api/", () => {
    const files = apiSourceFiles(join(root, "api"));
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/from\s+["']([^"']+)["']/g)) {
        const specifier = match[1]!;
        if (FORBIDDEN_PACKAGES.some((forbidden) => specifier === forbidden || specifier.startsWith(`${forbidden}/`))) {
          offenders.push(`${file}: imports "${specifier}"`);
        }
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
