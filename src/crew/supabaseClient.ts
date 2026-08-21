import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  checkSupabaseBoundary,
  type SupabaseBackendIdentity,
} from "./supabaseEnvironment";

export type { SupabaseBackendIdentity } from "./supabaseEnvironment";

export type SupabaseAvailability =
  | { configured: false; reason: string; client: null; backend: null }
  | {
      configured: true;
      reason: null;
      client: SupabaseClient;
      backend: SupabaseBackendIdentity;
    };

type SupabaseEnv = Pick<
  ImportMetaEnv,
  "VITE_SUPABASE_URL" | "VITE_SUPABASE_PUBLISHABLE_KEY" | "VITE_STACK_BACKEND_ENV"
>;

let cached: SupabaseAvailability | null = null;

function blocked(reason: string): SupabaseAvailability {
  return {
    configured: false,
    reason: `${reason} Personal STACK still works normally.`,
    client: null,
    backend: null,
  };
}

/**
 * Cloud-backed STACK is optional infrastructure, but a configured deployment
 * must never cross the production/preview boundary. Vercel's deployment type
 * is compiled into the bundle by vite.config.ts and checked against both an
 * explicit backend marker and the known Supabase project ref.
 */
export function getSupabaseAvailability(
  env: SupabaseEnv = import.meta.env,
  deploymentEnv: StackDeploymentEnv =
    typeof __STACK_DEPLOYMENT_ENV__ === "undefined" ? "development" : __STACK_DEPLOYMENT_ENV__,
): SupabaseAvailability {
  if (env === import.meta.env && cached) return cached;

  const url = env.VITE_SUPABASE_URL?.trim();
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  const backendEnv = env.VITE_STACK_BACKEND_ENV?.trim();

  let availability: SupabaseAvailability;
  if (!url || !publishableKey || !backendEnv) {
    availability = blocked("Cloud STACK is not configured on this build.");
  } else {
    const boundary = checkSupabaseBoundary(url, backendEnv, deploymentEnv);
    if (!boundary.allowed) {
      availability = blocked(boundary.reason);
    } else {
      availability = {
        configured: true,
        reason: null,
        backend: boundary.backend,
        client: createClient(url, publishableKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
          },
        }),
      };
    }
  }

  if (env === import.meta.env) cached = availability;
  return availability;
}

/** Test-only cache reset without exposing or mutating a client session. */
export function resetSupabaseAvailabilityForTests(): void {
  cached = null;
}
