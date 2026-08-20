import type { RunSource } from "../domain/types";
import type { CrewEmblem } from "./emblem";
import type { CrewMemberAccent } from "./memberAccent";
import type { RunnerIcon } from "./runnerIcon";

export interface CrewProfile {
  id: string;
  displayName: string;
  /** Null until the runner picks one in Settings; a stable hash fills in until then. */
  accentColor: CrewMemberAccent | null;
  /** Always renderable: an account with no saved icon gets its stable derived one. */
  runnerIcon: RunnerIcon;
  /** Props on the runner's own shared runs created after this are unread. */
  propsSeenAt: string;
}

/** `race`: the original race-centered Crew. `club`: an ongoing Run Club with no race required. */
export type CrewType = "race" | "club";

export interface RaceCrew {
  id: string;
  ownerUserId: string;
  name: string;
  crewType: CrewType;
  /** Null only for a `club`; always present for a `race` Crew. */
  raceName: string | null;
  raceDate: string | null;
  raceDistanceMiles: number | null;
  buildStartDate: string;
  /** Always renderable: a crew with no saved emblem gets its stable derived one. */
  emblem: CrewEmblem;
}

export type CrewRole = "owner" | "member";

export interface CrewMember {
  userId: string;
  role: CrewRole;
  joinedAt: string;
  displayName: string;
  /** Null until the runner picks one in Settings; a stable hash fills in until then. */
  accentColor: CrewMemberAccent | null;
  /** Always renderable: an account with no saved icon gets its stable derived one. */
  runnerIcon: RunnerIcon;
}

export interface CrewInvite {
  id: string;
  expiresAt: string;
  revokedAt: string | null;
  redeemedAt: string | null;
}

export interface CrewInvitePreview {
  crewId: string;
  crewName: string;
  crewType: CrewType;
  raceName: string | null;
  raceDate: string | null;
  raceDistanceMiles: number | null;
  expiresAt: string;
  emblem: CrewEmblem;
  /** True when the viewer is already in this crew, so joining is a no-op. */
  alreadyMember: boolean;
}

/** One crew this account belongs to, in the switcher's own order. */
export interface CrewMembershipSummary {
  crew: RaceCrew;
  role: CrewRole;
  joinedAt: string;
}

export interface LoadedCrewAccount {
  profile: CrewProfile;
  /** Every crew this account belongs to, oldest membership first. */
  memberships: CrewMembershipSummary[];
  /** The crew currently being viewed, drawn from `memberships`. */
  crew: RaceCrew | null;
  role: CrewRole | null;
  members: CrewMember[];
  invites: CrewInvite[];
  /**
   * Accent colors explicitly held by crewmates in any of this account's
   * crews. The database enforces the same union, so the Settings picker has
   * to know about crews the runner is not currently looking at.
   */
  takenAccentColors: CrewMemberAccent[];
}

export interface CrewMemberSummary {
  userId: string;
  displayName: string;
  weekStart: string;
  weeklyMiles: number;
  longestRun28dMiles: number;
  consistencyCompleted: number;
  consistencyDue: number;
  milesBuilt: number;
  updatedAt: string;
}

/**
 * The complete run contract available to UI-19.
 *
 * This intentionally does not resemble a personal RunLog: there is no
 * source, external id, exact start time, cadence, elevation, training load,
 * HR zones, effort, note, route or plan. Heart rate is the one piece of
 * health data shared, deliberately, per D-079 — average, max, and the
 * manual-entry fallback for a run with no imported average.
 */
