import { addDaysToLocalDate, parseLocalDate } from "./dates";
import { EVERY_DAY, weekdayOf, type Weekday } from "./runDays";
import type {
  TrainingPlan,
  TrainingWeek,
  Workout,
  WorkoutType,
} from "./types";

/**
 * Building a plan from a race, rather than shipping one.
 *
 * What this is: arithmetic over a template. A distance and an experience level
 * pick how many runs a week, how far the long run starts and finishes, and how
 * long the taper is; the weeks between today and race day decide the rest. It
 * is the shape of every beginner's training plan ever printed in a magazine,
 * and it is deliberately not more than that.
 *
 * What this is not: coaching. Nothing here reads a single run the user has
 * logged. It does not know whether last Tuesday went well, and it will not
 * adapt if it did not. The plan it produces is a starting point that the
 * runner then edits — which is what every screen in this app is built around.
 */
export type RaceDistance = "5k" | "10k" | "half" | "marathon";
export type RunnerLevel = "novice" | "intermediate" | "advanced";

export const RACE_DISTANCE_ORDER: RaceDistance[] = [
  "5k",
  "10k",
  "half",
  "marathon",
];
export const RUNNER_LEVEL_ORDER: RunnerLevel[] = [
  "novice",
  "intermediate",
  "advanced",
];

