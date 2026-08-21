export type StackBackendEnvironment = "production" | "preview";
export type StackDeploymentEnvironment = "production" | "preview" | "development";

export const PRODUCTION_SUPABASE_REF = "fgnecruhlybarcmljggi";
export const PREVIEW_SUPABASE_REF = "plpooikvofzytbpsbzki";

export type SupabaseBackendIdentity = {
  environment: StackBackendEnvironment;
  projectRef: string;
};

export type SupabaseBoundaryResult =
  | { allowed: true; backend: SupabaseBackendIdentity }
  | { allowed: false; reason: string };

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

/**
 * One environment boundary shared by browser and server-side Supabase readers.
 * The public marker is not trusted by itself: it must agree with both the
 * deployment type and the known project ref parsed from the URL.
 */
export function checkSupabaseBoundary(
  url: string,
  backendEnvironment: string,
  deploymentEnvironment: StackDeploymentEnvironment,
): SupabaseBoundaryResult {
  if (backendEnvironment !== "production" && backendEnvironment !== "preview") {
    return { allowed: false, reason: "Cloud STACK has an invalid backend environment marker." };
  }

  const projectRef = projectRefFromUrl(url);
  const expectedRef =
    backendEnvironment === "production" ? PRODUCTION_SUPABASE_REF : PREVIEW_SUPABASE_REF;

  if (!projectRef) {
    return { allowed: false, reason: "Cloud STACK has an invalid Supabase project URL." };
  }
  if (projectRef !== expectedRef) {
    return {
      allowed: false,
      reason: `Cloud STACK blocked a ${backendEnvironment} backend whose Supabase project did not match the approved ${backendEnvironment} project.`,
    };
  }
  if (deploymentEnvironment === "production" && backendEnvironment !== "production") {
    return {
      allowed: false,
      reason: "Cloud STACK blocked a preview backend on a production deployment.",
    };
  }
  if (deploymentEnvironment === "preview" && backendEnvironment !== "preview") {
    return {
      allowed: false,
      reason: "Cloud STACK blocked the production backend on a preview deployment.",
    };
  }
  if (deploymentEnvironment === "development" && backendEnvironment === "production") {
    return {
      allowed: false,
      reason: "Cloud STACK blocks the production backend during local development.",
    };
  }

  return {
    allowed: true,
    backend: { environment: backendEnvironment, projectRef },
  };
}

export function deploymentEnvironmentFromVercel(
  vercelEnvironment: string | undefined,
): StackDeploymentEnvironment {
  return vercelEnvironment === "production" || vercelEnvironment === "preview"
    ? vercelEnvironment
    : "development";
}
