import { addDaysToLocalDate, compareLocalDates, formatLocalDate, parseLocalDate } from "../domain/dates";
import { formatMiles } from "../domain/distance";
import { formatPaceSeconds } from "../domain/runs";
import type { RunActivityType } from "../domain/types";
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

export const STANDARD_CREW_AWARD_TYPES = [
  "miles",
  "zone2",
  "pace",
  "runs",
] as const satisfies readonly CrewAwardType[];

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

/** Safe, Crew-visible facts used only to rank the current week's awards. */
export interface CrewAwardMetricRun {
  id: string;
  userId: string;
  localDate: string;
  activityType: RunActivityType;
  distanceMiles: number;
  durationSeconds: number;
  createdAt: string;
  zone2Percent: number | null;
  targetPercent: number | null;
  levelUpPercent: number | null;
  steadySeconds: number | null;
}

export interface CrewAwardLeader {
  awardType: CrewAwardType;
  userId: string;
  resultValue: number;
  sourceSharedRunId: string | null;
}

export interface CrewAwardWeek {
  weekStart: string;
  weekEnd: string;
  featureType: CrewAwardType;
  leaders: CrewAwardLeader[];
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

export function crewAwardWeekStart(localDate: string): string {
  const parsed = parseLocalDate(localDate);
  parsed.setDate(parsed.getDate() - ((parsed.getDay() + 6) % 7));
  return formatLocalDate(parsed);
}

export function crewFeatureAwardForWeek(
  buildStartDate: string,
  weekStart: string,
): (typeof FEATURE_CREW_AWARD_TYPES)[number] {
  const anchor = crewAwardWeekStart(buildStartDate);
  const anchorDate = parseLocalDate(anchor).getTime();
  const weekDate = parseLocalDate(weekStart).getTime();
  const weeks = Math.max(0, Math.floor((weekDate - anchorDate) / (7 * 24 * 60 * 60_000)));
  return FEATURE_CREW_AWARD_TYPES[weeks % FEATURE_CREW_AWARD_TYPES.length];
}

function runPace(run: CrewAwardMetricRun): number | null {
  return run.distanceMiles > 0 && run.durationSeconds > 0
    ? run.durationSeconds / run.distanceMiles
    : null;
}

function eligibleRunningRuns(
  runs: readonly CrewAwardMetricRun[],
  weekStart: string,
  buildStartDate: string,
): CrewAwardMetricRun[] {
  const weekEnd = addDaysToLocalDate(weekStart, 6);
  return runs.filter(
    (run) =>
      run.activityType !== "cross" &&
      compareLocalDates(run.localDate, buildStartDate) >= 0 &&
      compareLocalDates(run.localDate, weekStart) >= 0 &&
      compareLocalDates(run.localDate, weekEnd) <= 0,
  );
}

function firstBy<T>(items: readonly T[], compare: (left: T, right: T) => number): T | null {
  return items.length ? [...items].sort(compare)[0] : null;
}

/**
 * Current-week standings mirror the server finalizer exactly enough to show a
 * live leader without creating an award early. The server remains the only
 * authority that actually mints a block after the week closes.
 */
export function deriveCrewAwardWeek(
  runs: readonly CrewAwardMetricRun[],
  buildStartDate: string,
  today: string,
): CrewAwardWeek {
  const weekStart = crewAwardWeekStart(today);
  const weekEnd = addDaysToLocalDate(weekStart, 6);
  const featureType = crewFeatureAwardForWeek(buildStartDate, weekStart);
  const eligible = eligibleRunningRuns(runs, weekStart, buildStartDate);
  const leaders: CrewAwardLeader[] = [];

  const byUser = new Map<string, CrewAwardMetricRun[]>();
  for (const run of eligible) {
    const current = byUser.get(run.userId) ?? [];
    current.push(run);
    byUser.set(run.userId, current);
  }

  const mileRows = [...byUser.entries()].map(([userId, userRuns]) => ({
    userId,
    resultValue: userRuns.reduce((sum, run) => sum + run.distanceMiles, 0),
    longest: userRuns.reduce((longest, run) => Math.max(longest, run.distanceMiles), 0),
    firstAt: userRuns.reduce((first, run) => (first === "" || run.createdAt < first ? run.createdAt : first), ""),
  }));
  const miles = firstBy(mileRows.filter((row) => row.resultValue > 0), (a, b) =>
    b.resultValue - a.resultValue || b.longest - a.longest || a.firstAt.localeCompare(b.firstAt) || a.userId.localeCompare(b.userId));
  if (miles) leaders.push({ awardType: "miles", userId: miles.userId, resultValue: miles.resultValue, sourceSharedRunId: null });

  const zone2 = firstBy(
    eligible.filter((run) => run.durationSeconds >= 1800 && run.zone2Percent !== null),
    (a, b) =>
      (b.zone2Percent ?? 0) - (a.zone2Percent ?? 0) ||
      b.durationSeconds - a.durationSeconds ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id),
  );
  if (zone2?.zone2Percent !== null && zone2) leaders.push({ awardType: "zone2", userId: zone2.userId, resultValue: zone2.zone2Percent!, sourceSharedRunId: zone2.id });

