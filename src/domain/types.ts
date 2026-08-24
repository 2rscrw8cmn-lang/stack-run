import type { AvailabilityCalendar } from "./availability";
import type { RacePlanSetup } from "./racePlan";
import type { Weekday } from "./runDays";

export type WorkoutType =
  | "rest"
  | "easy"
  | "intervals"
  | "simulation"
  | "long"
  | "race"
  | "cross";

/** Every workout type that produces an actual run. Rest is never an activity. */
export type RunActivityType = Exclude<WorkoutType, "rest">;

export type Effort = "rough" | "solid" | "great";
export type RunSource = "manual" | "intervals";

export interface ExternalRunSource {
  provider: "intervals";
  activityId: string;
  sourceUpdatedAt: string | null;
  importedAt: string;
}

export interface ImportedRunMetrics {
  averageHeartRate?: number;
  maxHeartRate?: number;
  averageCadence?: number;
  elevationGainFeet?: number;
  elapsedTimeSeconds?: number;
  trainingLoad?: number;
  hrZoneSeconds?: number[];
  /**
   * The fastest continuous 5,000 m effort inside this run, in seconds, as the
   * connected source itself reports it.
   *
   * Source-derived, never STACK-derived. It is present only when Intervals'
   * own pace curve returns a 5,000 m best effort for the activity, which it
   * does only when the activity actually covered 5,000 m — the same rule the
   * source applies, and the reason a 4.99 km run has no value here rather than
   * a rounded one. `duration / distance * 5K` is not this number and is never
   * written into it; see `docs/CONNECTED_DATA_FIELDS.md`.
   */
  best5kSeconds?: number;
}

export interface Race {
  name: string;
  date: string;
  startTime?: string;
  location?: string;
  distanceMiles: number;
}

export interface BuildAssignment {
  renders: boolean;
  weekRow: number;
  orderInWeek: number | null;
  span: 0 | 1 | 2 | 3 | 4;
  colorKey: "neutral" | "easy" | "intervals" | "simulation" | "long" | "race" | "cross";
}

export interface Workout {
  id: string;
  date: string;
  weekNumber: number;
  phase: string;
  type: WorkoutType;
  title: string;
  targetDistanceMiles: string | null;
  details: string;
  build: BuildAssignment;
}

export interface TrainingWeek {
  weekNumber: number;
  phase: string;
  startDate: string;
  endDate: string;
  workouts: Workout[];
}

export interface TrainingPlan {
  schemaVersion: 1;
  id: string;
  name: string;
  race: Race;
  startDate: string;
  endDate: string;
  weeks: TrainingWeek[];
  notes: string[];
}

/** Immutable race intent retained after it stops being the active plan. */
export interface ArchivedTrainingPlan {
  id: string;
  plan: TrainingPlan;
  raceSetup: RacePlanSetup | null;
  /** Explicit run-to-workout relationships captured when this plan ended. */
  runLinks: Record<string, string>;
  archivedAt: string;
}

/**
 * One actual run. It may satisfy a scheduled workout or stand on its own: an
 * extra run is a real activity that the plan never asked for, so it earns a
 * block and counts miles without completing anything on the schedule.
 */
export interface RunLog {
  id: string;
  /** Null means this was an extra run, with no scheduled workout behind it. */
  workoutId: string | null;
  /** The local date the run actually happened, which the user may edit. */
  completedDate: string;
  /** What the run was. Prefilled from the workout when there is one. */
  activityType: RunActivityType;
  distanceMiles: number;
  durationSeconds: number;
  effort: Effort;
  notes: string;
  createdAt: string;
  updatedAt: string;
  /** Required in persisted schema 9; optional here for legacy in-memory test fixtures. */
  source?: RunSource;
  externalSource?: ExternalRunSource | null;
  importedMetrics?: ImportedRunMetrics | null;
  /**
   * A heart rate the runner typed in by hand, in bpm — never a source-verified
   * fact the way `importedMetrics.averageHeartRate` is. Kept as its own field
   * rather than folded into `importedMetrics` so the two can never be
   * confused: this is the one number in Run Detail that is not something a
   * watch measured.
   */
  manualHeartRate?: number | null;
}

export interface IntervalsSyncState {
  lastSuccessfulActivitySyncAt: string | null;
  ignoredActivityIds: string[];
}

export interface AppSettings {
  units: "miles";
  theme: "dark";
}

/**
 * Where the user placed the block earned by a completed run. A run log records
 * that the run happened; a placement records where its block was built into
 * the structure. The two are deliberately separate states.
 *
 * There is no `weekNumber`: the tower is one continuous grid and a week no
 * longer reserves space in it. Which week earned a block is still knowable —
 * it is a property of the workout — it is just not a property of the geometry.
 */
export interface BlockPlacement {
  /** The activity that earned this block, scheduled or extra. */
  runLogId: string;
  /** 0-based course counted up from the ground, across the whole tower. */
  row: number;
  /** 1-based, inclusive. The block occupies `width` columns from here. */
  columnStart: number;
  width: 1 | 2 | 3 | 4;
  /**
   * Courses tall. Stored rather than derived because it is frozen when the
   * block is earned: it decides how the block packs, and blocks come to rest
   * on it, so recomputing it later would re-pack the tower.
   */
  height: 1 | 2 | 3;
  placedAt: string;
}

export interface AppState {
  schemaVersion: 10;
  settings: AppSettings;
  /** The runner's one active race plan, or null while running between races. */
  plan: TrainingPlan | null;
  /** Previous race intent, newest first and never inferred from actual runs. */
  planHistory: ArchivedTrainingPlan[];
  runLogs: RunLog[];
  blockPlacements: BlockPlacement[];
  /**
   * An imported calendar of days the user cannot run, or null when none has
   * been imported. It never changes the plan by itself.
   */
  availability: AvailabilityCalendar | null;
  /**
   * The weekdays the runner is willing to run on, or null while they have not
   * said. A preference, not a rule: it reshapes the plan when the runner asks
   * it to, and does not police edits made afterwards.
   */
  runDays: Weekday[] | null;
  /**
   * The weekdays the runner wants Cross Training on, or null/empty while they
   * have not said. Like `runDays`, a preference rather than a rule: applying
   * it fills in rest days that land on these weekdays, and never touches a
   * day that already schedules a run or one already lived.
   */
  crossTrainingDays: Weekday[] | null;
  /**
   * The race the plan was generated for — name, date, distance, level — or
   * null for the plan STACK shipped with. One race at a time: a plan is for
   * the thing you are training for, and two of those is two plans.
   */
  raceSetup: RacePlanSetup | null;
  intervalsSync: IntervalsSyncState;
}
