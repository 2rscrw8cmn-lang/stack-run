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
 * These are the conventional ones — a long run that grows about ten percent a
 * week, a cutback every fourth week, a taper measured in weeks rather than
 * days, and a peak long run short of the race distance for everything except
 * the 5K. They are a template, not a prescription, and the plan they produce
 * is editable everywhere.
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
      novice: { runsPerWeek: 3, startLongMiles: 2, peakLongMiles: 4, quality: 0 },
      intermediate: { runsPerWeek: 4, startLongMiles: 3, peakLongMiles: 5, quality: 1 },
      advanced: { runsPerWeek: 5, startLongMiles: 4, peakLongMiles: 6, quality: 2 },
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
      novice: { runsPerWeek: 3, startLongMiles: 3, peakLongMiles: 6, quality: 0 },
      intermediate: { runsPerWeek: 4, startLongMiles: 4, peakLongMiles: 7, quality: 1 },
      advanced: { runsPerWeek: 5, startLongMiles: 5, peakLongMiles: 8, quality: 2 },
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
      novice: { runsPerWeek: 4, startLongMiles: 3, peakLongMiles: 11, quality: 0 },
      intermediate: { runsPerWeek: 5, startLongMiles: 5, peakLongMiles: 12, quality: 1 },
      advanced: { runsPerWeek: 5, startLongMiles: 6, peakLongMiles: 14, quality: 2 },
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
      novice: { runsPerWeek: 4, startLongMiles: 6, peakLongMiles: 20, quality: 0 },
      intermediate: { runsPerWeek: 5, startLongMiles: 8, peakLongMiles: 20, quality: 1 },
      advanced: { runsPerWeek: 6, startLongMiles: 10, peakLongMiles: 22, quality: 2 },
    },
  },
};

export interface RacePlanSetup {
  name: string;
  date: string;
  distance: RaceDistance;
  level: RunnerLevel;
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

/** The weeks a plan will actually have: what is available, within the template's range. */
export function plannedWeeks(
  distance: RaceDistance,
  today: string,
  raceDate: string,
): number {
  const profile = DISTANCE_PROFILES[distance];
  const available = weeksAvailable(today, raceDate);
  return Math.max(1, Math.min(available, profile.maxWeeks));
}

/**
 * The Monday the plan begins on.
 *
 * Not necessarily this week: a race further out than the template stretches
 * starts later, because a 10K eight months away does not want an eight-month
 * 10K plan. The screen that offers this has to say so.
 */
export function planStartDate(
  distance: RaceDistance,
  today: string,
  raceDate: string,
): string {
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

export function longRunLadder(
  distance: RaceDistance,
  level: RunnerLevel,
  weeks: number,
): number[] {
  const profile = DISTANCE_PROFILES[distance];
  const { startLongMiles, peakLongMiles } = profile.levels[level];
  const taper = taperWeeksFor(distance, weeks);
  const build = weeks - taper;

  const ladder: number[] = [];
  for (let index = 0; index < build; index += 1) {
    const progress = build === 1 ? 1 : index / (build - 1);
    const target = startLongMiles + (peakLongMiles - startLongMiles) * progress;
    const isLast = index === build - 1;
    const isCutback = !isLast && (index + 1) % 4 === 0;
    ladder.push(roundMiles(isCutback ? target * 0.7 : target));
  }

  // Down through the taper, the last of which is race week and has no long run.
  const taperFactors = [0.7, 0.5, 0.35];
  for (let index = 0; index < taper - 1; index += 1) {
    ladder.push(roundMiles(peakLongMiles * (taperFactors[index] ?? 0.35)));
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

/**
 * The runs a single week asks for, hardest session first so that assigning
 * them to days puts the long run last and the quality work mid-week.
 */
function runsForWeek(
  longMiles: number,
  runs: number,
  quality: number,
): PlannedRun[] {
  const easyMiles = roundMiles(Math.max(2, longMiles * 0.4));
  const week: PlannedRun[] = [];

  if (quality >= 1) {
    const miles = roundMiles(Math.max(2, longMiles * 0.4));
    week.push({
      type: "intervals",
      miles,
      title: `Intervals: ${milesLabel(miles)} Miles`,
      details:
        "Warm up, then repeats at a hard but controlled effort with easy jogging between. Cool down.",
    });
  }
  if (quality >= 2) {
    const miles = roundMiles(Math.max(2, longMiles * 0.5));
    week.push({
      type: "simulation",
      miles,
      title: `Race Pace: ${milesLabel(miles)} Miles`,
      details: "Steady at the effort you intend to race at. Not a time trial.",
    });
  }

  while (week.length < runs - 1) {
    week.push({
      type: "easy",
      miles: easyMiles,
      title: `${milesLabel(easyMiles)} Miles`,
      details: "Easy conversational effort.",
    });
  }

  if (longMiles > 0) {
    week.push({
      type: "long",
      miles: longMiles,
      title: `Long Run: ${milesLabel(longMiles)} Miles`,
      details: "Slow and steady. Time on feet matters more than pace.",
    });
  }

  return week.slice(0, Math.max(1, runs));
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
  const weeks = plannedWeeks(setup.distance, options.today, setup.date);
  if (weeksAvailable(options.today, setup.date) < 1) {
    throw new RacePlanError("That race date has already passed.");
  }

  const allowed = [...(options.runDays?.length ? options.runDays : EVERY_DAY)].sort(
    (a, b) => orderOf(a) - orderOf(b),
  );
  const ladder = longRunLadder(setup.distance, setup.level, weeks);
  const taper = taperWeeksFor(setup.distance, weeks);
  const levelNumbers = profile.levels[setup.level];

  const raceMonday = mondayOf(setup.date);
  const firstMonday = addDaysToLocalDate(raceMonday, -7 * (weeks - 1));

  let sequence = 0;
  const nextId = () => `workout-${String(++sequence).padStart(3, "0")}`;

  const trainingWeeks: TrainingWeek[] = [];
  for (let index = 0; index < weeks; index += 1) {
    const weekNumber = index + 1;
    const monday = addDaysToLocalDate(firstMonday, index * 7);
    const isRaceWeek = weekNumber === weeks;
    const longMiles = ladder[index] ?? 0;
    const isCutback =
      index > 0 && longMiles > 0 && longMiles < (ladder[index - 1] ?? 0);
    const phase = phaseFor(weekNumber, weeks, taper, isCutback && weekNumber <= weeks - taper);

    // Race week keeps two short shakeout runs and the race itself.
    const runCount = isRaceWeek
      ? 2
      : weekNumber > weeks - taper
        ? Math.max(2, levelNumbers.runsPerWeek - 1)
        : levelNumbers.runsPerWeek;
    const quality = weekNumber > weeks - taper ? 0 : levelNumbers.quality;
    const planned = isRaceWeek
      ? [
          {
            type: "easy" as const,
            miles: 2,
            title: "2 Miles",
            details: "Easy shakeout. Keep the legs turning over.",
          },
          {
            type: "easy" as const,
            miles: 2,
            title: "2 Miles",
            details: "Easy shakeout. Keep the legs turning over.",
          },
        ]
      : runsForWeek(longMiles, runCount, quality);

    const raceWeekday = weekdayOf(setup.date);
    const dayChoices = spreadDays(
      isRaceWeek
        ? allowed.filter((day) => day !== raceWeekday)
        : allowed,
      planned.length,
    );
    const byWeekday = new Map<Weekday, PlannedRun>();
    dayChoices.forEach((day, at) => {
      const run = planned[at];
      if (run) byWeekday.set(day, run);
    });

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
    id: `plan-${setup.distance}-${setup.date}`,
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
