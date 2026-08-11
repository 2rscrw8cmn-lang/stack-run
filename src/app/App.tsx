import { useCallback, useEffect, useRef, useState } from "react";
import type { AvailabilityCalendar } from "../domain/availability";
import type { AppState, RunLog } from "../domain/types";
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
import { useConnectedSync } from "../features/connected/useConnectedSync";
import { accomplishmentsForAddedRuns, type AccomplishmentMoment as Moment } from "../domain/accomplishments";
import { AccomplishmentMoment } from "../components/ui/AccomplishmentMoment";
import { useRaceCrew } from "../crew/useRaceCrew";
import {
  forgetIntervalsApiKey,
  loadIntervalsApiKey,
  saveIntervalsApiKey,
} from "../storage/intervalsCredentialRepository";

export type TabId = "today" | "build" | "runs" | "crew" | "plan";

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
  const [intervalsApiKey, setIntervalsApiKey] = useState<string | null>(() => {
    try { return loadIntervalsApiKey(); } catch { return null; }
  });
  const [accomplishments, setAccomplishments] = useState<Moment[]>([]);
  const previousRunLogs = useRef<RunLog[]>(
    boot.kind === "ready" ? boot.state.runLogs : [],
  );

  const appState = boot.kind === "ready" ? boot.state : null;
  const raceCrew = useRaceCrew(appState);
  /**
   * Crew is a destination only while there is a crew to be in. Membership is
   * the account's to lose — signing out, leaving, or being removed all take it
   * away — so the tab is derived from it rather than remembered.
   */
  const crewAvailable =
    raceCrew.status === "signed-in" && Boolean(raceCrew.account?.crew);

  // Losing access while standing in the room has to put you somewhere real,
  // and Runs is the personal history the signed-out app has always had. The
  // correction happens during render rather than in an effect so the invalid
  // selection is never painted, and it is a real state change rather than a
  // derived override so signing back in restores the destination without
  // restoring the screen the user was thrown off.
  if (activeTab === "crew" && !crewAvailable) {
    setActiveTab("runs");
  }

  const setAppState = useCallback((next: (current: AppState) => AppState) => {
    setBoot((current) =>
      current.kind === "ready"
        ? { kind: "ready", state: next(current.state) }
        : current,
    );
  }, []);

  useEffect(() => onStorageWriteError((error) => setWriteError(error.message)), []);

  // A newly recorded run may cross a factual threshold. Compare the run-log
  // transition in memory, show the facts briefly, and never write a badge or
  // replay marker into schema 9.
  useEffect(() => {
    if (!appState) return;
    const prior = previousRunLogs.current;
    const priorIds = new Set(prior.map((run) => run.id));
    const added = appState.runLogs.filter((run) => !priorIds.has(run.id));
    previousRunLogs.current = appState.runLogs;
    if (added.length > 0) {
      setAccomplishments(
        accomplishmentsForAddedRuns(appState.plan, prior, added),
      );
    }
  }, [appState]);

  useEffect(() => {
    if (accomplishments.length === 0) return;
    const timer = window.setTimeout(() => setAccomplishments([]), 4200);
    return () => window.clearTimeout(timer);
  }, [accomplishments]);

  const saveCalendar = useCallback(
    (calendar: AvailabilityCalendar | null) =>
      setAppState((current) => saveAvailability(current, calendar)),
    [setAppState],
  );

  // A remembered roster is re-read once when the app opens, so blocked days
  // are as current as the calendar rather than as current as the last time
  // anybody tapped Refresh. Quiet on failure; the stored roster stands.
  useRosterRefresh(appState?.availability ?? null, saveCalendar);

  const recordSync = useCallback(
    (at: string) => setAppState((current) => saveIntervalsSync(current, at)),
    [setAppState],
  );

  // One sync for the whole app: Today offers what it found, Run Data reviews
  // the rest, and neither can be looking at a different answer than the other.
  const connectedSync = useConnectedSync({
    connection: intervalsApiKey
      ? { mode: "local-api-key", credential: intervalsApiKey }
      : syncToken
        ? { mode: "legacy-proxy", credential: syncToken }
        : null,
    state: appState,
    onSynced: recordSync,
  });

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
      crewAvailable={crewAvailable}
      notice={(writeError || accomplishments.length > 0) ? (
        <>
          {writeError && (
            <StorageWriteBanner
              message={writeError}
              onDismiss={() => setWriteError(null)}
            />
          )}
          <AccomplishmentMoment moments={accomplishments} />
        </>
      ) : undefined}
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
            // Source, the external link and the imported metrics are the
            // repository's to keep. Sending them from here overwrote them: a
            // corrected synced run came back marked `manual`, which put it
            // back in the pool of runs a *different* activity could be
            // attached to.
          }),
        )
      }
      onDeleteRun={(runLogId) =>
        setAppState((current) => {
          const run = current.runLogs.find((item) => item.id === runLogId);
          // Deleting a synced run is a statement about that activity, so it is
          // ignored without a second question. Asking, and treating Cancel as
          // "sync it again", meant the run the user had just deleted came back
          // on the next sync. Run Data still offers Clear ignored.
          const next =
            run?.externalSource?.provider === "intervals"
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
      intervalsConnection={
        intervalsApiKey
          ? { mode: "local-api-key", credential: intervalsApiKey }
          : syncToken
            ? { mode: "legacy-proxy", credential: syncToken }
            : null
      }
      connectedSync={connectedSync}
      raceCrew={raceCrew}
      onConnectIntervalsApiKey={(apiKey) => {
        try {
          saveIntervalsApiKey(apiKey);
          setIntervalsApiKey(apiKey.trim());
        } catch (error) {
          setWriteError(error instanceof Error ? error.message : "Connection could not be saved.");
        }
      }}
      onForgetIntervalsApiKey={() => {
        try {
          forgetIntervalsApiKey();
          setIntervalsApiKey(null);
        } catch (error) {
          setWriteError(error instanceof Error ? error.message : "Connection could not be forgotten.");
        }
      }}
      onConnectIntervals={(token) => { try { saveIntervalsSyncToken(token); setSyncToken(token); } catch (error) { setWriteError(error instanceof Error ? error.message : "Connection could not be saved."); } }}
      onForgetIntervals={() => { try { forgetIntervalsSyncToken(); setSyncToken(null); } catch (error) { setWriteError(error instanceof Error ? error.message : "Connection could not be forgotten."); } }}
      onImportIntervals={(candidate, workoutId, type, effort, notes) => setAppState((current) => acceptIntervalsRun(current, candidate, workoutId, type, effort, notes))}
      onAttachIntervals={(candidate, runLogId) => setAppState((current) => attachIntervalsRun(current, candidate, runLogId))}
      onIgnoreIntervals={(id) => setAppState((current) => ignoreIntervalsActivity(current, id))}
      onClearIgnoredIntervals={() => setAppState(clearIgnoredIntervalsActivities)}
    />
  );
}
