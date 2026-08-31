import {
  addDaysToLocalDate,
  compareLocalDates,
  daysBetweenLocalDates,
  mondayOfLocalDate,
} from "../domain/dates.js";
import {
  handFootprint,
  type PlacedHeight,
  type PlacedWidth,
} from "../domain/footprint.js";
import type { RunActivityType, RunSource } from "../domain/types.js";
import type { CrewAwardBlockRecord, CrewAwardType } from "./awards.js";
import {
  faceVisibilityOf,
  occupiedCellsOf,
  topOf,
  voidsOf,
  type GridVoid,
} from "../domain/placement.js";
import { crewBuildFootprint, CREW_BUILD_COLUMNS } from "./crewBuild.js";
import type { CrewMemberAccent } from "./memberAccent.js";
import type { RunnerIcon } from "./runnerIcon.js";
import type { CrewMember, CrewSharedRun, CrewWeekRecapRun } from "./types.js";

export const CREW_RECAP_WEEK_DAYS = 7;
export const CREW_RECAP_TODAY_DAYS = 3;

export interface CrewWeekWindow {
  weekStart: string;
  weekEnd: string;
}

export interface CrewWeekRecapRunner {
  userId: string;
  displayName: string;
  accentColor: CrewMemberAccent | null;
  runnerIcon: RunnerIcon;
}

export interface CrewWeekRecapSliceBlock {
  id: string;
  userId: string;
  accentColor: CrewMemberAccent | null;
  activityType: RunActivityType;
  distanceMiles: number;
  source: RunSource | null;
  /** The footprint as it stands in the tower, so a turned block stays turned. */
  width: PlacedWidth;
  height: PlacedHeight;
  columnStart: number;
  row: number;
}

export interface CrewWeekRecapAward {
  id: string;
  awardType: CrewAwardType;
  resultValue: number;
  winner: CrewWeekRecapRunner | null;
}

export interface CrewWeekRecapTotals {
  miles: number;
  runs: number;
  durationSeconds: number;
  activeRunners: number;
}

export type CrewWeekPerformanceKind =
  | "best5k"
  | "bestPace"
  | "longestRun"
  | "mostMiles"
  | "mostRuns"
  | "mostTimeRunning"
  | "biggestMileageIncrease"
  | "biggestCrewDay"
  | "mostRunnersDay";

export interface CrewWeekPerformance {
  kind: CrewWeekPerformanceKind;
  value: number;
  runCount: number | null;
  runner: CrewWeekRecapRunner | null;
  /** Null for week-level individual totals that do not belong to one date. */
  localDate: string | null;
  activityType: RunActivityType | null;
  runId: string | null;
}

export type CrewWeekRecapBeat =
  | {
    kind: "participation";
    everyoneRan: boolean;
    activeRunners: number;
    rosterSize: number;
    runners: CrewWeekRecapRunner[];
  }
  | {
    kind: "performances";
    items: CrewWeekPerformance[];
  }
  | {
    kind: "build";
    blocksPlaced: number;
    milesPlaced: number;
    courses: number;
    slice: CrewWeekRecapSliceBlock[];
  }
  | {
    kind: "specialBlocks";
    awards: CrewWeekRecapAward[];
  }
  | {
    kind: "change";
    previousMiles: number;
    deltaMiles: number;
  };

export interface CrewWeekRecap {
  crewId: string;
  crewName: string;
  weekStart: string;
  weekEnd: string;
  totals: CrewWeekRecapTotals;
  beats: CrewWeekRecapBeat[];
}

export interface CrewWeekRecapInput {
  crewId: string;
  crewName: string;
  buildStartDate: string;
  members: readonly CrewMember[];
  runs: readonly CrewWeekRecapRun[];
  awards?: readonly CrewAwardBlockRecord[];
  week: CrewWeekWindow;
}

export function crewWeekRecapRunsFrom(
  runs: readonly CrewSharedRun[],
): CrewWeekRecapRun[] {
  return runs.map((run) => ({
    id: run.id,
    userId: run.userId,
    displayName: run.displayName,
    accentColor: run.accentColor,
    runnerIcon: run.runnerIcon,
    localDate: run.localDate,
    activityType: run.activityType,
    distanceMiles: run.distanceMiles,
    durationSeconds: run.durationSeconds,
    source: run.source ?? null,
    best5kSeconds: run.best5kSeconds ?? null,
    crewBuildRow: run.crewBuildRow,
    crewBuildColumnStart: run.crewBuildColumnStart,
    crewBuildRotated: run.crewBuildRotated,
  }));
}

