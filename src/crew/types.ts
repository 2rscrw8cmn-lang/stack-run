export interface CrewProfile {
  id: string;
  displayName: string;
}

export interface RaceCrew {
  id: string;
  ownerUserId: string;
  name: string;
  raceName: string;
  raceDate: string;
  raceDistanceMiles: number;
}

export type CrewRole = "owner" | "member";

export interface CrewMember {
  userId: string;
  role: CrewRole;
  joinedAt: string;
  displayName: string;
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
  raceName: string;
  raceDate: string;
  raceDistanceMiles: number;
  expiresAt: string;
}

export interface LoadedCrewAccount {
  profile: CrewProfile;
  crew: RaceCrew | null;
  role: CrewRole | null;
  members: CrewMember[];
  invites: CrewInvite[];
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
 * This intentionally does not resemble a personal RunLog: there is no source,
 * external id, exact start time, health data, effort, note, route or plan.
 */
export interface CrewSharedRun {
  id: string;
  userId: string;
  displayName: string;
  localDate: string;
  activityType: "easy" | "intervals" | "simulation" | "long" | "race";
  distanceMiles: number;
  durationSeconds: number;
  createdAt: string;
  updatedAt: string;
  buildRow: number | null;
  buildColumnStart: number | null;
  /** Independent shared Crew Build placement; never personal placement. */
  crewBuildRow: number | null;
  crewBuildColumnStart: number | null;
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
  activityType: "easy" | "intervals" | "simulation" | "long" | "race";
  distanceMiles: number;
  buildRow: number | null;
  buildColumnStart: number | null;
}

/**
 * The only run facts the communal Crew Build may consume.
 *
 * `buildRow` / `buildColumnStart` are deliberately absent: personal placement
 * describes one runner's private arrangement and has no meaning in a tower
 * everybody contributes to, so the Crew Build cannot read it even by accident.
 * `createdAt` is present because it is the communal contribution order.
 */
export interface CrewBuildRun {
  id: string;
  userId: string;
  displayName: string;
  localDate: string;
  activityType: "easy" | "intervals" | "simulation" | "long" | "race";
  distanceMiles: number;
  createdAt: string;
  crewBuildRow: number | null;
  crewBuildColumnStart: number | null;
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
  loadedAt: string;
}
