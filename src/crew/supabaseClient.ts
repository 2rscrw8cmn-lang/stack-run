import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type SupabaseAvailability =
  | { configured: false; reason: string; client: null }
  | { configured: true; reason: null; client: SupabaseClient };

let cached: SupabaseAvailability | null = null;

/**
 * Race Crew is optional infrastructure. Missing public configuration is a
 * supported product state, never a reason to keep personal STACK from booting.
 */
export function getSupabaseAvailability(
  env: Pick<ImportMetaEnv, "VITE_SUPABASE_URL" | "VITE_SUPABASE_PUBLISHABLE_KEY"> = import.meta.env,
): SupabaseAvailability {
  if (env === import.meta.env && cached) return cached;

  const url = env.VITE_SUPABASE_URL?.trim();
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  const availability: SupabaseAvailability =
    url && publishableKey
      ? {
          configured: true,
          reason: null,
          client: createClient(url, publishableKey, {
            auth: {
              persistSession: true,
              autoRefreshToken: true,
              detectSessionInUrl: false,
            },
          }),
        }
      : {
          configured: false,
          reason:
            "Race Crew is not configured on this build. Personal STACK still works normally.",
          client: null,
        };

  if (env === import.meta.env) cached = availability;
  return availability;
}

/** Test-only cache reset without exposing or mutating a client session. */
export function resetSupabaseAvailabilityForTests(): void {
  cached = null;
}