export function crewWeekContaining(localDate: string): CrewWeekWindow {
  const weekStart = mondayOfLocalDate(localDate);
  return { weekStart, weekEnd: addDaysToLocalDate(weekStart, CREW_RECAP_WEEK_DAYS - 1) };
}

export function lastClosedCrewWeek(today: string): CrewWeekWindow {
  return crewWeekContaining(addDaysToLocalDate(mondayOfLocalDate(today), -1));
}

export function nextCrewWeekAfter(week: CrewWeekWindow): CrewWeekWindow {
  return crewWeekContaining(addDaysToLocalDate(week.weekEnd, 1));
}

export function isCrewRecapCurrent(
  week: CrewWeekWindow,
  today: string,
  days = CREW_RECAP_TODAY_DAYS,
): boolean {
  const age = daysBetweenLocalDates(week.weekEnd, today);
  return age >= 1 && age <= days;
}

function inWeek(localDate: string, week: CrewWeekWindow): boolean {
  return (
    compareLocalDates(localDate, week.weekStart) >= 0 &&
    compareLocalDates(localDate, week.weekEnd) <= 0
  );
}

function runnerOf(run: CrewWeekRecapRun): CrewWeekRecapRunner {
  return {
    userId: run.userId,
    displayName: run.displayName,
    accentColor: run.accentColor,
    runnerIcon: run.runnerIcon,
  };
}

function memberRunner(member: CrewMember): CrewWeekRecapRunner {
  return {
    userId: member.userId,
    displayName: member.displayName,
    accentColor: member.accentColor,
    runnerIcon: member.runnerIcon,
  };
}

function roundMiles(value: number): number {
  return Number(value.toFixed(2));
}

/**
 * The block as it actually stands in the shared tower, turned or not. The
 * recap crops the real thing, so it measures the real footprint (#204).
 */
function recapFootprint(run: CrewWeekRecapRun) {
  return handFootprint(crewBuildFootprint(run), run.crewBuildRotated);
}

function isPlacedInTower(run: CrewWeekRecapRun): boolean {
  return (
    run.crewBuildRow !== null &&
    Number.isInteger(run.crewBuildRow) &&
    run.crewBuildRow >= 0 &&
    run.crewBuildColumnStart !== null &&
    Number.isInteger(run.crewBuildColumnStart) &&
    run.crewBuildColumnStart >= 1 &&
    run.crewBuildColumnStart +
      recapFootprint(run).width -
      1 <=
      CREW_BUILD_COLUMNS
  );
}

function participationBeat(
  members: readonly CrewMember[],
  ranUserIds: ReadonlySet<string>,
): CrewWeekRecapBeat | null {
  if (members.length === 0) return null;
  const runners = members
    .filter((member) => ranUserIds.has(member.userId))
    .map(memberRunner);
  if (runners.length === 0) return null;
  return {
    kind: "participation",
    everyoneRan: members.length > 1 && runners.length === members.length,
    activeRunners: runners.length,
    rosterSize: members.length,
    runners,
  };
}

function bestRun(
  runs: readonly CrewWeekRecapRun[],
  qualifies: (run: CrewWeekRecapRun) => boolean,
  measure: (run: CrewWeekRecapRun) => number,
  better: (candidate: number, incumbent: number) => boolean,
): { run: CrewWeekRecapRun; value: number } | null {
  let best: { run: CrewWeekRecapRun; value: number } | null = null;
  let tied = false;
  for (const run of runs) {
    if (!qualifies(run)) continue;
    const value = measure(run);
    if (!Number.isFinite(value)) continue;
    if (best === null || better(value, best.value)) {
      best = { run, value };
      tied = false;
    } else if (value === best.value) {
      tied = true;
    }
  }
  return best && !tied ? best : null;
}

