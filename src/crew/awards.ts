import { formatMiles } from "../domain/distance.js";
import { formatPaceSeconds } from "../domain/runs.js";

export type CrewAwardType =
  | "miles"
  | "zone2"
  | "pace"
  | "runs"
  | "longHaul"
  | "steady"
  | "onTarget"
  | "levelUp";

export const FEATURE_CREW_AWARD_TYPES = [
  "longHaul",
  "steady",
  "onTarget",
  "levelUp",
] as const satisfies readonly CrewAwardType[];

export const CREW_AWARD_LABEL: Record<CrewAwardType, string> = {
  miles: "Most Miles",
  zone2: "Best Zone 2",
  pace: "Fastest Avg. Pace",
  runs: "Most Runs",
  longHaul: "Long Haul",
  steady: "Steady",
  onTarget: "On Target",
  levelUp: "Level Up",
};

export const CREW_AWARD_DESCRIPTION: Record<CrewAwardType, string> = {
  miles: "Awarded to whoever logged the most qualifying mileage this week.",
  zone2: "Awarded for the highest share of a qualifying run spent in Zone 2.",
  pace: "Awarded for the fastest average pace on a run of at least 2 miles.",
  runs: "Awarded for the most qualifying runs this week.",
  longHaul: "Awarded for the longest single qualifying run.",
  steady: "Awarded for the most even pace held across a qualifying run.",
  onTarget: "Awarded for the closest match to the week's scheduled target distance.",
  levelUp: "Awarded for the biggest pace improvement over that runner's recent baseline.",
};

export const CREW_AWARD_SHORT_LABEL: Record<CrewAwardType, string> = {
  miles: "MILES",
  zone2: "ZONE 2",
  pace: "PACE",
  runs: "RUNS",
  longHaul: "LONG",
  steady: "STEADY",
  onTarget: "TARGET",
  levelUp: "LEVEL UP",
};

export interface CrewAwardBlockRecord {
  id: string;
  crewId: string;
  weekStart: string;
  awardType: CrewAwardType;
  winnerUserId: string;
  resultValue: number;
  sourceSharedRunId: string | null;
  crewBuildRow: number | null;
  crewBuildColumnStart: number | null;
  /** Compatibility field from #204; fixed square awards never rotate. */
  crewBuildRotated: boolean;
  crewBuildPlacedAt: string | null;
  createdAt: string;
}

export function isFeatureCrewAward(type: CrewAwardType): boolean {
  return FEATURE_CREW_AWARD_TYPES.includes(type as (typeof FEATURE_CREW_AWARD_TYPES)[number]);
}

/**
 * Every Crew award is one literal square placement cell.
 *
 * This is deliberately expressed directly in the #207 placement grid rather
 * than in visible columns/courses: one unit is half a visible column wide and
 * one course tall, which is the compact true square approved in #208. The
 * `placementUnits` marker tells the shared placement geometry not to double
 * this width the way it does for an earned run footprint.
 */
export function crewAwardFootprint(_type: CrewAwardType): {
  readonly width: 1;
  readonly height: 1;
  readonly placementUnits: true;
} {
  return { width: 1, height: 1, placementUnits: true };
}

export function formatCrewAwardResult(type: CrewAwardType, value: number): string {
  if (type === "miles" || type === "longHaul") return `${formatMiles(value)} MI`;
  if (type === "pace") return formatPaceSeconds(value);
  if (type === "runs") return `${Math.round(value)} ${Math.round(value) === 1 ? "RUN" : "RUNS"}`;
  if (type === "steady") return `±${Math.round(value)} SEC/MI`;
  return `${Math.round(value)}%`;
}