export const RUNNER_LEVEL_LABEL: Record<RunnerLevel, string> = {
  novice: "Novice",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

/** What each level means here, so the choice is not a guess about oneself. */
export const RUNNER_LEVEL_BLURB: Record<RunnerLevel, string> = {
  novice: "New to the distance. Easy runs and a long run, no speed work.",
  intermediate: "Comfortable with the distance. Adds one faster session a week.",
  advanced: "Racing it. Adds intervals and a race-pace run each week.",
};

interface LevelNumbers {
  runsPerWeek: number;
  startLongMiles: number;
  peakLongMiles: number;
  /**
   * Total miles in the first and the biggest week.
   *
   * Weekly volume is the plan's primary progression, and the long run is a
   * share of it. It used to be the other way round — every run was a fixed
   * fraction of that week's long run, so cutting the long run by a third cut
   * the whole week by a third, and returning to the ramp put the whole week
   * back up by half. The body loads on weekly volume; that is what has to
   * climb gently.
   */
  startWeeklyMiles: number;
  peakWeeklyMiles: number;
  /** Faster sessions a week: 0 easy-only, 1 intervals, 2 intervals plus tempo. */
  quality: number;
}

export interface DistanceProfile {
  label: string;
  miles: number;
  /** Weeks the template wants, and the range it can be stretched or squeezed into. */
  idealWeeks: number;
  minWeeks: number;
  maxWeeks: number;
  /** Weeks of reduced load before race day, the race's own week included. */
  taperWeeks: number;
  levels: Record<RunnerLevel, LevelNumbers>;
}

/**
 * The numbers.
 *
 * These are the conventional ones — a weekly volume that climbs by under ten
 * percent, a long run that grows about a mile at a time, a down week every
 * fourth week, a taper measured in weeks rather than days, and a peak long run
 * short of the race distance for everything except the 5K. They are a
 * template, not a prescription, and the plan they produce is editable
 * everywhere.
 *
 * The weekly figures are sized so the long run stays a conventional share of
 * its week — around 40% for the shorter races, up to half for a novice
 * marathon, which is where the peak twenty-miler lives in every plan of that
 * shape ever printed.
 */
export const DISTANCE_PROFILES: Record<RaceDistance, DistanceProfile> = {
  "5k": {
    label: "5K",
    miles: 3.1,
    idealWeeks: 8,
    minWeeks: 4,
    maxWeeks: 12,
    taperWeeks: 1,
    levels: {
      novice: { runsPerWeek: 3, startLongMiles: 2, peakLongMiles: 4, startWeeklyMiles: 7, peakWeeklyMiles: 11, quality: 0 },
      intermediate: { runsPerWeek: 4, startLongMiles: 3, peakLongMiles: 5, startWeeklyMiles: 11, peakWeeklyMiles: 17, quality: 1 },
      advanced: { runsPerWeek: 5, startLongMiles: 4, peakLongMiles: 6, startWeeklyMiles: 15, peakWeeklyMiles: 24, quality: 2 },
    },
  },
  "10k": {
    label: "10K",
    miles: 6.2,
    idealWeeks: 10,
    minWeeks: 5,
    maxWeeks: 14,
    taperWeeks: 1,
    levels: {
      novice: { runsPerWeek: 3, startLongMiles: 3, peakLongMiles: 6, startWeeklyMiles: 9, peakWeeklyMiles: 15, quality: 0 },
      intermediate: { runsPerWeek: 4, startLongMiles: 4, peakLongMiles: 7, startWeeklyMiles: 14, peakWeeklyMiles: 22, quality: 1 },
      advanced: { runsPerWeek: 5, startLongMiles: 5, peakLongMiles: 8, startWeeklyMiles: 19, peakWeeklyMiles: 30, quality: 2 },
    },
  },
  half: {
    label: "Half Marathon",
    miles: 13.1,
    idealWeeks: 14,
    minWeeks: 8,
    maxWeeks: 20,
    taperWeeks: 2,
    levels: {
      novice: { runsPerWeek: 4, startLongMiles: 3, peakLongMiles: 11, startWeeklyMiles: 12, peakWeeklyMiles: 25, quality: 0 },
      intermediate: { runsPerWeek: 5, startLongMiles: 5, peakLongMiles: 12, startWeeklyMiles: 18, peakWeeklyMiles: 34, quality: 1 },
      advanced: { runsPerWeek: 5, startLongMiles: 6, peakLongMiles: 14, startWeeklyMiles: 22, peakWeeklyMiles: 40, quality: 2 },
    },
  },
  marathon: {
    label: "Marathon",
    miles: 26.2,
    idealWeeks: 18,
    minWeeks: 12,
    maxWeeks: 24,
    taperWeeks: 3,
    levels: {
      novice: { runsPerWeek: 4, startLongMiles: 6, peakLongMiles: 20, startWeeklyMiles: 16, peakWeeklyMiles: 40, quality: 0 },
      intermediate: { runsPerWeek: 5, startLongMiles: 8, peakLongMiles: 20, startWeeklyMiles: 22, peakWeeklyMiles: 50, quality: 1 },
      advanced: { runsPerWeek: 6, startLongMiles: 10, peakLongMiles: 22, startWeeklyMiles: 30, peakWeeklyMiles: 64, quality: 2 },
    },
  },
};

export interface RacePlanSetup {
  name: string;
  date: string;
  distance: RaceDistance;
  level: RunnerLevel;
  /**
   * The day training begins, chosen by the runner.
   *
   * Absent means "work it out from the race", which is what every plan built
   * before this field existed did. A stored setup without one therefore keeps
   * behaving exactly as it did, which is why this needed no migration.
   */
  startDate?: string;
}

/** How many of each kind of hard session a plan asks for. */
export interface QualityCount {
  intervals: number;
  simulation: number;
}

export function countQualitySessions(plan: TrainingPlan): QualityCount {
  let intervals = 0;
  let simulation = 0;
  for (const week of plan.weeks) {
    for (const workout of week.workouts) {
      if (workout.type === "intervals") intervals += 1;
      if (workout.type === "simulation") simulation += 1;
    }
  }
  return { intervals, simulation };
}

/** The middle value of how many runs a week the plan asks for. */
function typicalRunsPerWeek(plan: TrainingPlan): number {
  const counts = plan.weeks
    // Race week is two shakeouts and a race at every level, so it says nothing.
    .filter((week) => !week.workouts.some((workout) => workout.type === "race"))
    .map((week) => week.workouts.filter((workout) => workout.type !== "rest").length)
    .sort((a, b) => a - b);
  return counts.length ? counts[Math.floor(counts.length / 2)] : 0;
}

/**
 * The level a plan is already written at, read off the plan itself.
 *
 * The Race sheet used to open on Novice whenever there was no saved setup —
 * which is exactly the state the plan STACK ships with is in. That plan has
 * fifteen interval sessions and four race-pace runs in it, and a novice plan
 * has none, so pressing Rebuild for any reason at all quietly replaced every
 * one of them with an easy run. Defaulting to Novice was never neutral: it
 * asserted something about the runner. The plan in front of us is evidence.
 *
 * **How often you run counts for ten times what you run.** The shipped plan
 * runs four days a week and has speed work in it, which is a combination none
 * of the three levels expresses; reading it as Advanced because of the speed
 * work would hand the runner a plan with sixty percent more mileage in its
 * biggest week. Volume is the thing that injures people and frequency is the
 * honest proxy for it, so frequency decides and the quality content only
 * breaks ties. Where that costs the plan its hard sessions, the sheet says so
 * rather than letting it happen quietly.
 */
export function inferRunnerLevel(
  plan: TrainingPlan,
  distance: RaceDistance,
): RunnerLevel {
  const runs = typicalRunsPerWeek(plan);
  const { intervals, simulation } = countQualitySessions(plan);
  const quality = simulation > 0 ? 2 : intervals > 0 ? 1 : 0;

  let best: RunnerLevel = "novice";
  let bestScore = Number.POSITIVE_INFINITY;
  for (const level of RUNNER_LEVEL_ORDER) {
    const numbers = DISTANCE_PROFILES[distance].levels[level];
    const score =
      Math.abs(runs - numbers.runsPerWeek) * 10 +
      Math.abs(quality - numbers.quality);
    // Strictly less, so a tie keeps the earlier — and gentler — level.
    if (score < bestScore) {
      bestScore = score;
      best = level;
    }
  }
  return best;
}

export class RacePlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RacePlanError";
  }
}

