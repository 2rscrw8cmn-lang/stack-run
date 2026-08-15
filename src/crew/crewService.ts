import type { SupabaseClient, User } from "@supabase/supabase-js";
import { formatLocalDate, parseLocalDate } from "../domain/dates";
import {
  DEFAULT_CREW_EMBLEM,
  encodeCrewEmblem,
  resolveCrewEmblem,
  type CrewEmblem,
} from "./emblem";
import { hashInviteToken, inviteUrl } from "./invites";
import {
  accentColorFrom,
  crewMemberAccent,
  type CrewMemberAccent,
} from "./memberAccent";
import {
  encodeRunnerIcon,
  resolveRunnerIcon,
  runnerIconFromSeed,
  type RunnerIcon,
} from "./runnerIcon";
import type {
  CrewInvite,
  CrewInvitePreview,
  CrewMember,
  CrewMembershipSummary,
  CrewProfile,
  CrewRole,
  CrewType,
  LoadedCrewAccount,
  RaceCrew,
} from "./types";

type Row = Record<string, unknown>;

const CREW_COLUMNS =
  "id,owner_user_id,name,crew_type,race_name,race_date,race_distance_miles,build_start_date,emblem";

/** Everything Crew is allowed to know about a person, and nothing else. */
const PROFILE_COLUMNS = "id,display_name,accent_color,runner_icon";

export interface CrewDetailsInput {
  name: string;
  crewType: CrewType;
  /** Ignored (and stored as null) for a `club` Crew. */
  raceName: string | null;
  raceDate: string | null;
  raceDistanceMiles: number | null;
  buildStartDate: string;
  emblem: CrewEmblem;
}

function validDateOrThrow(value: string, message: string): string {
  try {
    if (formatLocalDate(parseLocalDate(value)) !== value) throw new Error();
  } catch {
    throw new Error(message);
  }
  return value;
}

