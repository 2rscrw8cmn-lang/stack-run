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

export interface AppState {
  schemaVersion: 1;
  settings: AppSettings;
  plan: TrainingPlan;
  runLogs: RunLog[];
}
