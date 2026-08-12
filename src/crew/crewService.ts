import type { SupabaseClient, User } from "@supabase/supabase-js";
import { formatLocalDate, parseLocalDate } from "../domain/dates";
import { createInviteToken, hashInviteToken, inviteUrl } from "./invites";
import type {
  CrewInvite,
  CrewInvitePreview,
  CrewMember,
  CrewProfile,
  CrewRole,
  LoadedCrewAccount,
  RaceCrew,
} from "./types";

type Row = Record<string, unknown>;

export interface CrewDetailsInput {
  name: string;
  raceName: string;
  raceDate: string;
  raceDistanceMiles: number;
  buildStartDate: string;
}

export function validateCrewDetails(
  input: CrewDetailsInput,
): CrewDetailsInput {
  const name = input.name.trim();
  const raceName = input.raceName.trim();
  if (!name) throw new Error("Enter a Crew name.");
  if (!raceName) throw new Error("Enter a race name.");

  try {
    if (formatLocalDate(parseLocalDate(input.raceDate)) !== input.raceDate) {
      throw new Error();
    }
  } catch {
    throw new Error("Enter a valid race date.");
  }

  try {
    if (formatLocalDate(parseLocalDate(input.buildStartDate)) !== input.buildStartDate) {
      throw new Error();
    }
  } catch {
    throw new Error("Enter a valid Build start date.");
  }

  if (input.buildStartDate > input.raceDate) {
    throw new Error("Build start cannot be after the race date.");
  }

  if (!Number.isFinite(input.raceDistanceMiles) || input.raceDistanceMiles <= 0) {
    throw new Error("Enter a valid race distance.");
  }

  return {
    name,
    raceName,
    raceDate: input.raceDate,
    raceDistanceMiles: input.raceDistanceMiles,
    buildStartDate: input.buildStartDate,
  };
}

function row(value: unknown): Row | null {
  return value && typeof value === "object" ? (value as Row) : null;
}

function rows(value: unknown): Row[] {
  return Array.isArray(value)
    ? value.map(row).filter((item): item is Row => item !== null)
    : [];
}

function requiredString(source: Row, key: string): string {
  const value = source[key];
  if (typeof value !== "string") throw new Error(`Race Crew returned invalid ${key}.`);
  return value;
}

function nullableString(source: Row, key: string): string | null {
  const value = source[key];
  return typeof value === "string" ? value : null;
}