function performanceOf(
  kind: CrewWeekPerformanceKind,
  best: { run: CrewWeekRecapRun; value: number },
): CrewWeekPerformance {
  return {
    kind,
    value: best.value,
    runCount: null,
    runner: runnerOf(best.run),
    localDate: best.run.localDate,
    activityType: best.run.activityType,
    runId: best.run.id,
  };
}

interface CrewDay {
  localDate: string;
  miles: number;
  runs: number;
  runnerIds: Set<string>;
}

function crewDays(runs: readonly CrewWeekRecapRun[]): CrewDay[] {
  const byDay = new Map<string, CrewDay>();
  for (const run of runs) {
    const day = byDay.get(run.localDate) ?? {
      localDate: run.localDate,
      miles: 0,
      runs: 0,
      runnerIds: new Set<string>(),
    };
    day.miles += run.distanceMiles;
    day.runs += 1;
    day.runnerIds.add(run.userId);
    byDay.set(run.localDate, day);
  }
  return [...byDay.values()].sort((left, right) =>
    left.localDate.localeCompare(right.localDate),
  );
}

function bestDay(
  days: readonly CrewDay[],
  measure: (day: CrewDay) => number,
  floor: number,
): CrewDay | null {
  let best: CrewDay | null = null;
  let tied = false;
  for (const day of days) {
    const value = measure(day);
    if (best === null || value > measure(best)) {
      best = day;
      tied = false;
    } else if (value === measure(best)) {
      tied = true;
    }
  }
  return best && !tied && measure(best) >= floor ? best : null;
}

function dayPerformance(
  kind: CrewWeekPerformanceKind,
  day: CrewDay,
  value: number,
): CrewWeekPerformance {
  return {
    kind,
    value,
    runCount: day.runs,
    runner: null,
    localDate: day.localDate,
    activityType: null,
    runId: null,
  };
}

interface RunnerWeek {
  userId: string;
  runner: CrewWeekRecapRunner;
  miles: number;
  runs: number;
  durationSeconds: number;
}

function runnerWeeks(runs: readonly CrewWeekRecapRun[]): RunnerWeek[] {
  const byRunner = new Map<string, RunnerWeek>();
  for (const run of runs) {
    const current = byRunner.get(run.userId) ?? {
      userId: run.userId,
      runner: runnerOf(run),
      miles: 0,
      runs: 0,
      durationSeconds: 0,
    };
    current.miles += Math.max(0, run.distanceMiles);
    current.runs += 1;
    current.durationSeconds += Math.max(0, run.durationSeconds);
    byRunner.set(run.userId, current);
  }
  return [...byRunner.values()].sort((left, right) => left.userId.localeCompare(right.userId));
}

function uniqueBestRunner<T>(
  values: readonly T[],
  measure: (value: T) => number,
): { value: T; measure: number } | null {
  let best: { value: T; measure: number } | null = null;
  let tied = false;
  for (const value of values) {
    const score = measure(value);
    if (!Number.isFinite(score)) continue;
    if (best === null || score > best.measure) {
      best = { value, measure: score };
      tied = false;
    } else if (score === best.measure) {
      tied = true;
    }
  }
  return best && !tied ? best : null;
}

function runnerWeekPerformance(
  kind: CrewWeekPerformanceKind,
  winner: RunnerWeek,
  value: number,
): CrewWeekPerformance {
  return {
    kind,
    value,
    runCount: winner.runs,
    runner: winner.runner,
    localDate: null,
    activityType: null,
    runId: null,
  };
}

function best5kRun(
  weekRuns: readonly CrewWeekRecapRun[],
): { run: CrewWeekRecapRun; value: number } | null {
  return bestRun(
    weekRuns,
    (run) =>
      typeof run.best5kSeconds === "number" &&
      Number.isFinite(run.best5kSeconds) &&
      run.best5kSeconds > 0,
    (run) => run.best5kSeconds!,
    (candidate, incumbent) => candidate < incumbent,
  );
}

