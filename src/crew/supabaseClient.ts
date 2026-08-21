import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const PRODUCTION_SUPABASE_REF = "fgnecruhlybarcmljggi";
const PREVIEW_SUPABASE_REF = "plpooikvofzytbpsbzki";

export type SupabaseBackendIdentity = {
  environment: StackBackendEnv;
  projectRef: string;
};

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

function projectRefFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".supabase.co")) {
      return null;
    }
    return parsed.hostname.slice(0, -".supabase.co".length) || null;
  } catch {
    return null;
  }
}

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
  deploymentEnv: StackDeploymentEnv = __STACK_DEPLOYMENT_ENV__,
): SupabaseAvailability {
  if (env === import.meta.env && cached) return cached;

  const url = env.VITE_SUPABASE_URL?.trim();
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  const backendEnv = env.VITE_STACK_BACKEND_ENV?.trim() as StackBackendEnv | undefined;

  let availability: SupabaseAvailability;
  if (!url || !publishableKey || !backendEnv) {
    availability = blocked("Cloud STACK is not configured on this build.");
  } else if (backendEnv !== "production" && backendEnv !== "preview") {
    availability = blocked("Cloud STACK has an invalid backend environment marker.");
  } else {
    const projectRef = projectRefFromUrl(url);
    const expectedRef =
      backendEnv === "production" ? PRODUCTION_SUPABASE_REF : PREVIEW_SUPABASE_REF;

    if (!projectRef) {
      availability = blocked("Cloud STACK has an invalid Supabase project URL.");
    } else if (projectRef !== expectedRef) {
      availability = blocked(
        `Cloud STACK blocked a ${backendEnv} backend whose Supabase project did not match the approved ${backendEnv} project.`,
      );
    } else if (deploymentEnv === "production" && backendEnv !== "production") {
      availability = blocked("Cloud STACK blocked a preview backend on a production deployment.");
    } else if (deploymentEnv === "preview" && backendEnv !== "preview") {
      availability = blocked("Cloud STACK blocked the production backend on a preview deployment.");
    } else if (deploymentEnv === "development" && backendEnv === "production") {
      availability = blocked("Cloud STACK blocks the production backend during local development.");
    } else {
      availability = {
        configured: true,
        reason: null,
        backend: { environment: backendEnv, projectRef },
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