export interface CrewSharedRun {
  id: string;
  /**
   * The contributing runner's own local STACK run id — already part of the
   * approved shared-run contract, since it is how a projection finds the row
   * it owns. Today reads it to tell whether the run it just logged still owes
   * the Crew Build a block (issue #120).
   */
  localRunId: string;
  userId: string;
  displayName: string;
  accentColor: CrewMemberAccent | null;
  runnerIcon: RunnerIcon;
  localDate: string;
  activityType: "easy" | "intervals" | "simulation" | "long" | "race" | "cross";
  distanceMiles: number;
  durationSeconds: number;
  /**
   * Issue #129: manual entry or a connected source. Absent or null on a row
   * shared before the column existed; every reader treats that as manual
   * entry, the same default personal STACK applies to a run with no source of
   * its own.
   */
  source?: RunSource | null;
  createdAt: string;
  updatedAt: string;
  buildRow: number | null;
  buildColumnStart: number | null;
  buildWidth?: 1 | 2 | 3 | 4 | null;
  buildHeight?: 1 | 2 | 3 | null;
  /** Independent shared Crew Build placement; never personal placement. */
  crewBuildRow: number | null;
  crewBuildColumnStart: number | null;
  /** Dedicated construction time; projection updates never change it. */
  crewBuildPlacedAt: string | null;
  /** Source-verified, from `RunLog.importedMetrics`. Never present without a sync. */
  averageHeartRate?: number | null;
  maxHeartRate?: number | null;
  /** Hand-typed, from `RunLog.manualHeartRate` — see its fallback rule in `CrewRunDetailSheet`. */
  manualHeartRate?: number | null;
  propsCount: number;
  viewerHasPropped: boolean;
}

/**
 * The only run facts a Crew Mini Build can consume. Duration and every
 * personal/private RunLog field are deliberately absent from this contract.
 */
export interface CrewMiniBuildRun {
  id: string;
  userId: string;
  localDate: string;
  activityType: "easy" | "intervals" | "simulation" | "long" | "race" | "cross";
  distanceMiles: number;
  /**
   * Issue #129: the same asterisk the shared tower uses. Member Build
   * reproduces the runner's real Personal Build, so a run cannot be marked
   * hand-logged there and unmarked here.
   */
  source?: RunSource | null;
  buildRow: number | null;
  buildColumnStart: number | null;
  buildWidth?: 1 | 2 | 3 | 4 | null;
  buildHeight?: 1 | 2 | 3 | null;
}

/**
 * The only run facts the communal Crew Build may consume.
 *
 * `buildRow` / `buildColumnStart` are deliberately absent: personal placement
 * describes one runner's private arrangement and has no meaning in a tower
 * everybody contributes to, so the Crew Build cannot read it even by accident.
 * `createdAt` is present because it is the communal contribution order.
 * `durationSeconds` is present only so a Cross Training block's height can
 * scale with it, the same rule personal Build uses; no other type reads it.
 */
/**
 * `runnerIcon` is deliberately absent. A Crew Build block is member-colored
 * and carries at most an initial; the runner's icon belongs in the legend and
 * the identity UI around the tower, not stamped onto every brick.
 */
export interface CrewBuildRun {
  id: string;
  userId: string;
  displayName: string;
  accentColor: CrewMemberAccent | null;
  localDate: string;
  activityType: "easy" | "intervals" | "simulation" | "long" | "race" | "cross";
  distanceMiles: number;
  durationSeconds: number;
  /** Issue #129: the one fact behind a manually logged block's asterisk. */
  source?: RunSource | null;
  createdAt: string;
  crewBuildRow: number | null;
  crewBuildColumnStart: number | null;
  crewBuildPlacedAt: string | null;
}

/** One teammate's Props on one of the viewer's own shared runs. */
export interface CrewPropNotification {
  id: string;
  runId: string;
  runLocalDate: string;
  runActivityType: "easy" | "intervals" | "simulation" | "long" | "race" | "cross";
  runDistanceMiles: number;
  actorUserId: string;
  actorDisplayName: string;
  actorAccentColor: CrewMemberAccent | null;
  actorRunnerIcon: RunnerIcon;
  createdAt: string;
}

export interface CrewDashboardData {
  members: CrewMember[];
  summaries: CrewMemberSummary[];
  runs: CrewSharedRun[];
  miniBuildRuns: CrewMiniBuildRun[];
  crewBuildRuns: CrewBuildRun[];
  sharedRunsAvailable: boolean;
  /** True when the safety ceiling was reached and older shared runs were not read. */
  sharedRunsTruncated: boolean;
  propsAvailable: boolean;
  /** Props on the viewer's own runs only, newest first. */
  propNotifications: CrewPropNotification[];
  loadedAt: string;
}