const MILE = 0.5;

function roundMiles(miles: number): number {
  return Math.max(MILE, Math.round(miles / MILE) * MILE);
}

function milesLabel(miles: number): string {
  return Number.isInteger(miles) ? String(miles) : miles.toFixed(1);
}

/** The Monday on or before a date. Training weeks run Monday to Sunday. */
export function mondayOf(date: string): string {
  const weekday = weekdayOf(date);
  // Sunday is the seventh day of its week here, not the first of the next.
  const back = weekday === 0 ? 6 : weekday - 1;
  return addDaysToLocalDate(date, -back);
}

/**
 * How many training weeks there are between today and race day, counting the
 * week that holds each. Zero or less means the race has been and gone.
 */
export function weeksAvailable(today: string, raceDate: string): number {
  const first = parseLocalDate(mondayOf(today)).getTime();
  const last = parseLocalDate(mondayOf(raceDate)).getTime();
  const week = 7 * 24 * 60 * 60 * 1000;
  return Math.round((last - first) / week) + 1;
}

/**
 * The weeks a plan will actually have.
 *
 * A chosen start date is taken at its word: the runner said when training
 * begins, and the weeks between that and race day are the plan. Without one it
 * is what is available from today, within the template's range.
 */
export function plannedWeeks(
  distance: RaceDistance,
  today: string,
  raceDate: string,
  startDate?: string,
): number {
  if (startDate) {
    return Math.max(1, weeksAvailable(startDate, raceDate));
  }
  const profile = DISTANCE_PROFILES[distance];
  const available = weeksAvailable(today, raceDate);
  return Math.max(1, Math.min(available, profile.maxWeeks));
}

/**
 * The Monday the plan begins on.
 *
 * A chosen date is snapped back to its Monday, because training weeks run
 * Monday to Sunday and a plan that began on a Wednesday would have a first
 * week that was not a week.
 *
 * Without a chosen date this is derived, and not necessarily this week: a race
 * further out than the template stretches starts later, because a 10K eight
 * months away does not want an eight-month 10K plan. The screen that offers
 * this has to say so.
 */
export function planStartDate(
  distance: RaceDistance,
  today: string,
  raceDate: string,
  startDate?: string,
): string {
  if (startDate) {
    return mondayOf(startDate);
  }
  const weeks = plannedWeeks(distance, today, raceDate);
  return addDaysToLocalDate(mondayOf(raceDate), -7 * (weeks - 1));
}

/**
 * The long run for each week, in miles.
 *
 * It grows from the level's starting distance to its peak across the build
 * weeks, drops by about a third every fourth week so the body gets a chance to
 * absorb the work, and comes down through the taper. The peak always lands on
 * the last week before the taper, whatever the arithmetic in between.
 */
export function taperWeeksFor(distance: RaceDistance, weeks: number): number {
  // A plan shorter than the taper is all taper. There is no build phase to cut
  // into, and pretending otherwise would schedule a peak the week of the race.
  return Math.min(DISTANCE_PROFILES[distance].taperWeeks, weeks);
}

/**
 * Weekly volume may never exceed the biggest week so far by more than a tenth.
 *
 * This is the ten percent rule, stated the way it actually protects anybody:
 * against the biggest week the runner has already done, not against last week.
 * A down week is meant to be a step back, so measuring the rebound off it says
 * nothing; what matters is that the week you come back to is barely more than
 * the week you had already proved you could handle.
 */
const MAX_WEEKLY_STEP = 1.1;

/**
 * How much a long run may grow in one step.
 *
 * A percentage is the wrong model here. Long runs go up about a mile at a
 * time, which is a third of the way up from three miles and a twentieth of the
 * way up from twenty. These are ceilings that do not bind on a full-length
 * plan; they exist to stop a squeezed one demanding a jump nobody has earned.
 */
const MAX_LONG_RUN_STEP: Record<RaceDistance, number> = {
  "5k": 1,
  "10k": 1,
  half: 1.5,
  marathon: 2,
};

/** A down week eases the whole week off. */
const DOWN_WEEK_FACTOR = 0.8;
/** A down week eases the long run off harder — that is what it is there for. */
const DOWN_WEEK_LONG_FACTOR = 0.7;
/** Below this an easy run is not a run. */
const MIN_EASY_MILES = 2;

/**
 * Every fourth week is a down week, except the last week of the build: the
 * peak belongs there, and a plan that recovered into its taper would have
 * wasted the fortnight before it.
 */
function isDownWeek(index: number, buildWeeks: number): boolean {
  return (index + 1) % 4 === 0 && index !== buildWeeks - 1;
}

