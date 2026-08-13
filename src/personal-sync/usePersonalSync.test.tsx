import { act, renderHook, waitFor } from "@testing-library/react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RunLog } from "../domain/types";
import { createInitialAppState } from "../storage/migrations";
import type { PersonalCloudSnapshot } from "./types";

const cloud = vi.hoisted(() => ({
  initialize: vi.fn(),
  load: vi.fn(),
  saveRun: vi.fn(),
  saveBuild: vi.fn(),
  saveIntervals: vi.fn(),
  saveTraining: vi.fn(),
  deleteRun: vi.fn(),
  reset: vi.fn(),
  reconcileCrew: vi.fn(),
}));

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
    deletePersonalRun: cloud.deleteRun,
    resetPersonalCloud: cloud.reset,
    reconcileCrewRunIdentity: cloud.reconcileCrew,
  };
});

import { usePersonalSync } from "./usePersonalSync";

const at = "2026-08-10T12:00:00.000Z";

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

function snapshot(runLogs: RunLog[] = []): PersonalCloudSnapshot {
  const seed = createInitialAppState();
  return {
    training: {
      settings: seed.settings,
      plan: { ...seed.plan, name: "Canonical cloud plan" },
      raceSetup: seed.raceSetup,
      availability: seed.availability,
      runDays: seed.runDays,
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

beforeEach(() => {
  localStorage.clear();
  Object.values(cloud).forEach((mock) => mock.mockReset());
  cloud.initialize.mockResolvedValue(undefined);
  cloud.saveBuild.mockResolvedValue(2);
  cloud.saveIntervals.mockResolvedValue(2);
  cloud.saveTraining.mockResolvedValue(2);
  cloud.reconcileCrew.mockResolvedValue(undefined);
});

describe("personal sync lifecycle", () => {
  it("requires first-device confirmation, backs up, uploads without a credential, then rehydrates from the server", async () => {
    const local = structuredClone(createInitialAppState());
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
    const local = structuredClone(createInitialAppState());
    local.runLogs = [legacy];
    const onReplaceState = vi.fn();

    const { result } = renderHook(() => usePersonalSync({
      sessionStatus: "signed-in",
      userId: "user-a",
      state: local,
      onReplaceState,
    }));

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(cloud.saveRun).toHaveBeenCalledWith(expect.anything(), 0, legacy);
    expect(cloud.reconcileCrew).toHaveBeenCalledWith(
      expect.anything(),
      "canonical-run",
      ["legacy-device-run"],
    );
    expect(onReplaceState).toHaveBeenLastCalledWith(
      expect.objectContaining({ runLogs: [expect.objectContaining({ id: "canonical-run" })] }),
    );
  });
});
