import { beforeEach, describe, expect, it } from "vitest";
import type { IntervalsCandidate } from "../connected/intervals";
import type { BlockPlacement, RunLog } from "../domain/types";
import { createInitialAppState } from "../storage/migrations";
import {
  appStateFromCloud,
  canonicalizeFirstDevice,
  mergeIntervalsDocuments,
  mergeMissingRunPlacements,
  reconcileLegacyRuns,
  rewritePlacementRunIds,
} from "./reconciliation";
import type { PersonalCloudRun, PersonalCloudSnapshot } from "./types";

const createdAt = "2026-08-10T12:00:00.000Z";

function run(id: string, overrides: Partial<RunLog> = {}): RunLog {
  return {
    id,
    workoutId: null,
    completedDate: "2026-08-10",
    activityType: "easy",
    distanceMiles: 3,
    durationSeconds: 1800,
    effort: "solid",
    notes: "",
    source: "manual",
    externalSource: null,
    importedMetrics: null,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

function imported(id: string, activityId = "intervals-42"): RunLog {
  return run(id, {
    source: "intervals",
    externalSource: {
      provider: "intervals",
      activityId,
      sourceUpdatedAt: null,
      importedAt: createdAt,
    },
    importedMetrics: { averageHeartRate: 145 },
  });
}

function cloud(item: RunLog, overrides: Partial<PersonalCloudRun> = {}): PersonalCloudRun {
  return { run: item, revision: 1, deletedAt: null, aliases: [], ...overrides };
}

function placement(runLogId: string, columnStart = 1): BlockPlacement {
  return { runLogId, row: 0, columnStart, width: 1, height: 1, placedAt: createdAt };
}

beforeEach(() => localStorage.clear());

describe("first-device canonicalization", () => {
  it("uploads one canonical run for a repeated Intervals activity and retains the old id as an alias", () => {
    const result = canonicalizeFirstDevice(
      [imported("legacy-a"), imported("legacy-b")],
      [placement("legacy-b")],
    );

    expect(result.runs).toHaveLength(1);
    expect(result.runs[0]).toMatchObject({ id: "legacy-a", legacyAliases: ["legacy-b"] });
    expect(result.placements[0].runLogId).toBe("legacy-a");
  });

  it("preserves two distinct manual activities that share a deterministic legacy id", () => {
    const result = canonicalizeFirstDevice(
      [run("legacy-manual", { distanceMiles: 3 }), run("legacy-manual", { distanceMiles: 7 })],
      [placement("legacy-manual")],
    );

    expect(result.runs).toHaveLength(2);
    expect(result.runs.map((item) => item.distanceMiles)).toEqual([3, 7]);
    expect(result.runs[1].id).toMatch(/^run-[0-9a-f-]{36}$/);
    expect(result.placements[0].runLogId).toBe("legacy-manual");
  });
});

describe("second-device run reconciliation", () => {
  it("aliases the same Intervals activity under a different local id", () => {
    const result = reconcileLegacyRuns(
      [imported("device-b")],
      [cloud(imported("canonical"))],
    );
    expect(result.runsToUpload).toEqual([]);
    expect(result.aliasRunsToRegister).toEqual([imported("device-b")]);
    expect(result.localToCanonical).toEqual({ "device-b": "canonical" });
    expect(result.aliasesByCanonicalId.canonical).toEqual(["device-b"]);
  });

  it("does not resurrect a tombstoned external activity", () => {
    const result = reconcileLegacyRuns(
      [imported("stale-device")],
      [cloud(imported("canonical"), { deletedAt: createdAt, aliases: ["old-device"] })],
    );
    expect(result.runsToUpload).toEqual([]);
    expect(result.droppedDeletedRunIds).toEqual(["stale-device"]);
  });

  it("does not resurrect a tombstoned manual run through an old alias", () => {
    const result = reconcileLegacyRuns(
      [run("old-device")],
      [cloud(run("canonical"), { deletedAt: createdAt, aliases: ["old-device"] })],
    );
    expect(result.runsToUpload).toEqual([]);
    expect(result.droppedDeletedRunIds).toEqual(["old-device"]);
  });

  it("preserves a distinct manual activity that only collides with a tombstoned legacy id", () => {
    const result = reconcileLegacyRuns(
      [run("old-device", { distanceMiles: 12, notes: "Different real run" })],
      [cloud(run("canonical"), { deletedAt: createdAt, aliases: ["old-device"] })],
    );
    expect(result.runsToUpload).toHaveLength(1);
    expect(result.runsToUpload[0]).toMatchObject({ distanceMiles: 12, notes: "Different real run" });
    expect(result.runsToUpload[0].id).not.toBe("old-device");
  });

  it("re-ids a genuinely distinct manual run instead of destroying it on collision", () => {
    const result = reconcileLegacyRuns(
      [run("legacy-id", { distanceMiles: 9 })],
      [cloud(run("legacy-id", { distanceMiles: 3 }))],
    );
    expect(result.runsToUpload).toHaveLength(1);
    expect(result.runsToUpload[0].distanceMiles).toBe(9);
    expect(result.runsToUpload[0].id).not.toBe("legacy-id");
  });
});

describe("Personal Build adoption", () => {
  it("keeps canonical construction fixed while adding a fitting missing block", () => {
    const merged = mergeMissingRunPlacements(
      [placement("canonical", 1)],
      [placement("new-run", 2)],
      { "new-run": "new-run" },
      new Set(["new-run"]),
    );
    expect(merged.map((item) => item.runLogId)).toEqual(["canonical", "new-run"]);
  });

  it("keeps the run READY when its old-device position collides", () => {
    const merged = mergeMissingRunPlacements(
      [placement("canonical", 1)],
      [placement("new-run", 1)],
      { "new-run": "new-run" },
      new Set(["new-run"]),
    );
    expect(merged).toEqual([placement("canonical", 1)]);
  });

  it("rewrites aliases without creating two placements for one canonical run", () => {
    expect(rewritePlacementRunIds(
      [placement("legacy-a", 1), placement("legacy-b", 2)],
      { "legacy-a": "canonical", "legacy-b": "canonical" },
    )).toEqual([{ ...placement("legacy-a", 1), runLogId: "canonical" }]);
  });
});

describe("canonical hydration and account-wide Intervals state", () => {
  const candidate = (externalId: string): IntervalsCandidate => ({
    externalId,
    sourceType: "Run",
    completedDate: "2026-08-10",
    distanceMiles: 3,
    durationSeconds: 1800,
    sourceUpdatedAt: null,
    metrics: {},
    inferredActivityType: "easy",
  });

  it("hydrates plan, run and Build from the canonical snapshot", () => {
    const seed = createInitialAppState();
    const canonicalRun = run("canonical");
    const snapshot: PersonalCloudSnapshot = {
      accountGeneration: 1,
      training: {
        settings: seed.settings,
        plan: { ...seed.plan, name: "Cloud plan" },
        raceSetup: seed.raceSetup,
        availability: seed.availability,
        runDays: seed.runDays,
        crossTrainingDays: seed.crossTrainingDays,
      },
      trainingRevision: 4,
      runs: [cloud(canonicalRun, { revision: 3 })],
      placements: [placement("canonical")],
      buildRevision: 2,
      intervals: { lastSuccessfulActivitySyncAt: null, ignoredActivityIds: [], pendingCandidates: [] },
      intervalsRevision: 1,
    };
    const hydrated = appStateFromCloud(snapshot);
    expect(hydrated.plan.name).toBe("Cloud plan");
    expect(hydrated.runLogs).toEqual([canonicalRun]);
    expect(hydrated.blockPlacements).toEqual([placement("canonical")]);
  });

  it("unions ignored ids and unresolved candidates from two devices", () => {
    const local = createInitialAppState();
    local.intervalsSync.ignoredActivityIds = ["ignored-local"];
    const merged = mergeIntervalsDocuments(
      {
        lastSuccessfulActivitySyncAt: "2026-08-10T10:00:00Z",
        ignoredActivityIds: ["ignored-cloud"],
        pendingCandidates: [candidate("cloud")],
      },
      local,
      [candidate("local")],
    );
    expect(merged.ignoredActivityIds).toEqual(["ignored-cloud", "ignored-local"]);
    expect(merged.pendingCandidates.map((item) => item.externalId).sort()).toEqual(["cloud", "local"]);
  });
});