function performancesBeat(
  weekRuns: readonly CrewWeekRecapRun[],
  allRuns: readonly CrewWeekRecapRun[],
  week: CrewWeekWindow,
): CrewWeekRecapBeat | null {
  const best5k = best5kRun(weekRuns);
  const pace = bestRun(
    weekRuns,
    (run) =>
      run.activityType !== "cross" &&
      run.distanceMiles >= 2 &&
      run.durationSeconds > 0,
    (run) => run.durationSeconds / run.distanceMiles,
    (candidate, incumbent) => candidate < incumbent,
  );
  const longest = bestRun(
    weekRuns,
    (run) => run.distanceMiles > 0,
    (run) => run.distanceMiles,
    (candidate, incumbent) => candidate > incumbent,
  );

  const currentRunnerWeeks = runnerWeeks(weekRuns);
  const mostMiles = uniqueBestRunner(currentRunnerWeeks, (runner) => runner.miles);
  const mostRuns = uniqueBestRunner(currentRunnerWeeks, (runner) => runner.runs);
  const mostTime = uniqueBestRunner(currentRunnerWeeks, (runner) => runner.durationSeconds);

  const previousWeek = crewWeekContaining(addDaysToLocalDate(week.weekStart, -1));
  const previousByRunner = new Map(
    runnerWeeks(allRuns.filter((run) => inWeek(run.localDate, previousWeek))).map((runner) => [
      runner.userId,
      runner,
    ] as const),
  );
  const improvementCandidates = currentRunnerWeeks.flatMap((runner) => {
    const previous = previousByRunner.get(runner.userId);
    if (!previous || previous.miles <= 0) return [];
    const increase = runner.miles - previous.miles;
    return increase > 0 ? [{ runner, increase }] : [];
  });
  const biggestIncrease = uniqueBestRunner(improvementCandidates, (item) => item.increase);

  const days = crewDays(weekRuns);
  const biggestCrewDay = bestDay(days, (day) => day.miles, 0.01);
  const mostRunnersDay = bestDay(days, (day) => day.runnerIds.size, 2);

  const candidates: (CrewWeekPerformance | null)[] = [
    best5k ? performanceOf("best5k", best5k) : null,
    pace ? performanceOf("bestPace", pace) : null,
    longest ? performanceOf("longestRun", longest) : null,
    mostMiles
      ? runnerWeekPerformance("mostMiles", mostMiles.value, roundMiles(mostMiles.measure))
      : null,
    mostRuns
      ? runnerWeekPerformance("mostRuns", mostRuns.value, mostRuns.measure)
      : null,
    mostTime
      ? runnerWeekPerformance("mostTimeRunning", mostTime.value, mostTime.measure)
      : null,
    biggestIncrease
      ? runnerWeekPerformance(
          "biggestMileageIncrease",
          biggestIncrease.value.runner,
          roundMiles(biggestIncrease.measure),
        )
      : null,
    biggestCrewDay
      ? dayPerformance("biggestCrewDay", biggestCrewDay, roundMiles(biggestCrewDay.miles))
      : null,
    mostRunnersDay
      ? dayPerformance("mostRunnersDay", mostRunnersDay, mostRunnersDay.runnerIds.size)
      : null,
  ];

  const items = candidates.filter(
    (item): item is CrewWeekPerformance => item !== null,
  );
  return items.length > 0 ? { kind: "performances", items } : null;
}

function buildBeat(
  weekRuns: readonly CrewWeekRecapRun[],
): CrewWeekRecapBeat | null {
  const placed = weekRuns.filter(isPlacedInTower);
  if (placed.length === 0) return null;

  const lowestRow = placed.reduce(
    (lowest, run) => Math.min(lowest, run.crewBuildRow!),
    Number.POSITIVE_INFINITY,
  );
  const slice: CrewWeekRecapSliceBlock[] = placed
    .map((run) => {
      const { width, height } = recapFootprint(run);
      return {
        id: run.id,
        userId: run.userId,
        accentColor: run.accentColor,
        activityType: run.activityType,
        distanceMiles: run.distanceMiles,
        source: run.source ?? null,
        width,
        height,
        columnStart: run.crewBuildColumnStart!,
        row: run.crewBuildRow! - lowestRow,
      };
    })
    .sort(
      (left, right) =>
        left.row - right.row ||
        left.columnStart - right.columnStart ||
        left.id.localeCompare(right.id),
    );

  return {
    kind: "build",
    blocksPlaced: placed.length,
    milesPlaced: roundMiles(
      placed.reduce((total, run) => total + run.distanceMiles, 0),
    ),
    courses: slice.reduce(
      (highest, block) => Math.max(highest, block.row + block.height),
      0,
    ),
    slice,
  };
}

