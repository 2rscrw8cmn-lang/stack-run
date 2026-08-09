import { useCallback, useEffect, useState } from "react";
import type { AvailabilityCalendar } from "../domain/availability";
import type { AppState } from "../domain/types";
import {
  deleteRunLog,
  loadAppState,
  onStorageWriteError,
  placeBlock,
  readBackup,
  resetAppState,
  saveAvailability,
  savePlan,
  saveGeneratedPlan,
  saveRunDays,
  saveRunLog,
  StorageLoadError,
  acceptIntervalsRun,
  attachIntervalsRun,
  saveIntervalsSync,
  ignoreIntervalsActivity,
  clearIgnoredIntervalsActivities,
} from "../storage/appStateRepository";
import type { ValidRunEntry } from "../features/run-entry/runValidation";
import { createInitialAppState } from "../storage/migrations";
import { StorageRecoveryScreen } from "../features/recovery/StorageRecoveryScreen";
import { StorageWriteBanner } from "../features/recovery/StorageWriteBanner";
import { useRosterRefresh } from "../features/availability/useRosterRefresh";
import { AppShell } from "./AppShell";
import { forgetIntervalsSyncToken, loadIntervalsSyncToken, saveIntervalsSyncToken } from "../storage/intervalsTokenRepository";

export type TabId = "today" | "build" | "plan";

/**
 * Either an app, or the reason there isn't one.
 *
 * Loading used to swallow a failure and hand back a fresh state, which meant
 * a browser that could not read its own storage looked exactly like a browser
 * that had never been used — and quietly overwrote whatever was really there
 * on the first save. Recovery is a state of the app, not a caught exception.
 */
type BootState =
  | { kind: "ready"; state: AppState }
  | { kind: "recovering"; error: StorageLoadError };

function readBootState(): BootState {
  try {
    return { kind: "ready", state: loadAppState() };
  } catch (error) {
    if (error instanceof StorageLoadError) {
      return { kind: "recovering", error };
    }
    throw error;
  }
}

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>("today");
  const [placingRunLogId, setPlacingRunLogId] = useState<string | null>(null);
  const [boot, setBoot] = useState<BootState>(readBootState);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [syncToken, setSyncToken] = useState<string | null>(() => { try { return loadIntervalsSyncToken(); } catch { return null; } });

  const appState = boot.kind === "ready" ? boot.state : null;

  const setAppState = useCallback((next: (current: AppState) => AppState) => {
    setBoot((current) =>
      current.kind === "ready"
        ? { kind: "ready", state: next(current.state) }
        : current,
    );
  }, []);

  useEffect(() => onStorageWriteError((error) => setWriteError(error.message)), []);

  const saveCalendar = useCallback(
    (calendar: AvailabilityCalendar | null) =>
      setAppState((current) => saveAvailability(current, calendar)),
    [setAppState],
  );

  // A remembered roster is re-read once when the app opens, so blocked days
  // are as current as the calendar rather than as current as the last time
  // anybody tapped Refresh. Quiet on failure; the stored roster stands.
  useRosterRefresh(appState?.availability ?? null, saveCalendar);

  if (boot.kind === "recovering") {
    return (
      <StorageRecoveryScreen
        reason={boot.error.reason}
        detail={boot.error.message}
        backupKey={boot.error.backupKey}
        onReadBackup={readBackup}
        onStartFresh={() => setBoot({ kind: "ready", state: resetAppState() })}
        // Nothing was readable, so there is nothing to preserve and nothing to
        // write; this is the same seed plan, held in memory for one session.
        onContinueAnyway={() =>
          setBoot({ kind: "ready", state: createInitialAppState() })
        }
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <AppShell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      notice={
        writeError && (
          <StorageWriteBanner
            message={writeError}
            onDismiss={() => setWriteError(null)}
          />
        )
      }
      plan={boot.state.plan}
      runLogs={boot.state.runLogs}
      blockPlacements={boot.state.blockPlacements}
      onSaveRun={(workout, values: ValidRunEntry, runLogId?: string) =>
        setAppState((current) =>
          saveRunLog(current, {
            // Editing an extra run needs its own id: it has no workout to be
            // found by. A scheduled run is still found by its workout.
            id: runLogId,
            workoutId: workout?.id ?? null,
            ...values,
            source: "manual",
            externalSource: null,
            importedMetrics: null,
          }),
        )
      }
      onDeleteRun={(runLogId) =>
        setAppState((current) => {
          const run = current.runLogs.find((item) => item.id === runLogId);
          const next = run?.externalSource?.provider === "intervals" && window.confirm("Keep this synced activity ignored so it does not return on the next sync?")
            ? ignoreIntervalsActivity(current, run.externalSource.activityId)
            : current;
          return deleteRunLog(next, runLogId);
        })
      }
      availability={boot.state.availability}
      onSaveAvailability={saveCalendar}
      raceSetup={boot.state.raceSetup}
      onGeneratePlan={(setup, plan) =>
        setAppState((current) => saveGeneratedPlan(current, setup, plan))
      }
      runDays={boot.state.runDays}
      onSaveRunDays={(runDays, plan) =>
        setAppState((current) => saveRunDays(current, runDays, plan))
      }
      onEditPlan={(plan) => setAppState((current) => savePlan(current, plan))}
      onResetPlan={() => setBoot({ kind: "ready", state: resetAppState() })}
      onPlaceBlock={(request) =>
        setAppState((current) => placeBlock(current, request))
      }
      placingRunLogId={placingRunLogId}
      onPlacingChange={setPlacingRunLogId}
      appState={boot.state}
      syncToken={syncToken}
      onConnectIntervals={(token) => { try { saveIntervalsSyncToken(token); setSyncToken(token); } catch (error) { setWriteError(error instanceof Error ? error.message : "Connection could not be saved."); } }}
      onForgetIntervals={() => { try { forgetIntervalsSyncToken(); setSyncToken(null); } catch (error) { setWriteError(error instanceof Error ? error.message : "Connection could not be forgotten."); } }}
      onIntervalsSynced={(at) => setAppState((current) => saveIntervalsSync(current, at))}
      onImportIntervals={(candidate, workoutId, type, effort, notes) => setAppState((current) => acceptIntervalsRun(current, candidate, workoutId, type, effort, notes))}
      onAttachIntervals={(candidate, runLogId) => setAppState((current) => attachIntervalsRun(current, candidate, runLogId))}
      onIgnoreIntervals={(id) => setAppState((current) => ignoreIntervalsActivity(current, id))}
      onClearIgnoredIntervals={() => setAppState(clearIgnoredIntervalsActivities)}
    />
  );
}