/** Which of a build's weeks actually climb, as opposed to stepping back. */
function climbingWeeks(buildWeeks: number): number {
  let count = 0;
  for (let index = 0; index < buildWeeks; index += 1) {
    if (!isDownWeek(index, buildWeeks)) count += 1;
  }
  return count;
}

/**
 * A geometric climb from start to peak, never steeper than `maxStep` per rung.
 *
 * Geometric rather than linear because a constant *percentage* is what the
 * rule is about, and because it is self-limiting: when the plan is too short
 * to reach the peak safely the climb simply stops short of it, which is the
 * honest answer and the safe direction to fail in.
 */
function climb(start: number, peak: number, rungs: number, maxStep: number): number[] {
  if (rungs <= 1) return [start];
  const ideal = (peak / start) ** (1 / (rungs - 1));
  const step = Math.min(ideal, maxStep);
  return Array.from({ length: rungs }, (_, index) =>
    Math.min(peak, start * step ** index),
  );
}

/** The same climb, but limited by miles added per rung rather than by percent. */
function climbBy(start: number, peak: number, rungs: number, maxAdded: number): number[] {
  if (rungs <= 1) return [start];
  const added = Math.min((peak - start) / (rungs - 1), maxAdded);
  return Array.from({ length: rungs }, (_, index) =>
    Math.min(peak, start + added * index),
  );
}

/**
 * Total miles for each week of the plan.
 *
 * This is the progression the body actually feels, so it is the one that is
 * governed: a climb capped at ten percent a rung, a down week at four fifths
 * of the week before it, and a taper measured off the biggest week the plan
 * reached rather than off the template's ambition. Race week is zero — the
 * race sizes itself.
 */
export function weeklyMileageLadder(
  distance: RaceDistance,
  level: RunnerLevel,
  weeks: number,
): number[] {
  const { startWeeklyMiles, peakWeeklyMiles } = DISTANCE_PROFILES[distance].levels[level];
  const taper = taperWeeksFor(distance, weeks);
  const build = weeks - taper;

  const rungs = climb(
    startWeeklyMiles,
    peakWeeklyMiles,
    Math.max(1, climbingWeeks(build)),
    MAX_WEEKLY_STEP,
  );

  const ladder: number[] = [];
  let rung = 0;
  for (let index = 0; index < build; index += 1) {
    if (isDownWeek(index, build)) {
      // Off the week just done, never off the rung ahead: a down week is a
      // step back from real work, not a discount on work not yet earned.
      ladder.push(roundMiles((ladder[index - 1] ?? startWeeklyMiles) * DOWN_WEEK_FACTOR));
    } else {
      ladder.push(roundMiles(rungs[rung] ?? startWeeklyMiles));
      rung += 1;
    }
  }

  const peak = ladder.length ? Math.max(...ladder) : startWeeklyMiles;
  const taperFactors = [0.75, 0.55, 0.4];
  for (let index = 0; index < taper - 1; index += 1) {
    ladder.push(roundMiles(peak * (taperFactors[index] ?? 0.4)));
  }
  if (taper >= 1) ladder.push(0);

  return ladder;
}

export function longRunLadder(
  distance: RaceDistance,
  level: RunnerLevel,
  weeks: number,
): number[] {
  const profile = DISTANCE_PROFILES[distance];
  const { startLongMiles, peakLongMiles } = profile.levels[level];
  const taper = taperWeeksFor(distance, weeks);
  const build = weeks - taper;

  const rungs = climbBy(
    startLongMiles,
    peakLongMiles,
    Math.max(1, climbingWeeks(build)),
    MAX_LONG_RUN_STEP[distance],
  );

  const ladder: number[] = [];
  let rung = 0;
  for (let index = 0; index < build; index += 1) {
    if (isDownWeek(index, build)) {
      ladder.push(roundMiles((ladder[index - 1] ?? startLongMiles) * DOWN_WEEK_LONG_FACTOR));
    } else {
      ladder.push(roundMiles(rungs[rung] ?? startLongMiles));
      rung += 1;
    }
  }

  // Down through the taper, the last of which is race week and has no long
  // run. Measured off the longest run the plan actually reached, because a
  // squeezed plan never got near the template's peak and tapering from a
  // number it never touched would put the hardest run in the taper.
  const reached = ladder.length ? Math.max(...ladder) : startLongMiles;
  const taperFactors = [0.7, 0.5, 0.35];
  for (let index = 0; index < taper - 1; index += 1) {
    ladder.push(roundMiles(reached * (taperFactors[index] ?? 0.35)));
  }
  ladder.push(0);

  return ladder;
}

/**
 * Which weekdays a week's runs land on.
 *
 * Spread as evenly as the permitted days allow, first and last included, so
 * the long run sits at the end of the week and the rest are not bunched. Fewer
 * permitted days than runs means every permitted day is used and the week is
 * short — the caller decides whether that is worth saying.
 */
