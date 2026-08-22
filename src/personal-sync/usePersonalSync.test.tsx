import { act, renderHook, waitFor } from "@testing-library/react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IntervalsCandidate } from "../connected/intervals";
import { repackPlacements } from "../domain/placement";
import type { BlockPlacement, RunLog } from "../domain/types";
import { acceptIntervalsRun } from "../storage/appStateRepository";
import { loadIntervalsApiKey, saveIntervalsApiKey } from "../storage/intervalsCredentialRepository";
import { createSeededAppState } from "../storage/migrations";
import {
  emptyPersonalOutbox,
  loadPersonalOutbox,
  saveAccountAppState,
  savePersonalMetadata,
  savePersonalOutbox,
} from "../storage/personalSyncRepository";
import { appStateFromCloud } from "./reconciliation";
import type { PersonalCloudSnapshot } from "./types";

const cloud = vi.hoisted(() => ({
  initialize: vi.fn(),
  load: vi.fn(),
  saveRun: vi.fn(),
  saveBuild: vi.fn(),
  saveIntervals: vi.fn(),
  saveTraining: vi.fn(),
  deleteRuns: vi.fn(),
  reset: vi.fn(),
  reconcileCrew: vi.fn(),
  reconcileCrewContributions: vi.fn(),
}));

vi.mock("../crew/projection", async () => {
  const actual = await vi.importActual<typeof import("../crew/projection")>(
    "../crew/projection",
  );
  return { ...actual, reconcileCrewContributions: cloud.reconcileCrewContributions };
});

vi.mock("../crew/supabaseClient", () => ({
  getSupabaseAvailability: () => ({
    configured: true,
    client: {} as SupabaseClient,
    reason: null,
  }),
}));

vi.mock("./personalCloudRepository", async () => {
  const actual = await vi.importActual<typeof import("./personalCloudRepository")>(
    "./personalCloudRepository",
  );
  return {
    ...actual,
    initializePersonalCloud: cloud.initialize,
    loadPersonalCloudSnapshot: cloud.load,
    savePersonalRun: cloud.saveRun,
    savePersonalBuildDocument: cloud.saveBuild,
    savePersonalIntervalsDocument: cloud.saveIntervals,
    savePersonalTrainingDocument: cloud.saveTraining,
    deletePersonalRuns: cloud.deleteRuns,
    resetPersonalCloud: cloud.reset,
    reconcileCrewRunIdentity: cloud.reconcileCrew,
  };
});

import { usePersonalSync } from "./usePersonalSync";

const at = "2026-08-10T12:00:00.000Z";

const pendingCandidate: IntervalsCandidate = {
  externalId: "activity-42",
  sourceType: "Run",
  completedDate: "2026-08-10",
  distanceMiles: 8,
  durationSeconds: 4200,
  sourceUpdatedAt: null,
  metrics: { averageHeartRate: 150 },
  inferredActivityType: "long",
};

function importedRun(id: string): RunLog {
  return {
    id,
    workoutId: null,
    completedDate: "2026-08-10",
    activityType: "long",
    distanceMiles: 8,
    durationSeconds: 4200,
    effort: "solid",
    notes: "",
    source: "intervals",
    externalSource: {
      provider: "intervals",
      activityId: "activity-42",
      sourceUpdatedAt: null,
      importedAt: at,
    },
    importedMetrics: { averageHeartRate: 150 },
    createdAt: at,
    updatedAt: at,
  };
}

function manualRun(id: string, completedDate = "2026-08-10"): RunLog {
  return {
    ...importedRun(id),
    completedDate,
    source: "manual",
    externalSource: null,
    importedMetrics: null,
  };
}

function placed(runLogId: string, row: number, placedAt: string): BlockPlacement {
  return { runLogId, row, columnStart: 1, width: 4, height: 1, placedAt };
}

function snapshot(runLogs: RunLog[] = [], accountGeneration = 1): PersonalCloudSnapshot {
  const seed = createSeededAppState();
  return {
    accountGeneration,
    training: {
      settings: seed.settings,
      plan: { ...seed.plan, name: "Canonical cloud plan" },
      planHistory: seed.planHistory,
      raceSetup: seed.raceSetup,
      availability: seed.availability,
      runDays: seed.runDays,
      crossTrainingDays: seed.crossTrainingDays,
    },
    trainingRevision: 1,
    runs: runLogs.map((run) => ({ run, revision: 1, deletedAt: null, aliases: [] })),
    placements: [],
    buildRevision: 1,
    intervals: {
      lastSuccessfulActivitySyncAt: null,
      ignoredActivityIds: [],
      pendingCandidates: [],
    },
    intervalsRevision: 1,
  };
}

