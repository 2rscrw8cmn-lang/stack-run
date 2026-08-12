import { useCallback, useEffect, useRef, useState } from "react";
import type { AvailabilityCalendar } from "../domain/availability";
import type { AppState, RunLog } from "../domain/types";
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
  saveRunDays,
  saveRunLog,
  StorageLoadError,
  acceptIntervalsRun,
  attachIntervalsRun,
  saveIntervalsSync,
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
import { accomplishmentsForAddedRuns, type AccomplishmentMoment as Moment } from "../domain/accomplishments";
import { AccomplishmentMoment } from "../components/ui/AccomplishmentMoment";
import { useRaceCrew } from "../crew/useRaceCrew";
import {
  forgetIntervalsApiKey,
  loadIntervalsApiKey,
  saveIntervalsApiKey,
} from "../storage/intervalsCredentialRepository";
import { clearPendingIntervalsCandidates } from "../storage/intervalsPendingRepository";
import {
  loadOnboarding,
  saveOnboarding,
  type OnboardingSnapshot,
  type OnboardingState,
} from "../storage/onboardingRepository";
import { WelcomeSheet } from "../features/onboarding/WelcomeSheet";
import { TourCoachmark } from "../features/onboarding/TourCoachmark";

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
  { tab: "plan", title: "Plan", copy: "See what should happen, one training week at a time." },
  { tab: "runs", title: "Runs", copy: "See what actually happened. Log runs here or connect Run Data." },
  { tab: "build", title: "Build", copy: "Every completed run earns a block. Place it to build your race." },
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
        ? { kind: "ready", state: next(current.state), isNew: current.isNew }
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
      runDays={boot.state.runDays}
      onSaveRunDays={(runDays, plan) =>
        setAppState((current) => saveRunDays(current, runDays, plan))
      }
      onEditPlan={(plan) => setAppState((current) => savePlan(current, plan))}
      onResetPlan={() => setBoot({ kind: "ready", state: resetAppState(), isNew: false })}
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
          // Forgetting Run Data forgets what Run Data found. The queue holds
          // one Intervals account's activities, and the next key entered here
          // may well be a different runner's.
          clearPendingIntervalsCandidates();
          setIntervalsApiKey(null);
        } catch (error) {
          setWriteError(error instanceof Error ? error.message : "Connection could not be forgotten.");
        }
      }}
      onConnectIntervals={(token) => { try { saveIntervalsSyncToken(token); setSyncToken(token); } catch (error) { setWriteError(error instanceof Error ? error.message : "Connection could not be saved."); } }}
      onForgetIntervals={() => { try { forgetIntervalsSyncToken(); clearPendingIntervalsCandidates(); setSyncToken(null); } catch (error) { setWriteError(error instanceof Error ? error.message : "Connection could not be forgotten."); } }}
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