export function spreadDays(allowed: readonly Weekday[], runs: number): Weekday[] {
  const days = [...allowed];
  if (runs >= days.length) {
    return days;
  }
  if (runs <= 1) {
    return days.slice(-1);
  }
  const chosen: Weekday[] = [];
  for (let index = 0; index < runs; index += 1) {
    const at = Math.round((index * (days.length - 1)) / (runs - 1));
    const day = days[at];
    if (!chosen.includes(day)) {
      chosen.push(day);
    }
  }
  // Rounding can collide; fill from the unused days, latest first.
  for (const day of [...days].reverse()) {
    if (chosen.length >= runs) break;
    if (!chosen.includes(day)) chosen.push(day);
  }
  return chosen.sort((a, b) => orderOf(a) - orderOf(b));
}

function orderOf(day: Weekday): number {
  return day === 0 ? 7 : day;
}

function phaseFor(week: number, weeks: number, taper: number, cutback: boolean): string {
  const build = weeks - taper;
  if (week > build) {
    return week === weeks ? "Race Week" : "Taper";
  }
  const base = week <= Math.ceil(build / 3) ? "Foundation" : week <= Math.ceil((build * 2) / 3) ? "Build" : "Peak";
  return cutback ? `${base} Cutback` : base;
}

interface PlannedRun {
  type: WorkoutType;
  miles: number;
  title: string;
  details: string;
}

function restWorkout(): PlannedRun {
  return {
    type: "rest",
    miles: 0,
    title: "Rest",
    details: "No scheduled run.",
  };
}

/** What a repeat is, per race distance, and what it is run at. */
const REP: Record<
  RaceDistance,
  { miles: number; label: string; effort: string; recovery: string }
> = {
  "5k": { miles: 0.25, label: "400 m", effort: "5K effort", recovery: "90 seconds" },
  "10k": { miles: 0.5, label: "800 m", effort: "5K effort", recovery: "2 minutes" },
  half: { miles: 0.75, label: "1200 m", effort: "10K effort", recovery: "2 minutes" },
  marathon: { miles: 1, label: "1 mile", effort: "half-marathon effort", recovery: "3 minutes" },
};

/**
 * An interval session with intervals in it.
 *
 * The old text said "repeats at a hard but controlled effort" and left the
 * runner to invent the count, the length and the recovery — which is the part
 * of the session that is actually a decision. The seed plan this app shipped
 * with has always said "4 × 30 seconds hard with 60 seconds rest"; a generated
 * one has no excuse to say less.
 */
function intervalSession(miles: number, distance: RaceDistance): PlannedRun {
  const rep = REP[distance];
  const warmup = miles >= 5 ? 1 : 0.5;
  const forReps = Math.max(rep.miles, miles - warmup * 2);
  const reps = Math.min(8, Math.max(4, Math.round(forReps / rep.miles)));
  const warmupLabel = warmup === 1 ? "1 mile" : "half a mile";
  return {
    type: "intervals",
    miles,
    title: `Intervals: ${milesLabel(miles)} Miles`,
    details:
      `${warmupLabel} easy to warm up, then ${reps} × ${rep.label} at ${rep.effort} ` +
      `with ${rep.recovery} of easy jogging between, then ${warmupLabel} easy to cool down.`,
  };
}

function racePaceSession(miles: number, label: string): PlannedRun {
  const warmup = miles >= 6 ? 2 : 1;
  const atPace = roundMiles(Math.max(1, miles - warmup - 1));
  return {
    type: "simulation",
    miles,
    title: `Race Pace: ${milesLabel(miles)} Miles`,
    details:
      `${milesLabel(warmup)} ${warmup === 1 ? "mile" : "miles"} easy, then ` +
      `${milesLabel(atPace)} at goal ${label.toLowerCase()} pace, then 1 mile easy. ` +
      `Steady at the effort you intend to race at, not a time trial.`,
  };
}

/**
 * How the week's easy miles are shared out.
 *
 * Not equally. Every easy run in a week used to be the same distance, which is
 * not how anybody trains and made the schedule read as one repeated row. These
 * descend: a longer mid-week run first, a short one last, so the day before
 * the long run is the gentlest of them.
 */
const EASY_SHARES: Record<number, number[]> = {
  1: [1],
  2: [1.15, 0.85],
  3: [1.2, 1, 0.8],
  4: [1.2, 1.05, 0.95, 0.8],
  5: [1.2, 1.1, 1, 0.9, 0.8],
};

function easyRun(miles: number, isShortest: boolean): PlannedRun {
  return {
    type: "easy",
    miles,
    title: `${milesLabel(miles)} Miles`,
    details: isShortest
      ? "Easy and short. This one is for the legs, not the lungs."
      : "Easy conversational effort.",
  };
}

