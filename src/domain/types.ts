export type WorkoutType =
  | "rest"
  | "easy"
  | "intervals"
  | "simulation"
  | "long"
  | "race";

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

export interface RunLog {
  id: string;
  workoutId: string;
  completedDate: string;
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
  workoutId: string;
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
  height: 1 | 2 | 3 | 4;
  placedAt: string;
}

export interface AppState {
  schemaVersion: 4;
  settings: AppSettings;
  plan: TrainingPlan;
  runLogs: RunLog[];
  blockPlacements: BlockPlacement[];
}