function markInitialized(userId: string, source: PersonalCloudSnapshot): void {
  savePersonalMetadata(userId, {
    version: 1,
    initialized: true,
    accountGeneration: source.accountGeneration,
    revisions: {
      training: source.trainingRevision,
      build: source.buildRevision,
      intervals: source.intervalsRevision,
      runs: Object.fromEntries(source.runs.map((item) => [item.run.id, item.revision])),
    },
    aliasesByCanonicalId: {},
    updatedAt: at,
  });
}

beforeEach(() => {
  localStorage.clear();
  Object.values(cloud).forEach((mock) => mock.mockReset());
  cloud.initialize.mockResolvedValue(undefined);
  cloud.saveBuild.mockResolvedValue(2);
  cloud.saveIntervals.mockResolvedValue(2);
  cloud.saveTraining.mockResolvedValue(2);
  cloud.deleteRuns.mockResolvedValue({ buildRevision: 2, placements: [] });
  cloud.reset.mockResolvedValue(2);
  cloud.reconcileCrew.mockResolvedValue(undefined);
  cloud.reconcileCrewContributions.mockResolvedValue(0);
});

describe("personal sync lifecycle", () => {
  it("requires first-device confirmation, backs up, uploads without a credential, then rehydrates from the server", async () => {
    const local = structuredClone(createSeededAppState());
    local.plan.name = "Device plan";
    cloud.load.mockResolvedValueOnce(null).mockResolvedValueOnce(snapshot());
    const onReplaceState = vi.fn();
    localStorage.setItem("stack.intervals.api-key.v1", "never-upload-this-key");

    const { result } = renderHook(() => usePersonalSync({
      sessionStatus: "signed-in",
      userId: "user-a",
      state: local,
      onReplaceState,
    }));

    await waitFor(() => expect(result.current.status).toBe("initialization-required"));
    expect(cloud.initialize).not.toHaveBeenCalled();
    await act(async () => result.current.initializeFromThisDevice());

    expect(cloud.initialize).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(cloud.initialize.mock.calls[0])).not.toContain("never-upload-this-key");
    expect(loadIntervalsApiKey("user-a")).toBe("never-upload-this-key");
    expect(loadIntervalsApiKey()).toBeNull();
    expect(Object.keys(localStorage).some((key) => key.startsWith("stack.app-state.backup."))).toBe(true);
    expect(onReplaceState).toHaveBeenLastCalledWith(
      expect.objectContaining({ plan: expect.objectContaining({ name: "Canonical cloud plan" }) }),
    );
    expect(result.current.status).toBe("ready");
  });

  it("adopts an initialized account, registers a legacy external alias, and keeps the canonical run id", async () => {
    const canonical = importedRun("canonical-run");
    const legacy = importedRun("legacy-device-run");
    const initialSnapshot = snapshot([canonical]);
    const canonicalWithAlias = {
      ...initialSnapshot,
      runs: [{ ...initialSnapshot.runs[0], aliases: [legacy.id], revision: 2 }],
    };
    cloud.load
      .mockResolvedValueOnce(initialSnapshot)
      .mockResolvedValueOnce(canonicalWithAlias);
    cloud.saveRun.mockResolvedValue(canonicalWithAlias.runs[0]);
    const local = structuredClone(createSeededAppState());
    local.runLogs = [legacy];
    const onReplaceState = vi.fn();
    saveIntervalsApiKey("second-device-key");

    const { result } = renderHook(() => usePersonalSync({
      sessionStatus: "signed-in",
      userId: "user-a",
      state: local,
      onReplaceState,
    }));

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(cloud.saveRun).toHaveBeenCalledWith(expect.anything(), 1, 0, legacy);
    expect(cloud.reconcileCrew).toHaveBeenCalledWith(
      expect.anything(),
      "canonical-run",
      ["legacy-device-run"],
    );
    expect(onReplaceState).toHaveBeenLastCalledWith(
      expect.objectContaining({ runLogs: [expect.objectContaining({ id: "canonical-run" })] }),
    );
    expect(loadIntervalsApiKey("user-a")).toBe("second-device-key");
    expect(loadIntervalsApiKey()).toBeNull();
  });

  it("reconciles every Crew contribution on adoption, not only snapshot aliases", async () => {
    // The duplicate a pre-DATA-1 device left behind carries a local id no
    // canonical run ever recorded, so an alias-driven repair never reaches it.
    const canonical = snapshot([manualRun("run-canonical")]);
    expect(canonical.runs.every((item) => item.aliases.length === 0)).toBe(true);
    cloud.load.mockResolvedValue(canonical);
    const local = structuredClone(createSeededAppState());
    const onReplaceState = vi.fn();

    const { result } = renderHook(() => usePersonalSync({
      sessionStatus: "signed-in",
      userId: "user-a",
      state: local,
      onReplaceState,
    }));

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(cloud.reconcileCrewContributions).toHaveBeenCalledWith(expect.anything());
    expect(cloud.reconcileCrew).not.toHaveBeenCalled();
  });

  it("atomically deletes a supporting run with the canonical deterministic Build repack", async () => {
    const runs = [
      manualRun("build-a", "2026-08-10"),
      manualRun("build-b", "2026-08-11"),
      manualRun("build-c", "2026-08-12"),
    ];
    const placements = [
      placed("build-a", 0, "2026-08-10T10:00:00Z"),
      placed("build-b", 1, "2026-08-11T10:00:00Z"),
      placed("build-c", 2, "2026-08-12T10:00:00Z"),
    ];
    const initial = { ...snapshot(runs), placements, buildRevision: 7 };
    const repaired = repackPlacements(placements.filter((item) => item.runLogId !== "build-b"));
    const canonical = {
      ...initial,
      buildRevision: 8,
      placements: repaired,
      runs: initial.runs.map((item) => item.run.id === "build-b"
        ? { ...item, revision: 2, deletedAt: "2026-08-13T12:00:00Z" }
        : item),
    };
    markInitialized("user-a", initial);
    cloud.load
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(canonical);
    cloud.deleteRuns.mockResolvedValue({ buildRevision: 8, placements: repaired });
    const onReplaceState = vi.fn();
    const local = appStateFromCloud(initial);
    const { result } = renderHook(() => usePersonalSync({
      sessionStatus: "signed-in",
      userId: "user-a",
      state: local,
      onReplaceState,
    }));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    const afterDelete = {
      ...local,
      runLogs: local.runLogs.filter((run) => run.id !== "build-b"),
      blockPlacements: repaired,
    };
    act(() => result.current.recordMutation(local, afterDelete));

    await waitFor(() => expect(cloud.deleteRuns).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(cloud.deleteRuns).toHaveBeenCalledWith(
      expect.anything(),
      1,
      7,
      ["build-b"],
      repaired,
    );
    expect(cloud.saveBuild).not.toHaveBeenCalled();
    expect(result.current.message ?? "").not.toContain("changed on another device");
    expect(onReplaceState).toHaveBeenLastCalledWith(
      expect.objectContaining({ blockPlacements: repaired }),
    );
  });

  it("automatically flushes an edit made while the first sync request is active", async () => {
    const initial = snapshot();
    markInitialized("user-a", initial);
    const runA = manualRun("run-a");
    const firstSaved = { run: runA, revision: 1, deletedAt: null, aliases: [] };
    const runB = { ...runA, notes: "edit B", updatedAt: "2026-08-10T13:00:00Z" };
    const secondSaved = { run: runB, revision: 2, deletedAt: null, aliases: [] };
    let finishFirst!: (value: typeof firstSaved) => void;
    cloud.saveRun
      .mockImplementationOnce(() => new Promise((resolve) => { finishFirst = resolve; }))
      .mockResolvedValueOnce(secondSaved);
    cloud.load
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce({ ...initial, runs: [firstSaved] })
      .mockResolvedValueOnce({ ...initial, runs: [secondSaved] });
    const onReplaceState = vi.fn();
    const local = appStateFromCloud(initial);
    const { result, rerender } = renderHook(({ currentState }) => usePersonalSync({
      sessionStatus: "signed-in",
      userId: "user-a",
      state: currentState,
      onReplaceState,
    }), { initialProps: { currentState: local } });
    await waitFor(() => expect(result.current.status).toBe("ready"));

    const withA = { ...local, runLogs: [runA] };
    act(() => result.current.recordMutation(local, withA));
    rerender({ currentState: withA });
    await waitFor(() => expect(cloud.saveRun).toHaveBeenCalledTimes(1));
    const withB = { ...withA, runLogs: [runB] };
    act(() => result.current.recordMutation(withA, withB));
    rerender({ currentState: withB });
    expect(loadPersonalOutbox("user-a")).toMatchObject({
      generation: 2,
      runs: { "run-a": { kind: "upsert", expectedRevision: 0 } },
    });
    await act(async () => finishFirst(firstSaved));

    await waitFor(() => expect(cloud.saveRun).toHaveBeenCalledTimes(2));
    expect(cloud.saveRun.mock.calls[1]).toEqual([
      expect.anything(),
      1,
      1,
      runB,
    ]);
  });

  it("does not let a stale pull undo a confirmed Intervals workout match", async () => {
    const initial = snapshot();
    initial.intervals.pendingCandidates = [pendingCandidate];
    markInitialized("user-a", initial);
    let finishStalePull!: (value: PersonalCloudSnapshot) => void;
    cloud.load
      .mockResolvedValueOnce(initial)
      .mockImplementationOnce(() => new Promise((resolve) => { finishStalePull = resolve; }));
    const onReplaceState = vi.fn();
    const local = appStateFromCloud(initial);
    const { result, rerender } = renderHook(({ currentState }) => usePersonalSync({
      sessionStatus: "signed-in",
      userId: "user-a",
      state: currentState,
      onReplaceState,
    }), { initialProps: { currentState: local } });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.pendingCandidates).toEqual([pendingCandidate]);

    let pull!: Promise<void>;
    act(() => {
      pull = result.current.syncNow();
    });
    await waitFor(() => expect(cloud.load).toHaveBeenCalledTimes(2));

    const workoutId = local.plan!.weeks[0].workouts.find((workout) => workout.type !== "rest")!.id;
    const matched = acceptIntervalsRun(
      local,
      pendingCandidate,
      workoutId,
      "long",
      "solid",
      "",
    );
    const matchedRun = matched.runLogs.find(
      (run) => run.externalSource?.activityId === pendingCandidate.externalId,
    )!;
    const canonical = {
      ...initial,
      runs: [{ run: matchedRun, revision: 1, deletedAt: null, aliases: [] }],
      intervals: { ...initial.intervals, pendingCandidates: [] },
      intervalsRevision: 2,
    } satisfies PersonalCloudSnapshot;
    cloud.saveRun.mockResolvedValue(canonical.runs[0]);
    cloud.load.mockResolvedValue(canonical);
    act(() => {
      result.current.recordMutation(local, matched);
      result.current.recordPendingCandidates([]);
    });
    rerender({ currentState: matched });

    await act(async () => finishStalePull(initial));
    await pull;

    await waitFor(() => expect(cloud.saveRun).toHaveBeenCalledWith(
      expect.anything(),
      1,
      0,
      expect.objectContaining({
        id: matchedRun.id,
        workoutId,
        externalSource: expect.objectContaining({ activityId: pendingCandidate.externalId }),
      }),
    ));
    await waitFor(() => expect(onReplaceState).toHaveBeenLastCalledWith(
      expect.objectContaining({
        runLogs: [expect.objectContaining({ id: matchedRun.id, workoutId })],
      }),
    ));
    expect(result.current.pendingCandidates).toEqual([]);
  });

  it("backs up and discards a never-synced pre-reset run, then accepts post-reset work", async () => {
    const staleRun = manualRun("offline-before-reset");
    const stale = { ...createSeededAppState(), runLogs: [staleRun] };
    const canonical = snapshot([], 2);
    saveAccountAppState("user-a", stale);
    markInitialized("user-a", snapshot([], 1));
    const outbox = emptyPersonalOutbox(1);
    outbox.runs[staleRun.id] = { kind: "upsert", expectedRevision: 0 };
    outbox.generation = 1;
    savePersonalOutbox("user-a", outbox);
    cloud.load.mockResolvedValue(canonical);
    const onReplaceState = vi.fn();
    const { result } = renderHook(() => usePersonalSync({
      sessionStatus: "signed-in",
      userId: "user-a",
      state: stale,
      onReplaceState,
    }));

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(cloud.saveRun).not.toHaveBeenCalled();
    expect(loadPersonalOutbox("user-a").runs).toEqual({});
    expect(Object.keys(localStorage)
      .filter((key) => key.startsWith("stack.app-state.backup."))
      .some((key) => localStorage.getItem(key)?.includes("offline-before-reset")))
      .toBe(true);
    expect(onReplaceState).toHaveBeenLastCalledWith(
      expect.objectContaining({ runLogs: [] }),
    );

    const afterResetRun = manualRun("after-reset");
    cloud.saveRun.mockResolvedValue({
      run: afterResetRun,
      revision: 1,
      deletedAt: null,
      aliases: [],
    });
    const current = appStateFromCloud(canonical);
    act(() => result.current.recordMutation(current, { ...current, runLogs: [afterResetRun] }));
    await waitFor(() => expect(cloud.saveRun).toHaveBeenCalledTimes(1));
    expect(cloud.saveRun.mock.calls[0][1]).toBe(2);
  });

  it("keeps the valid local cache visible when nested cloud training data is malformed", async () => {
    const local = createSeededAppState();
    local.plan.name = "Known-good local plan";
    const malformed = snapshot();
    malformed.training.plan = structuredClone(malformed.training.plan);
    malformed.training.plan!.weeks[0].workouts[0].build.span = "wide" as never;
    cloud.load.mockResolvedValue(malformed);
    const onReplaceState = vi.fn();
    const { result } = renderHook(() => usePersonalSync({
      sessionStatus: "signed-in",
      userId: "user-a",
      state: local,
      onReplaceState,
    }));

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toContain("malformed");
    expect(onReplaceState).toHaveBeenLastCalledWith(
      expect.objectContaining({ plan: expect.objectContaining({ name: "Known-good local plan" }) }),
    );
  });
});