/**
 * The runs a single week asks for, **already in the order they will be run**.
 *
 * Two things this owes the runner. The week's miles are budgeted from the
 * weekly ladder — long run first, then the quality sessions, then whatever is
 * left shared out across the easy days — rather than every run being a
 * fraction of the long run. And the hard days are spaced: the two quality
 * sessions of an advanced week land with a day between them, never back to
 * back, and neither of them lands the day before the long run.
 */
function runsForWeek(
  weeklyMiles: number,
  longMiles: number,
  runs: number,
  quality: number,
  distance: RaceDistance,
  /** The most this week may total, given the biggest week already scheduled. */
  cap = Number.POSITIVE_INFINITY,
): PlannedRun[] {
  const hasLong = longMiles > 0;
  const slots = Math.max(1, runs - (hasLong ? 1 : 0));
  const qualityCount = Math.min(quality, Math.max(0, slots));
  const hardSlots = qualitySlots(qualityCount, slots);

  const sessions: PlannedRun[] = [];
  if (qualityCount >= 1) {
    const miles = roundMiles(
      Math.max(3, Math.min(weeklyMiles * 0.15, longMiles * 0.6 || weeklyMiles * 0.15)),
    );
    sessions.push(intervalSession(Math.min(miles, hasLong ? longMiles : miles), distance));
  }
  if (qualityCount >= 2) {
    const miles = roundMiles(
      Math.max(3, Math.min(weeklyMiles * 0.22, longMiles * 0.8 || weeklyMiles * 0.22)),
    );
    sessions.push(
      racePaceSession(
        Math.min(miles, hasLong ? longMiles : miles),
        DISTANCE_PROFILES[distance].label,
      ),
    );
  }

  const easyCount = slots - qualityCount;
  const spent = longMiles + sessions.reduce((total, run) => total + run.miles, 0);
  const shares = EASY_SHARES[easyCount] ?? Array.from({ length: easyCount }, () => 1);
  const shareTotal = shares.reduce((total, share) => total + share, 0) || 1;
  const budget = Math.max(0, weeklyMiles - spent);
  const easyMiles = shares.map((share) =>
    roundMiles(
      Math.min(
        // An easy run never outgrows the long run: that would make it the
        // long run, and the week would have two.
        hasLong ? longMiles : Number.POSITIVE_INFINITY,
        Math.max(MIN_EASY_MILES, (budget * share) / shareTotal),
      ),
    ),
  );

  /**
   * The ladder is capped, but every run is then rounded to the half mile, and
   * on a small week three of those roundings can add a tenth to the total on
   * their own. So the cap is enforced here, on the miles that will actually be
   * scheduled: shave half a mile at a time off the longest easy run that can
   * spare it. The long run and the quality sessions are never trimmed — they
   * are the point of the week, and the easy miles are what is negotiable.
   */
  let total = spent + easyMiles.reduce((sum, miles) => sum + miles, 0);
  while (total > cap) {
    let longest = -1;
    for (let at = 0; at < easyMiles.length; at += 1) {
      if (easyMiles[at] > MIN_EASY_MILES && (longest < 0 || easyMiles[at] > easyMiles[longest])) {
        longest = at;
      }
    }
    if (longest < 0) break;
    easyMiles[longest] = roundMiles(easyMiles[longest] - 0.5);
    total -= 0.5;
  }

  const week: (PlannedRun | undefined)[] = new Array(slots);
  hardSlots.forEach((slot, at) => {
    week[slot] = sessions[at];
  });
  let easyAt = 0;
  for (let slot = 0; slot < slots; slot += 1) {
    if (week[slot]) continue;
    const miles = easyMiles[easyAt] ?? MIN_EASY_MILES;
    week[slot] = easyRun(miles, easyAt === easyCount - 1 && easyCount > 1);
    easyAt += 1;
  }

  const ordered = week.filter((run): run is PlannedRun => run !== undefined);
  if (hasLong) {
    ordered.push({
      type: "long",
      miles: longMiles,
      title: `Long Run: ${milesLabel(longMiles)} Miles`,
      details: "Slow and steady. Time on feet matters more than pace.",
    });
  }
  return ordered.slice(0, Math.max(1, runs));
}

/**
 * Which of the week's non-long slots the hard sessions take.
 *
 * A day apart, and never the slot immediately before the long run. A six-run
 * week runs Mon Tue Wed Fri Sat Sun, and the old ordering — quality sessions
 * first, days assigned in order — put intervals on Monday and race pace on
 * Tuesday for twenty-one weeks of an advanced marathon block.
 */
function qualitySlots(quality: number, slots: number): number[] {
  if (quality <= 0 || slots <= 0) return [];
  if (quality === 1) return [0];
  return slots >= 3 ? [0, 2] : [0, Math.max(1, slots - 1)];
}

