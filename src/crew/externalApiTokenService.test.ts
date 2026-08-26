import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  createExternalApiToken,
  listExternalApiTokens,
  revokeExternalApiToken,
} from "./externalApiTokenService.js";

describe("listExternalApiTokens", () => {
  it("selects and projects the scope column alongside the existing fields", async () => {
    const order = vi.fn(async () => ({
      data: [{
        id: "token-1",
        label: "ChatGPT",
        scope: "read_write",
        created_at: "2026-08-01T00:00:00Z",
        last_used_at: null,
        revoked_at: null,
      }],
      error: null,
    }));
    const select = vi.fn(() => ({ order }));
    const client = { from: vi.fn(() => ({ select })) } as unknown as SupabaseClient;

    const tokens = await listExternalApiTokens(client);

    expect(select).toHaveBeenCalledWith(expect.stringContaining("scope"));
    expect(tokens).toEqual([{
      id: "token-1",
      label: "ChatGPT",
      scope: "read_write",
      createdAt: "2026-08-01T00:00:00Z",
      lastUsedAt: null,
      revokedAt: null,
    }]);
  });

  it("rejects a row with an unrecognized scope rather than passing it through", async () => {
    const order = vi.fn(async () => ({
      data: [{ id: "t", label: "x", scope: "admin", created_at: "2026-08-01T00:00:00Z", last_used_at: null, revoked_at: null }],
      error: null,
    }));
    const client = { from: vi.fn(() => ({ select: vi.fn(() => ({ order })) })) } as unknown as SupabaseClient;
    await expect(listExternalApiTokens(client)).rejects.toThrow("malformed");
  });
});

describe("createExternalApiToken", () => {
  it("sends the chosen scope through to the RPC", async () => {
    const rpc = vi.fn(async () => ({
      data: [{ token_id: "token-1", token: "raw-token-value", created_at: "2026-08-01T00:00:00Z" }],
      error: null,
    }));
    const client = { rpc } as unknown as SupabaseClient;

    const created = await createExternalApiToken(client, "ChatGPT", "read");

    expect(rpc).toHaveBeenCalledWith("create_external_api_token", { p_label: "ChatGPT", p_scope: "read" });
    expect(created).toEqual({ id: "token-1", token: "raw-token-value", createdAt: "2026-08-01T00:00:00Z" });
  });

  it("surfaces the RPC error rather than swallowing it", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: "external_api_token_scope_invalid" } }));
    const client = { rpc } as unknown as SupabaseClient;
    await expect(createExternalApiToken(client, "ChatGPT", "read_write")).rejects.toThrow("external_api_token_scope_invalid");
  });
});

describe("revokeExternalApiToken", () => {
  it("calls the revoke RPC with the token id", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: null }));
    const client = { rpc } as unknown as SupabaseClient;
    await revokeExternalApiToken(client, "token-1");
    expect(rpc).toHaveBeenCalledWith("revoke_external_api_token", { p_token_id: "token-1" });
  });
});
