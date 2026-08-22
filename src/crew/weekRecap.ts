import {
  addDaysToLocalDate,
  compareLocalDates,
  daysBetweenLocalDates,
  mondayOfLocalDate,
} from "../domain/dates";
import type { BlockHeight, BlockWidth } from "../domain/footprint";
import type { RunActivityType, RunSource } from "../domain/types";
import type { CrewAwardBlockRecord, CrewAwardType } from "./awards";
import {
  faceVisibilityOf,
  occupiedCellsOf,
  topOf,
  voidsOf,
  type GridVoid,
} from "../domain/placement";
import { crewBuildFootprint, CREW_BUILD_COLUMNS } from "./crewBuild";
import type { CrewMemberAccent } from "./memberAccent";
import type { RunnerIcon } from "./runnerIcon";
import type { CrewMember, CrewSharedRun, CrewWeekRecapRun } from "./types";

/**
 * Crew Week Recap — the weekly story a Crew built together.
 *
 * Evolution 2.04. This module is the whole factual half of the feature: the
 * Today module and the fuller recap read the same derived beats, so the two
 * surfaces cannot disagree about a week, and two members of the same Crew
 * looking at the same closed week see the same beats in the same order.
 *
 * Three rules hold the recap to STACK's existing contracts.
 *
 * **It is derived, never stored.** Nothing here writes a row, mints a score,
 * or ranks the roster. Every beat is recomputed from shared Crew data the
 * viewer already has, which is what makes it deterministic: the same closed
 * week produces the same recap on every device, at every hour, forever.
 *
 * **A missing fact omits its beat.** Absence never becomes zero, an estimate,
 * or a sentence hedged into meaning nothing. A week with one run produces a
 * short, true recap rather than a padded one — see `crewWeekRecap` for what
 * each beat requires before it exists at all.
 *
 * **It says nothing the Crew has not already said.** The run facts are the
 * shared-run contract (`CrewWeekRecapRun`, deliberately narrower again than
 * `CrewSharedRun`): no heart rate, no start times, no notes, no routes, no
 * plan. Special Blocks appear only once they are standing in the Crew Build,
 * where the whole Crew can already see them — D-080 keeps an unplaced award
 * the winner's own business, and the recap does not announce one.
 */

/** How the crew week is defined everywhere in this module: Monday through Sunday. */
export const CREW_RECAP_WEEK_DAYS = 7;

/**
 * How long a closed week stays on Today.
 *
 * The recap is a limited-time module, not a permanent one. It appears the
 * Monday after a week closes and ages out after Wednesday, which is long
 * enough for a runner who opens STACK twice a week to see it and short enough
 * that Today is never carrying last week's story into next week's running.
 */
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

/** One block of the slice of the Crew Build this week added, in tower coordinates. */
export interface CrewWeekRecapSliceBlock {
  id: string;
  userId: string;
  accentColor: CrewMemberAccent | null;
  activityType: RunActivityType;
  /** Stamped on the brick face, exactly as the shared tower stamps it. */
  distanceMiles: number;
  /** Issue #129: a hand-logged brick keeps its asterisk in the crop too. */
  source: RunSource | null;
  /** The tower's own footprint for this run, so the slice is the real shape. */
  width: BlockWidth;
  height: BlockHeight;
  /** 1-based, in the tower's own eight columns. */
  columnStart: number;
  /** 0-based within the slice, counted up from the lowest course this week reached. */
  row: number;
}

export interface CrewWeekRecapAward {
  id: string;
  awardType: CrewAwardType;
  resultValue: number;
  winner: CrewWeekRecapRunner | null;
}

/** The week in four figures. Always present: a recap exists only when a run does. */
export interface CrewWeekRecapTotals {
  miles: number;
  runs: number;
  durationSeconds: number;
  /** Members who ran at least once. Never the roster size — that is `participation`. */
  activeRunners: number;
}