/**
 * The most a week may total, given the biggest week already scheduled.
 *
 * Ten percent, or two miles, whichever is more. The percentage is the rule
 * everybody knows; the two miles is because a percentage of a six-mile week is
 * a rule about nothing — it would forbid adding a mile and a half to a load
 * that is not yet a load, and force the first month of a beginner's plan to
 * crawl for no reason anybody could feel.
 */
function weeklyCap(biggestSoFar: number): number {
  if (biggestSoFar <= 0) return Number.POSITIVE_INFINITY;
  return Math.max(biggestSoFar * MAX_WEEKLY_STEP, biggestSoFar + 2);
}

/**
 * Up to two shakeout days in race week, taken only from days before the race.
 *
 * Spread so the last one is not the day before the race itself: with a
 * Saturday race and every day permitted that gives Monday and Thursday, and
 * Friday off.
 */
function shakeoutDates(
  monday: string,
  raceDate: string,
  allowed: readonly Weekday[],
): string[] {
  const before: string[] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const date = addDaysToLocalDate(monday, offset);
    if (date < raceDate && allowed.includes(weekdayOf(date))) before.push(date);
  }
  if (before.length <= 2) return before;
  return [before[0], before[before.length - 2]];
}

/**
 * Builds a whole plan from a race and a runner.
 *
 * Every date the plan covers holds exactly one workout — a run or a rest — so
 * the plan editing, moving, and run-day reshaping already in the app work on a
 * generated plan exactly as they do on the seeded one.
 */
export function generateTrainingPlan(
  setup: RacePlanSetup,
  options: { today: string; runDays?: readonly Weekday[] },
): TrainingPlan {
  const profile = DISTANCE_PROFILES[setup.distance];
  if (weeksAvailable(options.today, setup.date) < 1) {
    throw new RacePlanError("That race date has already passed.");
  }
  if (setup.startDate && mondayOf(setup.startDate) > mondayOf(setup.date)) {
    throw new RacePlanError("Training cannot start after race week.");
  }
  const weeks = plannedWeeks(
    setup.distance,
    options.today,
    setup.date,
    setup.startDate,
  );

  const allowed = [...(options.runDays?.length ? options.runDays : EVERY_DAY)].sort(
    (a, b) => orderOf(a) - orderOf(b),
  );
  const ladder = longRunLadder(setup.distance, setup.level, weeks);
  const weekly = weeklyMileageLadder(setup.distance, setup.level, weeks);
  const taper = taperWeeksFor(setup.distance, weeks);
  const levelNumbers = profile.levels[setup.level];

  const firstMonday = planStartDate(
    setup.distance,
    options.today,
    setup.date,
    setup.startDate,
  );

  // A workout relationship belongs to one plan instance, not merely to its
  // ordinal slot. Two generated race plans can cover the same dates and both
  // contain a "second workout"; unique plan-scoped ids prevent a stale link
  // from the first plan from completing the second one after a partial sync.
  const instanceId = globalThis.crypto.randomUUID();
  const planId = `plan-${setup.distance}-${setup.date}-${instanceId}`;
  let sequence = 0;
  const nextId = () =>
    `${planId}-workout-${String(++sequence).padStart(3, "0")}`;

  // The biggest week scheduled so far, which is what the next one is measured
  // against. Nothing is compared to *last* week: a down week is a step back on
  // purpose, and coming back off one is not an increase in load.
  let biggestWeek = 0;
  const trainingWeeks: TrainingWeek[] = [];
  for (let index = 0; index < weeks; index += 1) {
    const weekNumber = index + 1;
    const monday = addDaysToLocalDate(firstMonday, index * 7);
    const isRaceWeek = weekNumber === weeks;
    const longMiles = ladder[index] ?? 0;
    const isCutback =
      index > 0 && longMiles > 0 && longMiles < (ladder[index - 1] ?? 0);
    const phase = phaseFor(weekNumber, weeks, taper, isCutback && weekNumber <= weeks - taper);

    /**
     * A taper cuts distance, not frequency. Dropping a run and keeping three
     * quarters of the volume concentrates what is left — the taper weeks used
     * to schedule easy runs longer than any in the block they were resting
     * from. The legs want the same rhythm and less of it.
     */
    const runCount = levelNumbers.runsPerWeek;
    const quality = weekNumber > weeks - taper ? 0 : levelNumbers.quality;

    /**
     * Race week is shakeouts and the race, and the shakeouts are chosen from
     * the days that actually come *before* race day. Choosing weekdays and
     * then deleting whatever fell after the race silently cost the second
     * shakeout on every race that was not a Sunday.
     */
    const byWeekday = new Map<Weekday, PlannedRun>();
    if (isRaceWeek) {
      for (const date of shakeoutDates(monday, setup.date, allowed)) {
        byWeekday.set(weekdayOf(date), {
          type: "easy",
          miles: 2,
          title: "2 Miles",
          details: "Easy shakeout. Keep the legs turning over.",
        });
      }
    } else {
      const planned = runsForWeek(
        weekly[index] ?? 0,
        longMiles,
        runCount,
        quality,
        setup.distance,
        weeklyCap(biggestWeek),
      );
      biggestWeek = Math.max(
        biggestWeek,
        planned.reduce((total, run) => total + run.miles, 0),
      );
      // `planned` is already in the order it will be run, so the nth run of
      // the week takes the nth permitted day.
      spreadDays(allowed, planned.length).forEach((day, at) => {
        const run = planned[at];
        if (run) byWeekday.set(day, run);
      });
    }

    const workouts: Workout[] = [];
    let orderInWeek = 0;
    for (let offset = 0; offset < 7; offset += 1) {
      const date = addDaysToLocalDate(monday, offset);
      const weekday = weekdayOf(date);

      let run: PlannedRun;
      if (isRaceWeek && date === setup.date) {
        run = {
          type: "race",
          miles: profile.miles,
          title: setup.name,
          details: `Race day. ${profile.label}.`,
        };
      } else if (isRaceWeek && date > setup.date) {
        // Nothing is scheduled after the race.
        run = restWorkout();
      } else {
        run = byWeekday.get(weekday) ?? restWorkout();
      }

      const renders = run.type !== "rest";
      if (renders) orderInWeek += 1;

      workouts.push({
        id: nextId(),
        date,
        weekNumber,
        phase,
        type: run.type,
        title: run.title,
        targetDistanceMiles: renders ? milesLabel(run.miles) : null,
        details: run.details,
        build: {
          renders,
          weekRow: weekNumber,
          orderInWeek: renders ? orderInWeek : null,
          span: renders ? spanFor(run.miles) : 0,
          colorKey: renders ? (run.type as "easy") : "neutral",
        },
      });
    }

    trainingWeeks.push({
      weekNumber,
      phase,
      startDate: monday,
      endDate: workouts[workouts.length - 1].date,
      workouts,
    });
  }

  return {
    schemaVersion: 1,
    id: planId,
    name: `${setup.name} — ${RUNNER_LEVEL_LABEL[setup.level]} ${profile.label}`,
    race: {
      name: setup.name,
      date: setup.date,
      distanceMiles: profile.miles,
    },
    startDate: trainingWeeks[0].startDate,
    endDate: trainingWeeks[trainingWeeks.length - 1].endDate,
    weeks: trainingWeeks,
    notes: [
      `${weeks}-week ${profile.label.toLowerCase()} plan for a ${RUNNER_LEVEL_LABEL[setup.level].toLowerCase()} runner.`,
      "Generated from the race date and edited by hand from there. It is not an adaptive coaching engine and never reads your logged runs.",
    ],
  };
}

