import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { AvailabilityCalendar } from "../domain/availability";
import type { AppState, BlockPlacement, RunLog } from "../domain/types";
import {
  deleteRunLog,
  linkRunLogToWorkout,
  loadAppState,
  onStorageWriteError,
  placeBlock,
  readBackup,
  resetAppState,
  saveAvailability,
  savePlan,
  saveGeneratedPlan,
  finishActivePlan,
  saveRunDays,
  saveCrossTrainingDays,
  saveRunLog,
  StorageLoadError,
  acceptIntervalsRun,
  attachIntervalsRun,
  saveIntervalsSync,
  recordImportedBest5k,
  ignoreIntervalsActivity,
  clearIgnoredIntervalsActivities,
  unlinkRunLogFromWorkout,
  hasStoredAppState,
} from "../storage/appStateRepository";
import type { ValidRunEntry } from "../features/run-entry/runValidation";
import { createInitialAppState } from "../storage/migrations";
import { StorageRecoveryScreen } from "../features/recovery/StorageRecoveryScreen";
import { StorageWriteBanner } from "../features/recovery/StorageWriteBanner";
import { useRosterRefresh } from "../features/availability/useRosterRefresh";
import { AppShell } from "./AppShell";
import { forgetIntervalsSyncToken, loadIntervalsSyncToken, saveIntervalsSyncToken } from "../storage/intervalsTokenRepository";
import { useConnectedSync } from "../features/connected/useConnectedSync";
import { useBest5kEnrichment } from "../features/connected/useBest5kEnrichment";
import { accomplishmentsForAddedRuns, type AccomplishmentMoment as Moment } from "../domain/accomplishments";
import { AccomplishmentMoment } from "../components/ui/AccomplishmentMoment";
import { useRaceCrew } from "../crew/useRaceCrew";
import { CrewInviteLanding } from "../features/crew/CrewInviteLanding";
import {
  forgetIntervalsApiKey,
  loadIntervalsApiKey,
  saveIntervalsApiKey,
} from "../storage/intervalsCredentialRepository";
import {
  loadOnboarding,
  saveOnboarding,
  type OnboardingSnapshot,
  type OnboardingState,
} from "../storage/onboardingRepository";
import { WelcomeSheet } from "../features/onboarding/WelcomeSheet";
import { TourCoachmark } from "../features/onboarding/TourCoachmark";
import { usePersonalSync } from "../personal-sync/usePersonalSync";
import { useRunnerHistory } from "../features/runs/useRunnerHistory";

export type TabId = "today" | "build" | "runs" | "crew" | "plan";

/** Stable empties, so a boot state with no app yet does not churn the history hook. */
const NO_RUN_LOGS: RunLog[] = [];
const NO_BLOCK_PLACEMENTS: BlockPlacement[] = [];

/**
 * Either an app, or the reason there isn't one.
 *
 * Loading used to swallow a failure and hand back a fresh state, which meant
 * a browser that could not read its own storage looked exactly like a browser
 * that had never been used — and quietly overwrote whatever was really there
 * on the first save. Recovery is a state of the app, not a caught exception.
 */
type BootState =
  | { kind: "ready"; state: AppState; isNew: boolean }
  | { kind: "recovering"; error: StorageLoadError };

function readBootState(): BootState {
  const isNew = !hasStoredAppState();
  try {
    return { kind: "ready", state: loadAppState(), isNew };
  } catch (error) {
    if (error instanceof StorageLoadError) {
      return { kind: "recovering", error };
    }
    throw error;
  }
}

const CORE_TOUR: ReadonlyArray<{ tab: TabId; title: string; copy: string }> = [
  { tab: "runs", title: "Runs", copy: "See what actually happened. Log runs here or connect Run Data." },
  { tab: "build", title: "Build", copy: "Every run you record earns a block. Place it to build your race." },
  { tab: "plan", title: "Plan", copy: "Race intent is optional. Set up a race when you want a schedule." },
  { tab: "today", title: "Today", copy: "Start here for today's workout and what matters now." },
];

