import { describe, expect, it } from "vitest";
import { getSupabaseAvailability } from "./supabaseClient.js";

const productionEnv = {
  VITE_SUPABASE_URL: "https://fgnecruhlybarcmljggi.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fake",
  VITE_STACK_BACKEND_ENV: "production" as const,
};

const previewEnv = {
  VITE_SUPABASE_URL: "https://plpooikvofzytbpsbzki.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fake",
  VITE_STACK_BACKEND_ENV: "preview" as const,
};

describe("Supabase availability", () => {
  it("is gracefully unconfigured when public configuration is absent", () => {
    const result = getSupabaseAvailability(
      {
        VITE_SUPABASE_URL: "",
        VITE_SUPABASE_PUBLISHABLE_KEY: "",
        VITE_STACK_BACKEND_ENV: undefined,
      },
      "preview",
    );
    expect(result.configured).toBe(false);
    expect(result.client).toBeNull();
    expect(result.reason).toMatch(/Personal STACK still works/);
  });

  it("allows production only on the approved production project", () => {
    const result = getSupabaseAvailability(productionEnv, "production");
    expect(result.configured).toBe(true);
    expect(result.backend).toEqual({
      environment: "production",
      projectRef: "fgnecruhlybarcmljggi",
    });
  });

  it("allows preview only on the approved preview project", () => {
    const result = getSupabaseAvailability(previewEnv, "preview");
    expect(result.configured).toBe(true);
    expect(result.backend).toEqual({
      environment: "preview",
      projectRef: "plpooikvofzytbpsbzki",
    });
  });

  it("blocks production Supabase on a Vercel preview even with valid production config", () => {
    const result = getSupabaseAvailability(productionEnv, "preview");
    expect(result.configured).toBe(false);
    expect(result.client).toBeNull();
    expect(result.reason).toMatch(/blocked the production backend on a preview deployment/i);
  });

  it("blocks preview Supabase on production", () => {
    const result = getSupabaseAvailability(previewEnv, "production");
    expect(result.configured).toBe(false);
    expect(result.reason).toMatch(/blocked a preview backend on a production deployment/i);
  });

  it("blocks a marker that lies about the Supabase project", () => {
    const result = getSupabaseAvailability(
      {
        ...productionEnv,
        VITE_STACK_BACKEND_ENV: "preview",
      },
      "preview",
    );
    expect(result.configured).toBe(false);
    expect(result.reason).toMatch(/did not match the approved preview project/i);
  });

  it("blocks production Supabase during local development", () => {
    const result = getSupabaseAvailability(productionEnv, "development");
    expect(result.configured).toBe(false);
    expect(result.reason).toMatch(/blocks the production backend during local development/i);
  });

  it("allows local development against the preview backend", () => {
    const result = getSupabaseAvailability(previewEnv, "development");
    expect(result.configured).toBe(true);
  });
});
