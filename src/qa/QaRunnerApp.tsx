import { useMemo, useRef, useState } from "react";
import { AppShell } from "../app/AppShell";
import type { TabId } from "../app/App";
import type { PlacementRequest } from "../features/build/BuildScreen";
import type { ConnectedSync } from "../features/connected/useConnectedSync";
import type { RunnerHistory } from "../features/runs/useRunnerHistory";
import type { ValidRunEntry } from "../features/run-entry/runValidation";
import { SourceDetailReaderProvider } from "../connected/sourceDetail";
import { useRaceCrew } from "../crew/useRaceCrew";
import { todayLocalDate } from "../domain/dates";
import type { AppState, RunLog, TrainingPlan, Workout } from "../domain/types";
import { unifiedRunnerHistory } from "../history/runnerRun";
import {
  createQaRunnerAppState,
  qaRunnerHistoricalActivities,
} from "./qaRunner";
import { qaSourceDetailReaderFor } from "./qaSourceDetail";
import "./qaRunner.css";

const EMPTY_CONNECTED_SYNC: ConnectedSync = {
  candidates: [],
  status: "idle",
  error: null,
  sync: async () => undefined,
  findOlderRuns: async () => null,
  dismiss: () => undefined,
  settle: () => undefined,
};

function replaceRun(
  runLogs: readonly RunLog[],
  runLogId: string,
  next: (run: RunLog) => RunLog,
): RunLog[] {
  return runLogs.map((run) => (run.id === runLogId ? next(run) : run));
}

/**
 * A whole-app review harness selected by the authenticated QA account.
 *
 * Unlike the old screen-level demo flags, every destination below receives the
 * same state and the same unified history. The fixture is in memory only and
 * resets on reload, which makes review repeatable and prevents synthetic data
 * from entering the owner's personal account or the historical mirror.
 *
 * R3 adds one injection: the external source-detail reader. `intervalsConnection`
 * stays null — the harness has no credential and makes no request — but Run
 * Detail's on-demand reads now go through a boundary, so a synthetic reader can
 * answer them and the real Run Profile presentation becomes reviewable. The
 * production reader is the context default, so nothing outside this harness is
 * affected by the substitution.
 */
