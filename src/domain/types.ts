export type WorkoutType =
  | "rest"
  | "easy"
  | "intervals"
  | "simulation"
  | "long"
  | "race";

/** Every workout type that produces an actual run. Rest is never an activity. */
export type RunActivityType = Exclude<WorkoutType, "rest">;

export type Effort = "rough" | "solid" | "great";

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
  colorKey: "neutral" | "easy" | "intervals" | "simulation" | "long" | "race";
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
  schemaVersion: 5;
  settings: AppSettings;
  plan: TrainingPlan;
  runLogs: RunLog[];
  blockPlacements: BlockPlacement[];
}
