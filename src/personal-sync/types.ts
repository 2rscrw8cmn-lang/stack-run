import type { IntervalsCandidate } from "../connected/intervals";
import type {
  AppState,
  BlockPlacement,
  RunLog,
} from "../domain/types";

export interface PersonalTrainingDocument {
  settings: AppState["settings"];
  plan: AppState["plan"];
  planHistory: AppState["planHistory"];
  raceSetup: AppState["raceSetup"];
  availability: AppState["availability"];
  runDays: AppState["runDays"];
  crossTrainingDays: AppState["crossTrainingDays"];
}

export interface PersonalIntervalsDocument {
  lastSuccessfulActivitySyncAt: string | null;
  ignoredActivityIds: string[];
  pendingCandidates: IntervalsCandidate[];
}

export interface PersonalCloudRun {
  run: RunLog;
  revision: number;
  deletedAt: string | null;
  aliases: string[];
}

export interface PersonalDeleteResult {
  buildRevision: number;
  placements: BlockPlacement[];
}

export type PersonalInitializationRun = RunLog & { legacyAliases?: string[] };

export interface PersonalCloudSnapshot {
  accountGeneration: number;
  training: PersonalTrainingDocument;
  trainingRevision: number;
  runs: PersonalCloudRun[];
  placements: BlockPlacement[];
  buildRevision: number;
  intervals: PersonalIntervalsDocument;
  intervalsRevision: number;
}

export interface PersonalRevisionState {
  training: number;
  build: number;
  intervals: number;
  runs: Record<string, number>;
}

export interface PersonalRunMutation {
  kind: "upsert" | "delete";
  expectedRevision: number;
}

export interface PersonalOutbox {
  version: 1;
  accountGeneration: number;
  generation: number;
  reset: boolean;
  training: boolean;
  build: boolean;
  intervals: boolean;
  runs: Record<string, PersonalRunMutation>;
  updatedAt: string;
}

export interface PersonalCacheMetadata {
  version: 1;
  initialized: boolean;
  accountGeneration: number;
  revisions: PersonalRevisionState;
  aliasesByCanonicalId: Record<string, string[]>;
  updatedAt: string;
}

export type PersonalSyncStatus =
  | "local-only"
  | "loading"
  | "initialization-required"
  | "ready"
  | "syncing"
  | "offline-pending"
  | "error";

export interface PersonalInitializationSummary {
  runCount: number;
  blockCount: number;
  raceName: string | null;
}

export interface PersonalSyncController {
  status: PersonalSyncStatus;
  initialized: boolean;
  error: string | null;
  message: string | null;
  initialization: PersonalInitializationSummary | null;
  userId: string | null;
  pendingCandidates: IntervalsCandidate[];
  recordMutation: (previous: AppState, next: AppState) => void;
  recordPendingCandidates: (candidates: readonly IntervalsCandidate[]) => void;
  initializeFromThisDevice: () => Promise<void>;
  deferInitialization: () => void;
  syncNow: () => Promise<void>;
  resetAccount: (fresh: AppState) => Promise<void>;
  clearMessage: () => void;
}

export function trainingDocumentFrom(state: AppState): PersonalTrainingDocument {
  return {
    settings: state.settings,
    plan: state.plan,
    planHistory: state.planHistory,
    raceSetup: state.raceSetup,
    availability: state.availability,
    runDays: state.runDays,
    crossTrainingDays: state.crossTrainingDays,
  };
}

export function intervalsDocumentFrom(
  state: AppState,
  pendingCandidates: readonly IntervalsCandidate[],
): PersonalIntervalsDocument {
  return {
    lastSuccessfulActivitySyncAt:
      state.intervalsSync.lastSuccessfulActivitySyncAt,
    ignoredActivityIds: [...state.intervalsSync.ignoredActivityIds],
    pendingCandidates: [...pendingCandidates],
  };
}