export type CrewWeekRecapBeat =
  | {
    kind: "participation";
    /** True only when every current member of the roster ran this week. */
    everyoneRan: boolean;
    activeRunners: number;
    rosterSize: number;
    /** Who ran, in roster order. */
    runners: CrewWeekRecapRunner[];
  }
  | {
    kind: "longestRun";
    runId: string;
    distanceMiles: number;
    activityType: RunActivityType;
    localDate: string;
    runner: CrewWeekRecapRunner;
  }
  | {
    kind: "build";
    /** Blocks from this week standing in the shared tower. */
    blocksPlaced: number;
    milesPlaced: number;
    /** Courses the week's own blocks span, for the slice's height. */
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
    /** This week minus last week. Signed; zero is a real answer. */
    deltaMiles: number;
  };

export interface CrewWeekRecap {
  crewId: string;
  crewName: string;
  weekStart: string;
  weekEnd: string;
  totals: CrewWeekRecapTotals;
  /** The story after the totals, in editorial order. Any beat may be absent. */
  beats: CrewWeekRecapBeat[];
}

export interface CrewWeekRecapInput {
  crewId: string;
  crewName: string;
  /** The Crew's own Build start date; nothing before it is Crew data at all. */
  buildStartDate: string;
  /** The current roster, in the order Crew already shows it. */
  members: readonly CrewMember[];
  /** Crew-eligible shared runs, already windowed by the dashboard read. */
  runs: readonly CrewWeekRecapRun[];
  /** Every award block this Crew has minted; unplaced ones are ignored here. */
  awards?: readonly CrewAwardBlockRecord[];
  week: CrewWeekWindow;
}

/**
 * The narrow projection the recap consumes, taken explicitly rather than by
 * passing `CrewSharedRun` straight through.
 *
 * Heart rate (D-079), Props, the contributing runner's local run id and the
 * runner's personal Build coordinates are all present on a shared run and all
 * absent from a recap. Doing the drop here, in one reviewable function, is
 * what keeps a later beat from quietly reaching for a field the story has no
 * business telling.
 */
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
    crewBuildRow: run.crewBuildRow,
    crewBuildColumnStart: run.crewBuildColumnStart,
  }));
}

/** Monday–Sunday around a date. */
export function crewWeekContaining(localDate: string): CrewWeekWindow {
  const weekStart = mondayOfLocalDate(localDate);
  return { weekStart, weekEnd: addDaysToLocalDate(weekStart, CREW_RECAP_WEEK_DAYS - 1) };
}

/** The most recently completed Monday–Sunday week as of `today`. */
export function lastClosedCrewWeek(today: string): CrewWeekWindow {
  return crewWeekContaining(addDaysToLocalDate(mondayOfLocalDate(today), -1));
}

/**
 * Whether a closed week is still Today's business.
 *
 * The window opens the day after the week ends and closes
 * `CREW_RECAP_TODAY_DAYS` later, so a recap is never on Today while the week
 * it describes is still being run, and never still there when the next one
 * closes.
 */
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

