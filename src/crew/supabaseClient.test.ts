import { describe, expect, it } from "vitest";
import { getSupabaseAvailability } from "./supabaseClient";

describe("Supabase availability", () => {
  it("is gracefully unconfigured when either public value is absent", () => {
    const result = getSupabaseAvailability({
      VITE_SUPABASE_URL: "",
      VITE_SUPABASE_PUBLISHABLE_KEY: "",
    });
    expect(result.configured).toBe(false);
    expect(result.client).toBeNull();
    expect(result.reason).toMatch(/Personal STACK still works/);
  });

  it("creates a client from public configuration only", () => {
    const result = getSupabaseAvailability({
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fake",
    });
    expect(result.configured).toBe(true);
    expect(result.client).not.toBeNull();
  });
});
