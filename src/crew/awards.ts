import { formatMiles } from "../domain/distance";
import { formatPaceSeconds } from "../domain/runs";
import type { BlockWidth } from "../domain/footprint";

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
  crewBuildPlacedAt: string | null;
  createdAt: string;
}

export function isFeatureCrewAward(type: CrewAwardType): boolean {
  return FEATURE_CREW_AWARD_TYPES.includes(type as (typeof FEATURE_CREW_AWARD_TYPES)[number]);
}

/**
 * Awards are accent pieces, not another source of large structural spans.
 * Standard awards stay compact at two columns; Long Haul alone gets one extra
 * column so it still reads as a span without consuming half the eight-column tower.
 */
export function crewAwardFootprint(type: CrewAwardType): { width: BlockWidth; height: 1 } {
  return {
    width: type === "longHaul" ? 3 : 2,
    height: 1,
  };
}

export function formatCrewAwardResult(type: CrewAwardType, value: number): string {
  if (type === "miles" || type === "longHaul") return `${formatMiles(value)} MI`;
  if (type === "pace") return formatPaceSeconds(value);
  if (type === "runs") return `${Math.round(value)} ${Math.round(value) === 1 ? "RUN" : "RUNS"}`;
  if (type === "steady") return `±${Math.round(value)} SEC/MI`;
  return `${Math.round(value)}%`;
}