export function QaRunnerApp() {
  const today = todayLocalDate();
  const initial = useMemo(() => createQaRunnerAppState(today), [today]);
  const activities = useMemo(() => qaRunnerHistoricalActivities(today), [today]);
  const [state, setState] = useState<AppState>(initial);
  const [activeTab, setActiveTab] = useState<TabId>("today");
  const [placingRunLogId, setPlacingRunLogId] = useState<string | null>(null);
  const manualId = useRef(0);
  const raceCrew = useRaceCrew(state);

  const runnerHistory = useMemo<RunnerHistory>(
    () => ({
      activities,
      runs: unifiedRunnerHistory({
        activities,
        runLogs: state.runLogs,
        blockPlacements: state.blockPlacements,
      }),
      phase: "fresh",
      lastCompleteAt: `${today}T12:00:00.000Z`,
      error: null,
      refresh: async () => undefined,
    }),
    [activities, state.blockPlacements, state.runLogs, today],
  );

  const crewAvailable =
    raceCrew.status === "signed-in" && Boolean(raceCrew.account?.crew);

  function saveRun(
    workout: Workout | null,
    values: ValidRunEntry,
    runLogId?: string,
  ) {
    setState((current) => {
      const existing = runLogId
        ? current.runLogs.find((run) => run.id === runLogId) ?? null
        : null;
      const now = new Date().toISOString();
      const id = existing?.id ?? `qa-manual-${++manualId.current}`;
      const nextRun: RunLog = {
        id,
        workoutId: workout?.id ?? existing?.workoutId ?? null,
        ...values,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        source: existing?.source ?? "manual",
        externalSource: existing?.externalSource ?? null,
        importedMetrics: existing?.importedMetrics ?? null,
      };
      const runLogs = existing
        ? current.runLogs.map((run) => (run.id === existing.id ? nextRun : run))
        : [...current.runLogs, nextRun];
      return { ...current, runLogs };
    });
  }

  function deleteRun(runLogId: string) {
    setState((current) => ({
      ...current,
      runLogs: current.runLogs.filter((run) => run.id !== runLogId),
      blockPlacements: current.blockPlacements.filter(
        (placement) => placement.runLogId !== runLogId,
      ),
    }));
  }

  function linkRun(runLogId: string, workoutId: string) {
    setState((current) => ({
      ...current,
      runLogs: current.runLogs.map((run) => {
        if (run.id === runLogId) return { ...run, workoutId };
        if (run.workoutId === workoutId) return { ...run, workoutId: null };
        return run;
      }),
    }));
  }

  function unlinkRun(runLogId: string) {
    setState((current) => ({
      ...current,
      runLogs: replaceRun(current.runLogs, runLogId, (run) => ({
        ...run,
        workoutId: null,
      })),
    }));
  }

  function placeBlock(request: PlacementRequest) {
    setState((current) => ({
      ...current,
      blockPlacements: [
        ...current.blockPlacements.filter(
          (placement) => placement.runLogId !== request.runLogId,
        ),
        {
          ...request,
          placedAt: new Date().toISOString(),
        },
      ],
    }));
  }

  function resetPlan() {
    setState((current) => ({
      ...current,
      plan: createQaRunnerAppState(today).plan,
    }));
  }

  function editPlan(plan: TrainingPlan) {
    setState((current) => ({ ...current, plan }));
  }

  return (
    <SourceDetailReaderProvider value={qaSourceDetailReaderFor}>
      <AppShell
        activeTab={activeTab}
        onTabChange={setActiveTab}
        crewAvailable={crewAvailable}
        onReplayTour={() => setActiveTab("today")}
        notice={
          <div className="qa-runner-notice" role="status">
            <strong>QA RUNNER</strong>
            <span>Synthetic review data · resets on reload</span>
          </div>
        }
        plan={state.plan}
        runLogs={state.runLogs}
        blockPlacements={state.blockPlacements}
        onSaveRun={saveRun}
        onDeleteRun={deleteRun}
        onLinkRun={linkRun}
        onUnlinkRun={unlinkRun}
        onEditPlan={editPlan}
        onResetPlan={resetPlan}
        availability={state.availability}
        onSaveAvailability={(availability) =>
          setState((current) => ({ ...current, availability }))
        }
        runDays={state.runDays}
        onSaveRunDays={(runDays, plan) =>
          setState((current) => ({ ...current, runDays, plan }))
        }
        raceSetup={state.raceSetup}
        onGeneratePlan={(raceSetup, plan) =>
          setState((current) => ({ ...current, raceSetup, plan }))
        }
        onPlaceBlock={placeBlock}
        placingRunLogId={placingRunLogId}
        onPlacingChange={setPlacingRunLogId}
        appState={state}
        syncToken={null}
        intervalsConnection={null}
        connectedSync={EMPTY_CONNECTED_SYNC}
        onConnectIntervals={() => undefined}
        onForgetIntervals={() => undefined}
        onConnectIntervalsApiKey={() => undefined}
        onForgetIntervalsApiKey={() => undefined}
        raceCrew={raceCrew}
        runnerHistory={runnerHistory}
        onImportIntervals={() => undefined}
        onAttachIntervals={() => undefined}
        onIgnoreIntervals={(externalId) =>
          setState((current) => ({
            ...current,
            intervalsSync: {
              ...current.intervalsSync,
              ignoredActivityIds: Array.from(
                new Set([...current.intervalsSync.ignoredActivityIds, externalId]),
              ),
            },
          }))
        }
        onClearIgnoredIntervals={() =>
          setState((current) => ({
            ...current,
            intervalsSync: {
              ...current.intervalsSync,
              ignoredActivityIds: [],
            },
          }))
        }
      />
    </SourceDetailReaderProvider>
  );
}