  const pace = firstBy(
    eligible.filter((run) => run.distanceMiles >= 2 && run.durationSeconds > 0),
    (a, b) =>
      (runPace(a) ?? Number.POSITIVE_INFINITY) - (runPace(b) ?? Number.POSITIVE_INFINITY) ||
      b.distanceMiles - a.distanceMiles ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id),
  );
  const paceValue = pace ? runPace(pace) : null;
  if (pace && paceValue !== null) leaders.push({ awardType: "pace", userId: pace.userId, resultValue: paceValue, sourceSharedRunId: pace.id });

  const runRows = [...byUser.entries()].map(([userId, userRuns]) => {
    const qualifying = userRuns.filter((run) => run.distanceMiles >= 1 || run.durationSeconds >= 600);
    return {
      userId,
      resultValue: qualifying.length,
      totalMiles: qualifying.reduce((sum, run) => sum + run.distanceMiles, 0),
      firstAt: qualifying.reduce((first, run) => (first === "" || run.createdAt < first ? run.createdAt : first), ""),
    };
  });
  const runCount = firstBy(runRows.filter((row) => row.resultValue > 0), (a, b) =>
    b.resultValue - a.resultValue || b.totalMiles - a.totalMiles || a.firstAt.localeCompare(b.firstAt) || a.userId.localeCompare(b.userId));
  if (runCount) leaders.push({ awardType: "runs", userId: runCount.userId, resultValue: runCount.resultValue, sourceSharedRunId: null });

  if (featureType === "longHaul") {
    const winner = firstBy(eligible.filter((run) => run.distanceMiles > 0), (a, b) =>
      b.distanceMiles - a.distanceMiles ||
      (runPace(a) ?? Number.POSITIVE_INFINITY) - (runPace(b) ?? Number.POSITIVE_INFINITY) ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id));
    if (winner) leaders.push({ awardType: featureType, userId: winner.userId, resultValue: winner.distanceMiles, sourceSharedRunId: winner.id });
  } else if (featureType === "steady") {
    const winner = firstBy(
      eligible.filter((run) => run.durationSeconds >= 1800 && run.steadySeconds !== null),
      (a, b) =>
        (a.steadySeconds ?? Number.POSITIVE_INFINITY) - (b.steadySeconds ?? Number.POSITIVE_INFINITY) ||
        b.durationSeconds - a.durationSeconds ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id),
    );
    if (winner?.steadySeconds !== null && winner) leaders.push({ awardType: featureType, userId: winner.userId, resultValue: winner.steadySeconds!, sourceSharedRunId: winner.id });
  } else if (featureType === "onTarget") {
    const winner = firstBy(
      eligible.filter((run) => run.targetPercent !== null),
      (a, b) =>
        (b.targetPercent ?? 0) - (a.targetPercent ?? 0) ||
        b.distanceMiles - a.distanceMiles ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id),
    );
    if (winner?.targetPercent !== null && winner) leaders.push({ awardType: featureType, userId: winner.userId, resultValue: winner.targetPercent!, sourceSharedRunId: winner.id });
  } else {
    const winner = firstBy(
      eligible.filter((run) => (run.levelUpPercent ?? 0) > 0),
      (a, b) =>
        (b.levelUpPercent ?? 0) - (a.levelUpPercent ?? 0) ||
        b.distanceMiles - a.distanceMiles ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id),
    );
    if (winner?.levelUpPercent !== null && winner) leaders.push({ awardType: featureType, userId: winner.userId, resultValue: winner.levelUpPercent!, sourceSharedRunId: winner.id });
  }

  return { weekStart, weekEnd, featureType, leaders };
}

export function formatCrewAwardResult(type: CrewAwardType, value: number): string {
  if (type === "miles" || type === "longHaul") return `${formatMiles(value)} MI`;
  if (type === "pace") return formatPaceSeconds(value);
  if (type === "runs") return `${Math.round(value)} ${Math.round(value) === 1 ? "RUN" : "RUNS"}`;
  if (type === "steady") return `±${Math.round(value)} SEC/MI`;
  return `${Math.round(value)}%`;
}