function requiredNumber(source: Row, key: string): number {
  const value = source[key];
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Race Crew returned invalid ${key}.`);
  return parsed;
}

function profileFrom(source: Row): CrewProfile {
  return {
    id: requiredString(source, "id"),
    displayName: requiredString(source, "display_name"),
  };
}

function crewFrom(source: Row): RaceCrew {
  return {
    id: requiredString(source, "id"),
    ownerUserId: requiredString(source, "owner_user_id"),
    name: requiredString(source, "name"),
    raceName: requiredString(source, "race_name"),
    raceDate: requiredString(source, "race_date"),
    raceDistanceMiles: requiredNumber(source, "race_distance_miles"),
    buildStartDate: requiredString(source, "build_start_date"),
  };
}

function roleFrom(value: unknown): CrewRole {
  if (value === "owner" || value === "member") return value;
  throw new Error("Race Crew returned an invalid member role.");
}

export async function ensureProfile(
  client: SupabaseClient,
  user: User,
): Promise<CrewProfile> {
  const existing = await client
    .from("profiles")
    .select("id,display_name")
    .eq("id", user.id)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  const current = row(existing.data);
  if (current) return profileFrom(current);

  const fallback =
    typeof user.user_metadata.display_name === "string"
      ? user.user_metadata.display_name.trim()
      : "Runner";
  const created = await client
    .from("profiles")
    .upsert({ id: user.id, display_name: fallback || "Runner" })
    .select("id,display_name")
    .single();
  if (created.error) throw new Error(created.error.message);
  const createdRow = row(created.data);
  if (!createdRow) throw new Error("STACK profile could not be loaded.");
  return profileFrom(createdRow);
}

async function loadMembers(
  client: SupabaseClient,
  crewId: string,
): Promise<CrewMember[]> {
  const membership = await client
    .from("crew_members")
    .select("user_id,role,joined_at")
    .eq("crew_id", crewId)
    .order("joined_at");
  if (membership.error) throw new Error(membership.error.message);
  const memberRows = rows(membership.data);
  const userIds = memberRows.map((item) => requiredString(item, "user_id"));
  if (userIds.length === 0) return [];
  const profileResult = await client
    .from("profiles")
    .select("id,display_name")
    .in("id", userIds);
  if (profileResult.error) throw new Error(profileResult.error.message);
  const names = new Map(
    rows(profileResult.data).map((item) => {
      const profile = profileFrom(item);
      return [profile.id, profile.displayName] as const;
    }),
  );
  return memberRows.map((item) => {
    const userId = requiredString(item, "user_id");
    return {
      userId,
      role: roleFrom(item.role),
      joinedAt: requiredString(item, "joined_at"),
      displayName: names.get(userId) ?? "Runner",
    };
  });
}

async function loadInvites(
  client: SupabaseClient,
  crewId: string,
  role: CrewRole,
): Promise<CrewInvite[]> {
  if (role !== "owner") return [];
  const result = await client
    .from("crew_invites")
    .select("id,expires_at,revoked_at,redeemed_at")
    .eq("crew_id", crewId)
    .order("created_at", { ascending: false });
  if (result.error) throw new Error(result.error.message);
  return rows(result.data).map((item) => ({
    id: requiredString(item, "id"),
    expiresAt: requiredString(item, "expires_at"),
    revokedAt: nullableString(item, "revoked_at"),
    redeemedAt: nullableString(item, "redeemed_at"),
  }));
}

export async function loadCrewAccount(
  client: SupabaseClient,
  user: User,
): Promise<LoadedCrewAccount> {
  const profile = await ensureProfile(client, user);
  const membership = await client
    .from("crew_members")
    .select("crew_id,role")
    .eq("user_id", user.id)
    .order("joined_at")
    .limit(1)
    .maybeSingle();
  if (membership.error) throw new Error(membership.error.message);
  const membershipRow = row(membership.data);
  if (!membershipRow) {
    return { profile, crew: null, role: null, members: [], invites: [] };
  }
  const crewId = requiredString(membershipRow, "crew_id");
  const role = roleFrom(membershipRow.role);
  const crewResult = await client
    .from("crews")
    .select("id,owner_user_id,name,race_name,race_date,race_distance_miles,build_start_date")
    .eq("id", crewId)
    .single();
  if (crewResult.error) throw new Error(crewResult.error.message);
  const crewRow = row(crewResult.data);
  if (!crewRow) throw new Error("Race Crew could not be loaded.");
  return {
    profile,
    crew: crewFrom(crewRow),
    role,
    members: await loadMembers(client, crewId),
    invites: await loadInvites(client, crewId, role),
  };
}

export async function updateDisplayName(
  client: SupabaseClient,
  userId: string,
  displayName: string,
): Promise<void> {
  const name = displayName.trim();
  if (!name) throw new Error("Enter a display name.");
  const result = await client
    .from("profiles")
    .update({ display_name: name })
    .eq("id", userId);
  if (result.error) throw new Error(result.error.message);
}

export async function createCrew(
  client: SupabaseClient,
  input: CrewDetailsInput,
): Promise<void> {
  const details = validateCrewDetails(input);
  const result = await client.rpc("create_crew", {
    p_name: details.name,
    p_race_name: details.raceName,
    p_race_date: details.raceDate,
    p_race_distance_miles: details.raceDistanceMiles,
    p_build_start_date: details.buildStartDate,
  });
  if (result.error) throw new Error(result.error.message);
}

export async function updateCrew(
  client: SupabaseClient,
  crewId: string,
  input: CrewDetailsInput,
): Promise<void> {
  const details = validateCrewDetails(input);
  const result = await client.rpc("update_crew", {
    p_crew_id: crewId,
    p_name: details.name,
    p_race_name: details.raceName,
    p_race_date: details.raceDate,
    p_race_distance_miles: details.raceDistanceMiles,
    p_build_start_date: details.buildStartDate,
  });
  if (result.error) throw new Error(result.error.message);
}

export async function deleteCrew(
  client: SupabaseClient,
  crewId: string,
): Promise<void> {
  const result = await client
    .from("crews")
    .delete()
    .eq("id", crewId)
    .select("id")
    .maybeSingle();
  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("Crew could not be deleted. Refresh and try again.");
}

export async function createCrewInvite(
  client: SupabaseClient,
  crewId: string,
): Promise<{ url: string; expiresAt: string }> {
  const token = createInviteToken();
  const tokenHash = await hashInviteToken(token);
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60_000).toISOString();
  const result = await client.rpc("create_crew_invite", {
    p_crew_id: crewId,
    p_token_hash: tokenHash,
    p_expires_at: expiresAt,
  });
  if (result.error) throw new Error(result.error.message);
  return { url: inviteUrl(token), expiresAt };
}

export async function previewCrewInvite(
  client: SupabaseClient,
  token: string,
): Promise<CrewInvitePreview> {
  const result = await client.rpc("preview_crew_invite", {
    p_token_hash: await hashInviteToken(token),
  });
  if (result.error) throw new Error(result.error.message);
  const preview = rows(result.data)[0];
  if (!preview) throw new Error("That crew invite is invalid, expired, revoked or already used.");
  return {
    crewId: requiredString(preview, "crew_id"),
    crewName: requiredString(preview, "crew_name"),
    raceName: requiredString(preview, "race_name"),
    raceDate: requiredString(preview, "race_date"),
    raceDistanceMiles: requiredNumber(preview, "race_distance_miles"),
    expiresAt: requiredString(preview, "expires_at"),
  };
}

export async function redeemCrewInvite(
  client: SupabaseClient,
  token: string,
): Promise<void> {
  const result = await client.rpc("redeem_crew_invite", {
    p_token_hash: await hashInviteToken(token),
  });
  if (result.error) throw new Error(result.error.message);
}

export async function leaveCrew(
  client: SupabaseClient,
  crewId: string,
): Promise<void> {
  const result = await client.rpc("leave_crew", { p_crew_id: crewId });
  if (result.error) throw new Error(result.error.message);
}

export async function removeCrewMember(
  client: SupabaseClient,
  crewId: string,
  userId: string,
): Promise<void> {
  const result = await client.rpc("remove_crew_member", {
    p_crew_id: crewId,
    p_user_id: userId,
  });
  if (result.error) throw new Error(result.error.message);
}

export async function revokeCrewInvite(
  client: SupabaseClient,
  inviteId: string,
): Promise<void> {
  const result = await client.rpc("revoke_crew_invite", {
    p_invite_id: inviteId,
  });
  if (result.error) throw new Error(result.error.message);
}
