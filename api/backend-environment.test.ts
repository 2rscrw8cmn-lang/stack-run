import { describe, expect, it } from "vitest";
import { inspectBackendEnvironment } from "./backend-environment.js";

const preview = {
  VERCEL_ENV: "preview",
  VITE_STACK_BACKEND_ENV: "preview",
  VITE_SUPABASE_URL: "https://plpooikvofzytbpsbzki.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fake",
};

describe("backend environment report", () => {
  it("proves both Preview readers resolve only to stack-run-preview", () => {
    expect(inspectBackendEnvironment(preview)).toEqual({
      deploymentEnvironment: "preview",
      client: {
        status: "ready",
        backendEnvironment: "preview",
        projectRef: "plpooikvofzytbpsbzki",
      },
      serverInvite: {
        status: "ready",
        backendEnvironment: "preview",
        projectRef: "plpooikvofzytbpsbzki",
      },
    });
  });

  it("reports a production override as blocked without exposing its key", () => {
    const report = inspectBackendEnvironment({
      ...preview,
      STACK_BACKEND_ENV: "production",
      SUPABASE_URL: "https://fgnecruhlybarcmljggi.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "never-return-this",
    });
    expect(report.client.status).toBe("ready");
    expect(report.serverInvite).toMatchObject({ status: "blocked" });
    expect(JSON.stringify(report)).not.toContain("never-return-this");
  });

  it("fails closed when Preview inherits production client variables", () => {
    const report = inspectBackendEnvironment({
      VERCEL_ENV: "preview",
      VITE_STACK_BACKEND_ENV: "production",
      VITE_SUPABASE_URL: "https://fgnecruhlybarcmljggi.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fake",
    });
    expect(report.client).toMatchObject({ status: "blocked" });
    expect(report.serverInvite).toMatchObject({ status: "blocked" });
  });
});