/**
 * Re-attaches recorded runs to a freshly generated plan.
 *
 * A run that happened, happened. The plan it was once attached to may no
 * longer exist, but the miles are real and the block it earned is already
 * built, so nothing here ever discards one.
 *
 * A run is re-linked to whatever the new plan schedules **on the same date**,
 * which is what keeps a week that was genuinely completed looking completed.
 * A run with nothing scheduled that day becomes an extra run: honest, still
 * counted in the miles, still holding its block, and no longer claiming to
 * satisfy a workout that is not there. Two runs on one date cannot both
 * satisfy it, so the earlier keeps the link.
 */
export function relinkRunLogs<T extends { id: string; workoutId: string | null; completedDate: string; createdAt: string }>(
  runLogs: readonly T[],
  plan: TrainingPlan,
): { runLogs: T[]; linked: number; unlinked: number } {
  const scheduled = new Map<string, string>();
  for (const week of plan.weeks) {
    for (const workout of week.workouts) {
      if (workout.type !== "rest") {
        scheduled.set(workout.date, workout.id);
      }
    }
  }

  const taken = new Set<string>();
  let linked = 0;
  let unlinked = 0;

  const relinked = [...runLogs]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((runLog) => {
      const workoutId = scheduled.get(runLog.completedDate) ?? null;
      const next = workoutId && !taken.has(workoutId) ? workoutId : null;
      if (next) {
        taken.add(next);
        linked += 1;
      } else if (runLog.workoutId) {
        unlinked += 1;
      }
      return next === runLog.workoutId ? runLog : { ...runLog, workoutId: next };
    });

  return { runLogs: relinked, linked, unlinked };
}

/** Legacy width hint on the workout. Block geometry itself comes from the run. */
function spanFor(miles: number): 0 | 1 | 2 | 3 | 4 {
  if (miles < 3) return 1;
  if (miles < 5) return 2;
  if (miles < 8) return 3;
  return 4;
}