export function validateCrewDetails(
  input: CrewDetailsInput,
): CrewDetailsInput {
  const name = input.name.trim();
  if (!name) throw new Error("Enter a Crew name.");

  const buildStartDate = validDateOrThrow(
    input.buildStartDate,
    "Enter a valid Build start date.",
  );

  if (input.crewType === "club") {
    return {
      name,
      crewType: "club",
      raceName: null,
      raceDate: null,
      raceDistanceMiles: null,
      buildStartDate,
      emblem: input.emblem ?? DEFAULT_CREW_EMBLEM,
    };
  }

  const raceName = input.raceName?.trim() ?? "";
  if (!raceName) throw new Error("Enter a race name.");
  if (input.raceDate === null) throw new Error("Enter a valid race date.");
  const raceDate = validDateOrThrow(input.raceDate, "Enter a valid race date.");

  if (buildStartDate > raceDate) {
    throw new Error("Build start cannot be after the race date.");
  }

  if (
    input.raceDistanceMiles === null ||
    !Number.isFinite(input.raceDistanceMiles) ||
    input.raceDistanceMiles <= 0
  ) {
    throw new Error("Enter a valid race distance.");
  }

  return {
    name,
    crewType: "race",
    raceName,
    raceDate,
    raceDistanceMiles: input.raceDistanceMiles,
    buildStartDate,
    emblem: input.emblem ?? DEFAULT_CREW_EMBLEM,
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

function nullableNumber(source: Row, key: string): number | null {
  const value = source[key];
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Race Crew returned invalid ${key}.`);
  return parsed;
}

function crewTypeFrom(value: unknown): CrewType {
  if (value === "race" || value === "club") return value;
  throw new Error("Race Crew returned an invalid crew type.");
}

function profileFrom(source: Row): CrewProfile {
  const id = requiredString(source, "id");
  return {
    id,
    displayName: requiredString(source, "display_name"),
    accentColor: accentColorFrom(source.accent_color),
    runnerIcon: resolveRunnerIcon(source.runner_icon, id),
  };
}

function crewFrom(source: Row): RaceCrew {
  const id = requiredString(source, "id");
  return {
    id,
    ownerUserId: requiredString(source, "owner_user_id"),
    name: requiredString(source, "name"),
    crewType: crewTypeFrom(source.crew_type),
    raceName: nullableString(source, "race_name"),
    raceDate: nullableString(source, "race_date"),
    raceDistanceMiles: nullableNumber(source, "race_distance_miles"),
    buildStartDate: requiredString(source, "build_start_date"),
    emblem: resolveCrewEmblem(source.emblem),
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
    .select(PROFILE_COLUMNS)
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
    .select(PROFILE_COLUMNS)
    .single();
  if (created.error) throw new Error(created.error.message);
  const createdRow = row(created.data);
  if (!createdRow) throw new Error("STACK profile could not be loaded.");
  return profileFrom(createdRow);
}

interface CrewDirectory {
  membersByCrewId: Map<string, CrewMember[]>;
  takenAccentColors: CrewMemberAccent[];
}

/**
 * Every crewmate across every crew this account belongs to, in two queries.
 *
 * The roster of the crew being viewed and the set of accent colors already
 * spoken for come from the same read: the accent uniqueness rule spans all of
 * a runner's crews, so a picker that only knew the active crew would offer
 * colors the database is about to reject.
 */
async function loadCrewDirectory(
  client: SupabaseClient,
  crewIds: readonly string[],
  viewerId: string,
): Promise<CrewDirectory> {
  const empty: CrewDirectory = { membersByCrewId: new Map(), takenAccentColors: [] };
  if (crewIds.length === 0) return empty;

  const membership = await client
    .from("crew_members")
    .select("crew_id,user_id,role,joined_at")
    .in("crew_id", crewIds)
    .order("joined_at");
  if (membership.error) throw new Error(membership.error.message);
  const memberRows = rows(membership.data);
  const userIds = [...new Set(memberRows.map((item) => requiredString(item, "user_id")))];
  if (userIds.length === 0) return empty;

  const profileResult = await client
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .in("id", userIds);
  if (profileResult.error) throw new Error(profileResult.error.message);
  const profiles = new Map(
    rows(profileResult.data).map((item) => {
      const profile = profileFrom(item);
      return [profile.id, profile] as const;
    }),
  );

  const membersByCrewId = new Map<string, CrewMember[]>();
  for (const item of memberRows) {
    const crewId = requiredString(item, "crew_id");
    const userId = requiredString(item, "user_id");
    const profile = profiles.get(userId);
    const roster = membersByCrewId.get(crewId) ?? [];
    roster.push({
      userId,
      role: roleFrom(item.role),
      joinedAt: requiredString(item, "joined_at"),
      displayName: profile?.displayName ?? "Runner",
      accentColor: profile?.accentColor ?? null,
      runnerIcon: profile?.runnerIcon ?? runnerIconFromSeed(userId),
    });
    membersByCrewId.set(crewId, roster);
  }

  // A color a crewmate merely renders with counts as taken too: the point is
  // that two runners in one tower never look alike, which a stable hash can
  // cause just as easily as an explicit pick.
  const takenAccentColors = [
    ...new Set(
      userIds
        .filter((userId) => userId !== viewerId)
        .map((userId) => crewMemberAccent(userId, profiles.get(userId)?.accentColor ?? null)),
    ),
  ];
  return { membersByCrewId, takenAccentColors };
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

/**
 * The account and every crew it belongs to.
 *
 * A runner can train for more than one race with more than one set of
 * friends, so membership is a list. Exactly one of those crews is the one
 * being viewed: `preferredCrewId` is the device's remembered choice, and it
 * loses gracefully to the oldest membership when it names a crew this account
 * has left, been removed from, or never joined.
 */
export async function loadCrewAccount(
  client: SupabaseClient,
  user: User,
  preferredCrewId?: string | null,
): Promise<LoadedCrewAccount> {
  const profile = await ensureProfile(client, user);
  const membership = await client
    .from("crew_members")
    .select("crew_id,role,joined_at")
    .eq("user_id", user.id)
    .order("joined_at");
  if (membership.error) throw new Error(membership.error.message);
  const membershipRows = rows(membership.data);
  const empty: LoadedCrewAccount = {
    profile,
    memberships: [],
    crew: null,
    role: null,
    members: [],
    invites: [],
    takenAccentColors: [],
  };
  if (membershipRows.length === 0) return empty;

  const crewIds = membershipRows.map((item) => requiredString(item, "crew_id"));
  const crewResult = await client.from("crews").select(CREW_COLUMNS).in("id", crewIds);
  if (crewResult.error) throw new Error(crewResult.error.message);
  const crewsById = new Map(
    rows(crewResult.data).map((item) => {
      const crew = crewFrom(item);
      return [crew.id, crew] as const;
    }),
  );

  const memberships: CrewMembershipSummary[] = [];
  for (const item of membershipRows) {
    const crew = crewsById.get(requiredString(item, "crew_id"));
    // A crew deleted between the two reads is simply gone from this list.
    if (!crew) continue;
    memberships.push({
      crew,
      role: roleFrom(item.role),
      joinedAt: requiredString(item, "joined_at"),
    });
  }
  if (memberships.length === 0) return empty;

  const active =
    memberships.find((item) => item.crew.id === preferredCrewId) ?? memberships[0];
  const directory = await loadCrewDirectory(
    client,
    memberships.map((item) => item.crew.id),
    user.id,
  );
  return {
    profile,
    memberships,
    crew: active.crew,
    role: active.role,
    members: directory.membersByCrewId.get(active.crew.id) ?? [],
    invites: await loadInvites(client, active.crew.id, active.role),
    takenAccentColors: directory.takenAccentColors,
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

/**
 * Saves an explicit accent pick. The database is the actual referee of
 * "already taken" — a trigger on `profiles` rejects a color any current
 * crewmate already has — so a race between two members picking at once
 * still can't produce a collision; this only carries the choice up.
 */
export async function updateAccentColor(
  client: SupabaseClient,
  userId: string,
  accentColor: CrewMemberAccent,
): Promise<void> {
  const result = await client
    .from("profiles")
    .update({ accent_color: accentColor })
    .eq("id", userId);
  if (result.error) throw new Error(result.error.message);
}

/**
 * Saves the runner's icon as a code, never as markup.
 *
 * Encoding here rather than accepting a string from the caller is what keeps
 * the "no user SVG in the database" rule structural instead of a convention:
 * the only thing that can reach this column is four validated indices.
 */
export async function updateRunnerIcon(
  client: SupabaseClient,
  userId: string,
  runnerIcon: RunnerIcon,
): Promise<void> {
  const result = await client
    .from("profiles")
    .update({ runner_icon: encodeRunnerIcon(runnerIcon) })
    .eq("id", userId);
  if (result.error) throw new Error(result.error.message);
}

/** Returns the new crew's id so the device can switch straight to it. */
export async function createCrew(
  client: SupabaseClient,
  input: CrewDetailsInput,
): Promise<string | null> {
  const details = validateCrewDetails(input);
  const result = await client.rpc("create_crew", {
    p_name: details.name,
    p_crew_type: details.crewType,
    p_race_name: details.raceName,
    p_race_date: details.raceDate,
    p_race_distance_miles: details.raceDistanceMiles,
    p_build_start_date: details.buildStartDate,
    p_emblem: encodeCrewEmblem(details.emblem),
  });
  if (result.error) throw new Error(result.error.message);
  return typeof result.data === "string" ? result.data : null;
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
    p_emblem: encodeCrewEmblem(details.emblem),
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
  const result = await client.rpc("current_crew_invite", { p_crew_id: crewId });
  if (result.error) throw new Error(result.error.message);
  const current = rows(result.data)[0];
  const token = current && requiredString(current, "invite_token");
  if (!token || !current) throw new Error("Crew invite could not be created.");
  return { url: inviteUrl(token), expiresAt: requiredString(current, "expires_at") };
}

export async function resetCrewInvite(
  client: SupabaseClient,
  crewId: string,
): Promise<{ url: string; expiresAt: string }> {
  const result = await client.rpc("reset_crew_invite", { p_crew_id: crewId });
  if (result.error) throw new Error(result.error.message);
  const current = rows(result.data)[0];
  const token = current && requiredString(current, "invite_token");
  if (!token || !current) throw new Error("Crew invite could not be reset.");
  return { url: inviteUrl(token), expiresAt: requiredString(current, "expires_at") };
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
  const crewId = requiredString(preview, "crew_id");
  return {
    crewId,
    crewName: requiredString(preview, "crew_name"),
    crewType: crewTypeFrom(preview.crew_type),
    raceName: nullableString(preview, "race_name"),
    raceDate: nullableString(preview, "race_date"),
    raceDistanceMiles: nullableNumber(preview, "race_distance_miles"),
    expiresAt: requiredString(preview, "expires_at"),
    emblem: resolveCrewEmblem(preview.emblem),
    alreadyMember: preview.already_member === true,
  };
}

/** Returns the joined crew's id so the device can switch straight to it. */
export async function redeemCrewInvite(
  client: SupabaseClient,
  token: string,
): Promise<string | null> {
  const result = await client.rpc("redeem_crew_invite", {
    p_token_hash: await hashInviteToken(token),
  });
  if (result.error) throw new Error(result.error.message);
  return typeof result.data === "string" ? result.data : null;
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
