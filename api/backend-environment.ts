import {
  checkSupabaseBoundary,
  deploymentEnvironmentFromVercel,
  type StackDeploymentEnvironment,
} from "../src/crew/supabaseEnvironment.js";

type Environment = {
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  STACK_BACKEND_ENV?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  VITE_STACK_BACKEND_ENV?: string;
  VERCEL_ENV?: string;
};

declare const process: { env: Environment };

type BackendStatus =
  | { status: "ready"; backendEnvironment: "production" | "preview"; projectRef: string }
  | { status: "blocked"; reason: string };

export type BackendEnvironmentReport = {
  deploymentEnvironment: StackDeploymentEnvironment;
  client: BackendStatus;
  serverInvite: BackendStatus;
};

function inspect(
  url: string | undefined,
  key: string | undefined,
  marker: string | undefined,
  deploymentEnvironment: StackDeploymentEnvironment,
): BackendStatus {
  if (!url?.trim() || !key?.trim() || !marker?.trim()) {
    return { status: "blocked", reason: "Supabase configuration is incomplete." };
  }
  const boundary = checkSupabaseBoundary(url.trim(), marker.trim(), deploymentEnvironment);
  return boundary.allowed
    ? {
        status: "ready",
        backendEnvironment: boundary.backend.environment,
        projectRef: boundary.backend.projectRef,
      }
    : { status: "blocked", reason: boundary.reason };
}

/** Public, non-secret proof of the backend boundary for deployment QA. */
export function inspectBackendEnvironment(
  environment: Environment = process.env,
): BackendEnvironmentReport {
  const deploymentEnvironment = deploymentEnvironmentFromVercel(environment.VERCEL_ENV);
  return {
    deploymentEnvironment,
    client: inspect(
      environment.VITE_SUPABASE_URL,
      environment.VITE_SUPABASE_PUBLISHABLE_KEY,
      environment.VITE_STACK_BACKEND_ENV,
      deploymentEnvironment,
    ),
    serverInvite: inspect(
      environment.SUPABASE_URL ?? environment.VITE_SUPABASE_URL,
      environment.SUPABASE_PUBLISHABLE_KEY ?? environment.VITE_SUPABASE_PUBLISHABLE_KEY,
      environment.STACK_BACKEND_ENV ?? environment.VITE_STACK_BACKEND_ENV,
      deploymentEnvironment,
    ),
  };
}

type NodeResponse = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
};

export default function handler(_request: unknown, response: NodeResponse): void {
  const report = inspectBackendEnvironment();
  const ready = report.client.status === "ready" && report.serverInvite.status === "ready";
  response.statusCode = ready ? 200 : 503;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(report));
}