function specialBlocksBeat(
  awards: readonly CrewAwardBlockRecord[],
  week: CrewWeekWindow,
  runnerById: ReadonlyMap<string, CrewWeekRecapRunner>,
): CrewWeekRecapBeat | null {
  const placed = awards
    .filter(
      (award) =>
        award.weekStart === week.weekStart &&
        award.crewBuildRow !== null &&
        award.crewBuildColumnStart !== null,
    )
    .sort(
      (left, right) =>
        left.awardType.localeCompare(right.awardType) || left.id.localeCompare(right.id),
    )
    .map((award) => ({
      id: award.id,
      awardType: award.awardType,
      resultValue: award.resultValue,
      winner: runnerById.get(award.winnerUserId) ?? null,
    }));
  return placed.length > 0 ? { kind: "specialBlocks", awards: placed } : null;
}

function changeBeat(
  runs: readonly CrewWeekRecapRun[],
  week: CrewWeekWindow,
  buildStartDate: string,
  miles: number,
): CrewWeekRecapBeat | null {
  const previous = crewWeekContaining(addDaysToLocalDate(week.weekStart, -1));
  if (compareLocalDates(previous.weekStart, buildStartDate) < 0) return null;

  const previousRuns = runs.filter((run) => inWeek(run.localDate, previous));
  if (previousRuns.length === 0) return null;

  const previousMiles = roundMiles(
    previousRuns.reduce((total, run) => total + run.distanceMiles, 0),
  );
  if (!(previousMiles > 0)) return null;

  return {
    kind: "change",
    previousMiles,
    deltaMiles: roundMiles(miles - previousMiles),
  };
}

export function crewWeekRecap(input: CrewWeekRecapInput): CrewWeekRecap | null {
  const { week } = input;
  if (compareLocalDates(week.weekEnd, input.buildStartDate) < 0) return null;

  const weekRuns = input.runs.filter((run) => inWeek(run.localDate, week));
  if (weekRuns.length === 0) return null;

  const miles = roundMiles(
    weekRuns.reduce((total, run) => total + run.distanceMiles, 0),
  );
  const durationSeconds = weekRuns.reduce(
    (total, run) => total + Math.max(0, run.durationSeconds),
    0,
  );
  const ranUserIds = new Set(weekRuns.map((run) => run.userId));

  const runnerById = new Map<string, CrewWeekRecapRunner>(
    input.members.map((member) => [member.userId, memberRunner(member)] as const),
  );
  for (const run of weekRuns) {
    if (!runnerById.has(run.userId)) runnerById.set(run.userId, runnerOf(run));
  }

  const beats = [
    participationBeat(input.members, ranUserIds),
    performancesBeat(weekRuns, input.runs, week),
    buildBeat(weekRuns),
    specialBlocksBeat(input.awards ?? [], week, runnerById),
    changeBeat(input.runs, week, input.buildStartDate, miles),
  ].filter((beat): beat is CrewWeekRecapBeat => beat !== null);

  return {
    crewId: input.crewId,
    crewName: input.crewName,
    weekStart: week.weekStart,
    weekEnd: week.weekEnd,
    totals: {
      miles,
      runs: weekRuns.length,
      durationSeconds,
      activeRunners: ranUserIds.size,
    },
    beats,
  };
}

export function crewWeekRecapKey(crewId: string, weekStart: string): string {
  return `${crewId}:${weekStart}`;
}

export interface CrewWeekRecapFacedBlock extends CrewWeekRecapSliceBlock {
  topFace: boolean[];
  rightFace: boolean[];
  depth: number;
}

export interface CrewWeekRecapTower {
  blocks: CrewWeekRecapFacedBlock[];
  voids: GridVoid[];
  courses: number;
}

export function faceCulledRecapSlice(
  beat: Extract<CrewWeekRecapBeat, { kind: "build" }>,
): CrewWeekRecapTower {
  const filled = occupiedCellsOf(beat.slice);
  return {
    blocks: beat.slice.map((block) => {
      const { topFace, rightFace } = faceVisibilityOf(block, filled);
      return { ...block, topFace, rightFace, depth: topOf(block) };
    }),
    voids: voidsOf(beat.slice, filled),
    courses: beat.courses,
  };
}
