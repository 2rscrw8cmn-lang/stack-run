import { mergeCandidates, unresolvedCandidates, type IntervalsCandidate } from "../connected/intervals";
import { InvalidPlacementError, assertPlacementFits, repackPlacements } from "../domain/placement";
import type { AppState, BlockPlacement, RunLog } from "../domain/types";
import { createRunLogId } from "../storage/appStateRepository";
import type {
  PersonalCloudRun,
  PersonalCloudSnapshot,
  PersonalInitializationRun,
  PersonalIntervalsDocument,
} from "./types";

function externalKey(run: RunLog): string | null {
  const source = run.externalSource;
  return source ? `${source.provider}\u0000${source.activityId}` : null;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function sameManualFacts(left: RunLog, right: RunLog): boolean {
  return left.source === "manual" && right.source === "manual" &&
    left.workoutId === right.workoutId &&
    left.completedDate === right.completedDate &&
    left.activityType === right.activityType &&
    left.distanceMiles === right.distanceMiles &&
    left.durationSeconds === right.durationSeconds &&
    left.effort === right.effort &&
    left.notes === right.notes;
}

export interface LegacyRunReconciliation {
  runsToUpload: RunLog[];
  aliasRunsToRegister: RunLog[];
  aliasesByCanonicalId: Record<string, string[]>;
  localToCanonical: Record<string, string>;
  droppedDeletedRunIds: string[];
}

export interface FirstDeviceCanonicalization {
  runs: PersonalInitializationRun[];
  placements: BlockPlacement[];
}

/**
 * Makes the very first upload satisfy account identity constraints too. Old
 * local data can contain repeated imports; manual collisions remain distinct.
 */
export function canonicalizeFirstDevice(
  localRuns: readonly RunLog[],
  placements: readonly BlockPlacement[],
): FirstDeviceCanonicalization {
  const runs: PersonalInitializationRun[] = [];
  const byExternal = new Map<string, PersonalInitializationRun>();
  const usedIds = new Set<string>();
  const aliases: Record<string, string> = {};

  for (const local of localRuns) {
    const key = externalKey(local);
    const duplicate = key ? byExternal.get(key) : undefined;
    if (duplicate) {
      if (local.id !== duplicate.id) {
        duplicate.legacyAliases = unique([
          ...(duplicate.legacyAliases ?? []),
          local.id,
        ]);
        aliases[local.id] = duplicate.id;
      }
      continue;
    }

    let candidate: PersonalInitializationRun = { ...local };
    if (usedIds.has(candidate.id)) {
      let id = createRunLogId();
      while (usedIds.has(id)) id = createRunLogId();
      candidate = { ...candidate, id };
      // A legacy placement using the collided id is ambiguous; keep it with
      // the first run and leave this preserved second activity unplaced.
    }
    usedIds.add(candidate.id);
    runs.push(candidate);
    if (key) byExternal.set(key, candidate);
  }

  return { runs, placements: rewritePlacementRunIds(placements, aliases) };
}

/**
 * Reconciles an old device's run identity without treating a legacy manual id
 * as proof that two activities are the same.
 */
export function reconcileLegacyRuns(
  localRuns: readonly RunLog[],
  cloudRuns: readonly PersonalCloudRun[],
): LegacyRunReconciliation {
  const active = cloudRuns.filter((item) => item.deletedAt === null);
  const deleted = cloudRuns.filter((item) => item.deletedAt !== null);
  const activeById = new Map(active.map((item) => [item.run.id, item] as const));
  const activeByExternal = new Map(
    active.flatMap((item) => {
      const key = externalKey(item.run);
      return key ? [[key, item] as const] : [];
    }),
  );
  const deletedById = new Map(
    deleted.flatMap((item) =>
      [item.run.id, ...item.aliases].map((id) => [id, item] as const),
    ),
  );
  const deletedExternal = new Set(
    deleted.flatMap((item) => {
      const key = externalKey(item.run);
      return key ? [key] : [];
    }),
  );
  const aliasesByCanonicalId: Record<string, string[]> = Object.fromEntries(
    active.map((item) => [item.run.id, [...item.aliases]]),
  );
  const localToCanonical: Record<string, string> = {};
  const runsToUpload: RunLog[] = [];
  const aliasRunsToRegister: RunLog[] = [];
  const droppedDeletedRunIds: string[] = [];
  const reservedIds = new Set(cloudRuns.flatMap((item) => [item.run.id, ...item.aliases]));

  for (const local of localRuns) {
    const key = externalKey(local);
    const idTombstone = deletedById.get(local.id);
    if (
      (key !== null && deletedExternal.has(key)) ||
      (idTombstone !== undefined && sameManualFacts(local, idTombstone.run))
    ) {
      droppedDeletedRunIds.push(local.id);
      continue;
    }
    const externalMatch = key ? activeByExternal.get(key) : undefined;
    if (externalMatch) {
      localToCanonical[local.id] = externalMatch.run.id;
      if (local.id !== externalMatch.run.id) {
        aliasRunsToRegister.push(local);
        aliasesByCanonicalId[externalMatch.run.id] = unique([
          ...(aliasesByCanonicalId[externalMatch.run.id] ?? []),
          local.id,
        ]);
      }
      continue;
    }

    const idCollision = activeById.get(local.id);
    let candidate = local;
    if (idCollision || reservedIds.has(local.id)) {
      // External runs were handled above. A manual collision is ambiguous by
      // definition, even when its date/distance happen to match, so preserve
      // both activities and give the joining device's run a new opaque id.
      let id = createRunLogId();
      while (reservedIds.has(id)) id = createRunLogId();
      candidate = { ...local, id };
      localToCanonical[local.id] = id;
    } else {
      localToCanonical[local.id] = local.id;
    }
    reservedIds.add(candidate.id);
    runsToUpload.push(candidate);
  }

  return {
    runsToUpload,
    aliasRunsToRegister,
    aliasesByCanonicalId,
    localToCanonical,
    droppedDeletedRunIds,
  };
}

export function rewritePlacementRunIds(
  placements: readonly BlockPlacement[],
  aliases: Readonly<Record<string, string>>,
): BlockPlacement[] {
  const seen = new Set<string>();
  return placements.flatMap((placement) => {
    const runLogId = aliases[placement.runLogId] ?? placement.runLogId;
    if (seen.has(runLogId)) return [];
    seen.add(runLogId);
    return [{ ...placement, runLogId }];
  });
}

/**
 * Adds exact legacy positions only for genuinely missing runs. Established
 * canonical construction never moves. An incompatible local block remains
 * earned but READY/unplaced.
 */
export function mergeMissingRunPlacements(
  canonical: readonly BlockPlacement[],
  local: readonly BlockPlacement[],
  localToCanonical: Readonly<Record<string, string>>,
  uploadedRunIds: ReadonlySet<string>,
): BlockPlacement[] {
  const merged = [...canonical];
  for (const placement of local) {
    const runLogId = localToCanonical[placement.runLogId] ?? placement.runLogId;
    if (!uploadedRunIds.has(runLogId)) continue;
    const candidate = { ...placement, runLogId };
    try {
      assertPlacementFits(candidate, merged);
      merged.push(candidate);
    } catch (error) {
      if (!(error instanceof InvalidPlacementError)) throw error;
      // The run still uploads. Its block intentionally remains unplaced.
    }
  }
  return merged;
}

export function repairCanonicalPlacements(
  placements: readonly BlockPlacement[],
  activeRunIds: ReadonlySet<string>,
): BlockPlacement[] {
  const surviving = placements.filter((placement) => activeRunIds.has(placement.runLogId));
  return surviving.length === placements.length
    ? [...placements]
    : repackPlacements(surviving);
}

export function mergeIntervalsDocuments(
  cloud: PersonalIntervalsDocument,
  localState: AppState,
  localPending: readonly IntervalsCandidate[],
): PersonalIntervalsDocument {
  const ignoredActivityIds = unique([
    ...cloud.ignoredActivityIds,
    ...localState.intervalsSync.ignoredActivityIds,
  ]);
  const lastSuccessfulActivitySyncAt = [
    cloud.lastSuccessfulActivitySyncAt,
    localState.intervalsSync.lastSuccessfulActivitySyncAt,
  ]
    .filter((value): value is string => value !== null)
    .sort()
    .at(-1) ?? null;
  const pendingCandidates = unresolvedCandidates(
    mergeCandidates([...cloud.pendingCandidates], [...localPending]),
    localState.runLogs,
    ignoredActivityIds,
  );
  return { lastSuccessfulActivitySyncAt, ignoredActivityIds, pendingCandidates };
}

export function appStateFromCloud(snapshot: PersonalCloudSnapshot): AppState {
  const activeRuns = snapshot.runs
    .filter((item) => item.deletedAt === null)
    .map((item) => item.run);
  const activeIds = new Set(activeRuns.map((run) => run.id));
  return {
    schemaVersion: 9,
    settings: snapshot.training.settings,
    plan: snapshot.training.plan,
    raceSetup: snapshot.training.raceSetup,
    availability: snapshot.training.availability,
    runDays: snapshot.training.runDays,
    runLogs: activeRuns,
    blockPlacements: repairCanonicalPlacements(snapshot.placements, activeIds),
    intervalsSync: {
      lastSuccessfulActivitySyncAt:
        snapshot.intervals.lastSuccessfulActivitySyncAt,
      ignoredActivityIds: [...snapshot.intervals.ignoredActivityIds],
    },
  };
}