export function App() {
  const [boot, setBoot] = useState<BootState>(readBootState);
  const [initialOnboarding] = useState<OnboardingSnapshot>(loadOnboarding);
  const initialLegacyPending =
    boot.kind === "ready" && !boot.isNew && !initialOnboarding.exists;
  const initialTourStep =
    !initialLegacyPending &&
    initialOnboarding.state.introSeen &&
    !initialOnboarding.state.coreTourCompleted
      ? 0
      : null;
  const [activeTab, setActiveTab] = useState<TabId>(
    initialTourStep === null ? "today" : CORE_TOUR[initialTourStep].tab,
  );
  const [placingRunLogId, setPlacingRunLogId] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingState>(
    initialOnboarding.state,
  );
  const [legacyOnboardingPending, setLegacyOnboardingPending] =
    useState(initialLegacyPending);
  const [tourStep, setTourStep] = useState<number | null>(initialTourStep);
  const [writeError, setWriteError] = useState<string | null>(null);
  // Credential scope is selected only after auth identifies the current
  // account. Starting empty prevents even a transient render of the previous
  // account's device-local Intervals connection.
  const [syncToken, setSyncToken] = useState<string | null>(null);
  const [intervalsApiKey, setIntervalsApiKey] = useState<string | null>(null);
  const [accomplishments, setAccomplishments] = useState<Moment[]>([]);
  const previousRunLogs = useRef<RunLog[]>(
    boot.kind === "ready" ? boot.state.runLogs : [],
  );

  const appState = boot.kind === "ready" ? boot.state : null;
  const raceCrew = useRaceCrew(appState);
  const replacePersonalState = useCallback((next: AppState) => {
    previousRunLogs.current = next.runLogs;
    setBoot((current) => ({
      kind: "ready",
      state: next,
      isNew: current.kind === "ready" ? current.isNew : false,
    }));
  }, []);
  const personalSync = usePersonalSync({
    // Crew profile/dashboard reads may still be loading after Supabase has
    // already identified the account. Personal cache ownership must switch at
    // that earlier boundary.
    sessionStatus: raceCrew.userId ? "signed-in" : raceCrew.status,
    userId: raceCrew.userId ?? null,
    state: appState ?? createInitialAppState(),
    onReplaceState: replacePersonalState,
  });
  /**
   * Crew is a destination while the authenticated account still has a known
   * active membership. Supabase can briefly report `loading` while refreshing
   * the same signed-in session; that transient state must not hide the Crew
   * tab or kick the runner back to Runs.
   */
  const crewAvailable = Boolean(raceCrew.userId && raceCrew.account?.crew);
  const raceCrewUserId = raceCrew.userId;
  const refreshCrewData = raceCrew.refreshCrewData;
  const notePersonalSyncReady = raceCrew.notePersonalSyncReady;

  function persistOnboarding(next: OnboardingState) {
    setOnboarding(next);
    saveOnboarding(next);
  }

  // Existing personal users upgrade quietly. If they already belong to a
  // Crew, that existing membership is not misread as a brand-new join.
  useEffect(() => {
    if (!legacyOnboardingPending || raceCrew.status === "loading") return;
    queueMicrotask(() => {
      setLegacyOnboardingPending(false);
      persistOnboarding({
        version: 1,
        introSeen: true,
        coreTourCompleted: true,
        crewTourSeen: crewAvailable,
      });
    });
  }, [crewAvailable, legacyOnboardingPending, raceCrew.status]);

  // Losing access while standing in Crew returns to personal Runs. State
  // correction belongs in an effect; React render remains side-effect free.
  // The visible tab is derived immediately below so the inaccessible screen is
  // never painted while the scheduled state correction catches up.
  useEffect(() => {
    if (activeTab !== "crew" || crewAvailable) return;
    queueMicrotask(() => setActiveTab("runs"));
  }, [activeTab, crewAvailable]);

  const visibleActiveTab =
    activeTab === "crew" && !crewAvailable ? "runs" : activeTab;

  const setAppState = useCallback((next: (current: AppState) => AppState) => {
    setBoot((current) =>
      current.kind === "ready"
        ? (() => {
            const updated = next(current.state);
            personalSync.recordMutation(current.state, updated);
            return { kind: "ready" as const, state: updated, isNew: current.isNew };
          })()
        : current,
    );
  }, [personalSync]);

  useLayoutEffect(() => {
    const accountId = raceCrewUserId;
    queueMicrotask(() => {
      try {
        setIntervalsApiKey(loadIntervalsApiKey(accountId ?? null));
        setSyncToken(loadIntervalsSyncToken(accountId ?? null));
      } catch {
        setIntervalsApiKey(null);
        setSyncToken(null);
      }
    });
  }, [raceCrewUserId]);

  // The account's personal cache has just become canonical on this device.
  // Crew sharing may have stood down at join time waiting for exactly that, so
  // publish the projection it could not publish before reading the crew back —
  // otherwise existing runs stay invisible to the crew until something
  // unrelated changes and triggers a later sync.
  useEffect(() => {
    if (!personalSync.initialized || !raceCrewUserId) return;
    void notePersonalSyncReady().then(() => refreshCrewData(true));
  }, [
    notePersonalSyncReady,
    personalSync.initialized,
    raceCrewUserId,
    refreshCrewData,
  ]);

  useEffect(() => onStorageWriteError((error) => setWriteError(error.message)), []);

  // A newly recorded run may cross a factual threshold. Compare the run-log
  // transition in memory, show the facts briefly, and never write a badge or
  // replay marker into persisted state.
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

  const intervalsConnection = intervalsApiKey
    ? ({ mode: "local-api-key", credential: intervalsApiKey } as const)
    : syncToken
      ? ({ mode: "legacy-proxy", credential: syncToken } as const)
      : null;

  // One sync for the whole app: Today offers what it found, Run Data reviews
  // the rest, and neither can be looking at a different answer than the other.
  const connectedSync = useConnectedSync({
    connection: intervalsConnection,
    state: appState,
    onSynced: recordSync,
    accountId: raceCrew.userId ?? null,
    pendingSeed: personalSync.pendingCandidates,
    onPendingChanged: personalSync.recordPendingCandidates,
  });

  /**
   * Source-verified best 5K times for runs already imported.
   *
   * Deliberately downstream of the sync above and of nothing else: the pass is
   * bounded, silent and optional, and a run with no 5K is a complete run. See
   * `src/connected/best5k.ts` for why this is not folded into ordinary sync.
   */
  const recordBest5k = useCallback(
    (secondsByRunLogId: ReadonlyMap<string, number>) =>
      setAppState((current) => recordImportedBest5k(current, secondsByRunLogId)),
    [setAppState],
  );
  useBest5kEnrichment({
    connection: intervalsConnection,
    runLogs: appState?.runLogs ?? NO_RUN_LOGS,
    accountId: raceCrew.userId ?? null,
    onBest5kFound: recordBest5k,
  });

  /**
   * The runner's history, which is a different question from the review queue
   * above and is answered on its own conservative schedule. It never blocks:
   * a device with no connection, a failed read and a browser that refuses to
   * store all leave a fully usable app and a history built from STACK's own
   * runs. See `src/history/historySyncPolicy.ts` for when it reads at all.
   */
  const runnerHistory = useRunnerHistory({
    connection: intervalsConnection,
    accountId: raceCrew.userId ?? null,
    runLogs: appState?.runLogs ?? NO_RUN_LOGS,
    blockPlacements: appState?.blockPlacements ?? NO_BLOCK_PLACEMENTS,
  });

  if (boot.kind === "recovering") {
    return (
      <StorageRecoveryScreen
        reason={boot.error.reason}
        detail={boot.error.message}
        backupKey={boot.error.backupKey}
        onReadBackup={readBackup}
        onStartFresh={() => setBoot({ kind: "ready", state: resetAppState(), isNew: false })}
        // Nothing was readable, so there is nothing to preserve and nothing to
        // write; this is the same seed plan, held in memory for one session.
        onContinueAnyway={() =>
          setBoot({ kind: "ready", state: createInitialAppState(), isNew: false })
        }
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (raceCrew.configured && raceCrew.status === "loading" && !raceCrew.userId) {
    return (
      <main className="app-loading" aria-live="polite">
        <p>Loading your STACK…</p>
      </main>
    );
  }
  if (raceCrew.userId && personalSync.status === "loading") {
    return (
      <main className="app-loading" aria-live="polite">
        <p>Loading personal data…</p>
      </main>
    );
  }

  if (raceCrew.pendingInvite) {
    return (
      <CrewInviteLanding
        crew={raceCrew}
        localRace={boot.state.plan?.race ?? null}
        onOpenCrew={() => setActiveTab("crew")}
      />
    );
  }

  const tour = tourStep === null ? null : CORE_TOUR[tourStep] ?? null;
  const welcomeOpen =
    boot.isNew && !legacyOnboardingPending && !onboarding.introSeen;
  const crewTourOpen =
    tour === null &&
    onboarding.introSeen &&
    onboarding.coreTourCompleted &&
    crewAvailable &&
    visibleActiveTab === "crew" &&
    !onboarding.crewTourSeen;

  return (
    <>
    <AppShell
      activeTab={visibleActiveTab}
      onTabChange={setActiveTab}
      crewAvailable={crewAvailable}
      onReplayTour={() => {
        setActiveTab(CORE_TOUR[0].tab);
        setTourStep(0);
      }}
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
      planHistory={boot.state.planHistory}
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
      onDeleteRun={(runLogId) => {
        const current = boot.state;
        const run = current.runLogs.find((item) => item.id === runLogId);
        // Deleting a synced run is a statement about that activity, so it is
        // ignored without a second question. Asking, and treating Cancel as
        // "sync it again", meant the run the user had just deleted came back
        // on the next sync. Run Data still offers Clear ignored.
        const next =
          run?.externalSource?.provider === "intervals"
            ? ignoreIntervalsActivity(current, run.externalSource.activityId)
            : current;
        const deleted = deleteRunLog(next, runLogId);
        personalSync.recordMutation(current, deleted);
        setBoot({ kind: "ready", state: deleted, isNew: boot.isNew });
        // Personal deletion is already durable above. Crew cleanup is a
        // separate best-effort projection event and can never restore it.
        if (deleted !== current) {
          void raceCrew.deleteRunContribution(runLogId);
        }
      }}
      onLinkRun={(runLogId, workoutId) =>
        setAppState((current) => linkRunLogToWorkout(current, runLogId, workoutId))
      }
      onUnlinkRun={(runLogId) =>
        setAppState((current) => unlinkRunLogFromWorkout(current, runLogId))
      }
      availability={boot.state.availability}
      onSaveAvailability={saveCalendar}
      raceSetup={boot.state.raceSetup}
      onGeneratePlan={(setup, plan) =>
        setAppState((current) => saveGeneratedPlan(current, setup, plan))
      }
      onFinishPlan={() => setAppState((current) => finishActivePlan(current))}
      runDays={boot.state.runDays}
      onSaveRunDays={(runDays, plan) =>
        setAppState((current) => saveRunDays(current, runDays, plan))
      }
      crossTrainingDays={boot.state.crossTrainingDays}
      onSaveCrossTrainingDays={(crossTrainingDays, plan) =>
        setAppState((current) => saveCrossTrainingDays(current, crossTrainingDays, plan))
      }
      onEditPlan={(plan) => setAppState((current) => savePlan(current, plan))}
      onResetPlan={() => {
        const fresh = resetAppState();
        setBoot({ kind: "ready", state: fresh, isNew: false });
        if (personalSync.initialized) void personalSync.resetAccount(fresh);
      }}
      onPlaceBlock={(request) =>
        setAppState((current) => placeBlock(current, request))
      }
      placingRunLogId={placingRunLogId}
      onPlacingChange={setPlacingRunLogId}
      appState={boot.state}
      syncToken={syncToken}
      intervalsConnection={intervalsConnection}
      connectedSync={connectedSync}
      raceCrew={raceCrew}
      personalSync={personalSync}
      runnerHistory={runnerHistory}
      onConnectIntervalsApiKey={(apiKey) => {
        try {
          saveIntervalsApiKey(apiKey, raceCrew.userId ?? null);
          setIntervalsApiKey(apiKey.trim());
        } catch (error) {
          setWriteError(error instanceof Error ? error.message : "Connection could not be saved.");
        }
      }}
      onForgetIntervalsApiKey={() => {
        try {
          forgetIntervalsApiKey(raceCrew.userId ?? null);
          // Pending review is personal account data. Forgetting a credential
          // removes only this device's ability to fetch anything new.
          setIntervalsApiKey(null);
        } catch (error) {
          setWriteError(error instanceof Error ? error.message : "Connection could not be forgotten.");
        }
      }}
      onConnectIntervals={(token) => { try { saveIntervalsSyncToken(token, raceCrew.userId ?? null); setSyncToken(token); } catch (error) { setWriteError(error instanceof Error ? error.message : "Connection could not be saved."); } }}
      onForgetIntervals={() => { try { forgetIntervalsSyncToken(raceCrew.userId ?? null); setSyncToken(null); } catch (error) { setWriteError(error instanceof Error ? error.message : "Connection could not be forgotten."); } }}
      onImportIntervals={(candidate, workoutId, type, effort, notes) => setAppState((current) => acceptIntervalsRun(current, candidate, workoutId, type, effort, notes))}
      onAttachIntervals={(candidate, runLogId) => setAppState((current) => attachIntervalsRun(current, candidate, runLogId))}
      onIgnoreIntervals={(id) => setAppState((current) => ignoreIntervalsActivity(current, id))}
      onClearIgnoredIntervals={() => setAppState(clearIgnoredIntervalsActivities)}
    />
    <WelcomeSheet
      isOpen={welcomeOpen}
      onGetStarted={() => {
        persistOnboarding({ ...onboarding, introSeen: true });
        setActiveTab(CORE_TOUR[0].tab);
        setTourStep(0);
      }}
      onDismiss={() =>
        persistOnboarding({
          ...onboarding,
          introSeen: true,
          coreTourCompleted: true,
        })
      }
    />
    {tour && (
      <TourCoachmark
        title={tour.title}
        copy={tour.copy}
        step={tourStep! + 1}
        total={CORE_TOUR.length}
        nextLabel={tourStep === CORE_TOUR.length - 1 ? "Got It" : "Next"}
        onNext={() => {
          if (tourStep === CORE_TOUR.length - 1) {
            persistOnboarding({ ...onboarding, coreTourCompleted: true });
            setTourStep(null);
          } else {
            const next = tourStep! + 1;
            setActiveTab(CORE_TOUR[next].tab);
            setTourStep(next);
          }
        }}
        onDismiss={() => {
          persistOnboarding({ ...onboarding, coreTourCompleted: true });
          setTourStep(null);
        }}
      />
    )}
    {crewTourOpen && (
      <TourCoachmark
        title="Crew"
        copy="Every shared run earns a Crew block. You place the blocks you earn. Build the tower together."
        nextLabel="Got It"
        onNext={() => persistOnboarding({ ...onboarding, crewTourSeen: true })}
        onDismiss={() => persistOnboarding({ ...onboarding, crewTourSeen: true })}
      />
    )}
    </>
  );
}