function runnerOf(
  run: CrewWeekRecapRun,
): CrewWeekRecapRunner {
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

function isPlacedInTower(run: CrewWeekRecapRun): boolean {
  return (
    run.crewBuildRow !== null &&
    Number.isInteger(run.crewBuildRow) &&
    run.crewBuildRow >= 0 &&
    run.crewBuildColumnStart !== null &&
    Number.isInteger(run.crewBuildColumnStart) &&
    run.crewBuildColumnStart >= 1 &&
    run.crewBuildColumnStart + crewBuildFootprint(run).width - 1 <= CREW_BUILD_COLUMNS
  );
}

/**
 * The participation beat.
 *
 * `everyoneRan` is the fact worth celebrating, and it is only claimed when it
 * is true of the whole current roster. A solo Crew is excluded: "everyone ran"
 * about one person is a sentence, not an achievement, and the totals already
 * said it.
 */
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

/**
 * The longest single run of the week.
 *
 * Only claimed when one run is actually longest. A tie has no answer that is
 * not a choice between two runners, and the recap celebrates the Crew rather
 * than ranking it, so a tie omits the beat instead of picking.
 */
function longestRunBeat(
  weekRuns: readonly CrewWeekRecapRun[],
): CrewWeekRecapBeat | null {
  let longest: CrewWeekRecapRun | null = null;
  let tied = false;
  for (const run of weekRuns) {
    if (!(run.distanceMiles > 0)) continue;
    if (longest === null || run.distanceMiles > longest.distanceMiles) {
      longest = run;
      tied = false;
    } else if (run.distanceMiles === longest.distanceMiles) {
      tied = true;
    }
  }
  if (!longest || tied) return null;
  return {
    kind: "longestRun",
    runId: longest.id,
    distanceMiles: longest.distanceMiles,
    activityType: longest.activityType,
    localDate: longest.localDate,
    runner: runnerOf(longest),
  };
}

/**
 * The slice of the Crew Build this week added.
 *
 * Membership of the slice is the run's own local date, not when somebody got
 * around to placing it: a Sunday run placed on Tuesday belongs to the week it
 * was run, and that is the answer both members of a Crew compute. Rows are
 * rebased on the lowest course the week reached so the slice draws as its own
 * compact structure rather than as a handful of bricks floating at course 40.
 */
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
      const { width, height } = crewBuildFootprint(run);
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

/**
 * Special Blocks the week produced, and only the ones already standing.
 *
 * D-080 is explicit that a Special Block enters the tower by being placed
 * rather than by being announced, and that Crew shows a winner their own
 * placement prompt and nothing else. A placed award is a different matter: it
 * is a physical part of the shared Build that every member can already open
 * and read. So the recap reports exactly those, which also means both members
 * of a Crew see the same list.
 */
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
    .sort((left, right) => left.awardType.localeCompare(right.awardType) || left.id.localeCompare(right.id))
    .map((award) => ({
      id: award.id,
      awardType: award.awardType,
      resultValue: award.resultValue,
      winner: runnerById.get(award.winnerUserId) ?? null,
    }));
  return placed.length > 0 ? { kind: "specialBlocks", awards: placed } : null;
}

/**
 * Week over week, when the comparison is defensible.
 *
 * Two conditions: the previous week has to be inside the Crew's own Build
 * window, and it has to have running in it. A Crew's first week has nothing
 * to compare against, and comparing against a week the Crew did not exist for
 * would report a rise that never happened.
 */
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

/**
 * The recap for one closed Crew week, or null when there is no week to tell.
 *
 * Null is the honest answer for a week with no shared running in it: a recap
 * of zero miles is not a minimal story, it is a dashboard reporting an empty
 * cell. A week with a single run still returns a recap — the totals, and
 * whichever other beats that one run supports.
 */
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
    longestRunBeat(weekRuns),
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

/** Stable identity for one Crew's one week — what a dismissal remembers. */
export function crewWeekRecapKey(crewId: string, weekStart: string): string {
  return `${crewId}:${weekStart}`;
}

export interface CrewWeekRecapFacedBlock extends CrewWeekRecapSliceBlock {
  /**
   * Visible faces, computed with the same neighbour-aware culling Personal,
   * Crew and Member Build all use, so the week's crop reads as one physical
   * structure rather than a row of flat rectangles.
   */
  topFace: boolean[];
  rightFace: boolean[];
  /** Paint order — see `PlacedBlock.depth` in Personal Build for why. */
  depth: number;
}

export interface CrewWeekRecapTower {
  blocks: CrewWeekRecapFacedBlock[];
  /** Openings the crop spans, drawn so a bridging block is not left floating. */
  voids: GridVoid[];
  courses: number;
}

/**
 * The build beat's 3D geometry, added as a separate step.
 *
 * `crewWeekRecap` stays a statement of facts about a week; this turns the
 * rectangles it reports into the faces a tower is drawn from. Kept apart for
 * the same reason `faceCulledMiniBuildTower` is: the beat's tested shape does
 * not have to grow fields that only one renderer needs, and the facts stay
 * comparable between two members without any drawing in the way.
 */
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
