import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A runner's own personal token for #178's external training context — the
 * revocable credential that lets an authorized external assistant (Settings
 * → External Assistant Access) read this account's training data. The raw
 * token value is returned exactly once, at creation, by `createExternalApiToken`
 * below; nothing here can ever read it back afterward, by design — the
 * `external_api_tokens` table withholds its hash from every client read.
 */
export interface ExternalApiTokenSummary {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

type Row = Record<string, unknown>;

function rows(value: unknown): Row[] {
  return Array.isArray(value) ? (value.filter((item) => item && typeof item === "object") as Row[]) : [];
}

function requiredString(source: Row, key: string): string {
  const value = source[key];
  if (typeof value !== "string" || !value) throw new Error("External API token data is malformed.");
  return value;
}

function nullableString(source: Row, key: string): string | null {
  const value = source[key];
  return typeof value === "string" && value ? value : null;
}

export async function listExternalApiTokens(
  client: SupabaseClient,
): Promise<ExternalApiTokenSummary[]> {
  const result = await client
    .from("external_api_tokens")
    .select("id,label,created_at,last_used_at,revoked_at")
    .order("created_at", { ascending: false });
  if (result.error) throw new Error(result.error.message);
  return rows(result.data).map((row) => ({
    id: requiredString(row, "id"),
    label: requiredString(row, "label"),
    createdAt: requiredString(row, "created_at"),
    lastUsedAt: nullableString(row, "last_used_at"),
    revokedAt: nullableString(row, "revoked_at"),
  }));
}

/** The raw token is returned once here and never again — copy it now or lose it. */
export async function createExternalApiToken(
  client: SupabaseClient,
  label: string,
): Promise<{ id: string; token: string; createdAt: string }> {
  const result = await client.rpc("create_external_api_token", { p_label: label });
  if (result.error) throw new Error(result.error.message);
  const row = rows(result.data)[0];
  if (!row) throw new Error("External API token could not be created.");
  return {
    id: requiredString(row, "token_id"),
    token: requiredString(row, "token"),
    createdAt: requiredString(row, "created_at"),
  };
}

export async function revokeExternalApiToken(
  client: SupabaseClient,
  tokenId: string,
): Promise<void> {
  const result = await client.rpc("revoke_external_api_token", { p_token_id: tokenId });
  if (result.error) throw new Error(result.error.message);
}
