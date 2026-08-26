import { useMemo, useRef, useState } from "react";
import { AppShell } from "../app/AppShell.js";
import type { TabId } from "../app/App.js";
import type { PlacementRequest } from "../features/build/BuildScreen.js";
import type { ConnectedSync } from "../features/connected/useConnectedSync.js";
import type { RunnerHistory } from "../features/runs/useRunnerHistory.js";
import type { ValidRunEntry } from "../features/run-entry/runValidation.js";
import { SourceDetailReaderProvider } from "../connected/sourceDetail.js";
import { useRaceCrew } from "../crew/useRaceCrew.js";
import { todayLocalDate } from "../domain/dates.js";
import type { AppState, RunLog, TrainingPlan, Workout } from "../domain/types.js";
import { unifiedRunnerHistory } from "../history/runnerRun.js";
import {
  createQaRunnerAppState,
  qaPlanLifecycleFrom,
  qaRunnerHistoricalActivities,
  QA_PLAN_LIFECYCLES,
} from "./qaRunner.js";
import { qaSourceDetailReaderFor } from "./qaSourceDetail.js";
import "./qaRunner.css";

/** Short enough for the notice row on a 320px phone. */
const QA_LIFECYCLE_LINK_LABEL = {
  active: "Active",
  "before-plan": "Before",
  "after-race": "After",
} as const;

const EMPTY_CONNECTED_SYNC: ConnectedSync = {
  candidates: [],
  status: "idle",
  error: null,
  sync: async () => undefined,
  findOlderRuns: async () => null,
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
  /**
   * NEXT-5 review states. The harness could only ever show an active plan, so
   * `Plan starts…` and `Plan complete` were unreviewable on a device. The URL
   * chooses which side of the plan window the same synthetic runner stands on;
   * the fixture already resets on reload, so switching by link is the whole
   * mechanism.
   */
  const lifecycle = qaPlanLifecycleFrom(
    typeof window === "undefined" ? null : window.location.search,
  );
  const initial = useMemo(
    () => createQaRunnerAppState(today, lifecycle),
    [today, lifecycle],
  );
  const activities = useMemo(
    () => qaRunnerHistoricalActivities(today, lifecycle),
    [today, lifecycle],
  );
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
      plan: createQaRunnerAppState(today, lifecycle).plan,
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
            <nav className="qa-runner-notice__states" aria-label="Plan lifecycle review state">
              {QA_PLAN_LIFECYCLES.map((state) => (
                <a
                  key={state}
                  href={state === "active" ? "?" : `?qa=${state}`}
                  aria-current={state === lifecycle ? "page" : undefined}
                >
                  {QA_LIFECYCLE_LINK_LABEL[state]}
                </a>
              ))}
            </nav>
          </div>
        }
        plan={state.plan}
        planHistory={state.planHistory}
        runLogs={state.runLogs}
        blockPlacements={state.blockPlacements}
        onSaveRun={saveRun}
        onDeleteRun={deleteRun}
        onLinkRun={linkRun}
        onUnlinkRun={unlinkRun}
        onEditPlan={editPlan}
        onResetPlan={resetPlan}
        onFinishPlan={() =>
          setState((current) => ({ ...current, plan: null, raceSetup: null }))
        }
        availability={state.availability}
        onSaveAvailability={(availability) =>
          setState((current) => ({ ...current, availability }))
        }
        runDays={state.runDays}
        onSaveRunDays={(runDays, plan) =>
          setState((current) => ({ ...current, runDays, plan }))
        }
        crossTrainingDays={state.crossTrainingDays}
        onSaveCrossTrainingDays={(crossTrainingDays, plan) =>
          setState((current) => ({ ...current, crossTrainingDays, plan }))
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
