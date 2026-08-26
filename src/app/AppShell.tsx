import { Settings as SettingsIcon } from "lucide-react";
import type { ReactNode } from "react";
import { BottomNav } from "../components/shared/BottomNav.js";
import { StackMark } from "../components/shared/StackMark.js";
import { IconButton } from "../components/ui/IconButton.js";
import type { AvailabilityCalendar } from "../domain/availability.js";
import { todayLocalDate } from "../domain/dates.js";
import type { RacePlanSetup } from "../domain/racePlan.js";
import type { Weekday } from "../domain/runDays.js";
import type { ArchivedTrainingPlan, BlockPlacement, RunLog, TrainingPlan, Workout } from "../domain/types.js";
import { BuildScreen } from "../features/build/BuildScreen.js";
import type { PlacementRequest } from "../features/build/BuildScreen.js";
import { PlanScreen } from "../features/plan/PlanScreen.js";
import { RunsScreen } from "../features/runs/RunsScreen.js";
import type { ValidRunEntry } from "../features/run-entry/runValidation.js";
import { TodayScreen } from "../features/today/TodayScreen.js";
import type { TabId } from "./App.js";
import type { AppState, Effort, RunActivityType } from "../domain/types.js";
import type { IntervalsCandidate, IntervalsConnection } from "../connected/intervals.js";
import { RunDataSheet, type RunDataReview } from "../features/connected/RunDataSheet.js";
import type { ConnectedSync } from "../features/connected/useConnectedSync.js";
import type { RunnerHistory } from "../features/runs/useRunnerHistory.js";
import { SettingsSheet } from "../features/settings/SettingsSheet.js";
import { useCallback, useEffect, useState } from "react";
import type { RaceCrewController } from "../crew/useRaceCrew.js";
import { AccountCrewSheet } from "../features/crew/AccountCrewSheet.js";
import { RunnerIcon } from "../features/crew/RunnerIcon.js";
import { crewMemberAccent } from "../crew/memberAccent.js";
import { CrewScreen } from "../features/crew/CrewScreen.js";
import type { PersonalSyncController } from "../personal-sync/types.js";

interface AppShellProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  /** True only for a signed-in active member of a crew. */
  crewAvailable: boolean;
  onReplayTour: () => void;
  /** Something the whole app needs to say, shown under the brand bar. */
  notice?: ReactNode;
  plan: TrainingPlan | null;
  planHistory: readonly ArchivedTrainingPlan[];
  runLogs: RunLog[];
  blockPlacements: BlockPlacement[];
  onSaveRun: (
    workout: Workout | null,
    values: ValidRunEntry,
    runLogId?: string,
  ) => void;
  /** Removes one recorded run, and the block it earned with it. */
  onDeleteRun: (runLogId: string) => void;
  /** Connects an extra run to a scheduled workout after the fact. */
  onLinkRun: (runLogId: string, workoutId: string) => void;
  /** Undoes a manual link, turning the run back into an extra run. */
  onUnlinkRun: (runLogId: string) => void;
  /** Persists an edited plan, and restores the seed. */
  onEditPlan: (plan: TrainingPlan) => void;
  onResetPlan: () => void;
  onFinishPlan: () => void;
  /** Days the user cannot run, imported from a calendar. */
  availability: AvailabilityCalendar | null;
  onSaveAvailability: (calendar: AvailabilityCalendar | null) => void;
  runDays: Weekday[] | null;
  onSaveRunDays: (runDays: Weekday[], plan: TrainingPlan) => void;
  crossTrainingDays: Weekday[] | null;
  onSaveCrossTrainingDays: (crossTrainingDays: Weekday[], plan: TrainingPlan) => void;
  raceSetup: RacePlanSetup | null;
  onGeneratePlan: (setup: RacePlanSetup, plan: TrainingPlan) => void;
  onPlaceBlock: (request: PlacementRequest) => void;
  /** The earned block Build is currently holding, identified by its run log. */
  placingRunLogId: string | null;
  onPlacingChange: (runLogId: string | null) => void;
  appState: AppState; syncToken: string | null;
  intervalsConnection: IntervalsConnection | null;
  /** The one sync every screen reads from, so none of them disagree. */
  connectedSync: ConnectedSync;
  onConnectIntervals: (token: string) => void; onForgetIntervals: () => void;
  onConnectIntervalsApiKey: (apiKey: string) => void;
  onForgetIntervalsApiKey: () => void;
  raceCrew: RaceCrewController;
  personalSync?: PersonalSyncController;
  /** The runner's unified actual history, and how current the connected part is. */
  runnerHistory?: RunnerHistory;
  onImportIntervals: (candidate: IntervalsCandidate, workoutId: string | null, type: RunActivityType, effort: Effort, notes: string) => void;
  onAttachIntervals: (candidate: IntervalsCandidate, runLogId: string) => void; onIgnoreIntervals: (id: string) => void; onClearIgnoredIntervals: () => void;
}

export function AppShell({
  activeTab,
  onTabChange,
  crewAvailable,
  onReplayTour,
  notice,
  plan,
  planHistory,
  runLogs,
  blockPlacements,
  onSaveRun,
  onDeleteRun,
  onLinkRun,
  onUnlinkRun,
  onEditPlan,
  onResetPlan,
  onFinishPlan,
  availability,
  onSaveAvailability,
  runDays,
  onSaveRunDays,
  crossTrainingDays,
  onSaveCrossTrainingDays,
  raceSetup,
  onGeneratePlan,
  onPlaceBlock,
  placingRunLogId,
  onPlacingChange,
  appState, syncToken, intervalsConnection, connectedSync, onConnectIntervals, onForgetIntervals, onConnectIntervalsApiKey, onForgetIntervalsApiKey, raceCrew, personalSync, runnerHistory, onImportIntervals, onAttachIntervals, onIgnoreIntervals, onClearIgnoredIntervals,
}: AppShellProps) {
  const [runDataOpen, setRunDataOpen] = useState(false);
  // A review handed in from Today, and a counter that remounts the sheet so it
  // opens on that run rather than on whatever it was last showing.
  const [review, setReview] = useState<RunDataReview | null>(null);
  const [runDataVisit, setRunDataVisit] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountCrewOpen, setAccountCrewOpen] = useState(false);
  // Run Data is reached from Today and from Settings. Dismissing it should go
  // back wherever it was opened from, so which one that was is remembered.
  const [runDataFromSettings, setRunDataFromSettings] = useState(false);
  // The one shared run Today handed to Crew for placement, until Crew has it.
  // Crew Build placement is independent of Personal Build placement (D-066),
  // so `Place Crew Block` cannot just send the runner to the Crew page and
  // leave them to find their own READY block in the tower (issue #120).
  const [crewPlacementRunId, setCrewPlacementRunId] = useState<string | null>(null);
  // Account & Crew has the same problem now that the header opens it directly:
  // only a visit that came from Settings should land back in Settings.
  const [accountCrewFromSettings, setAccountCrewFromSettings] = useState(false);

  function openAccountCrew(fromSettings: boolean) {
    setAccountCrewFromSettings(fromSettings);
    if (!fromSettings) setSettingsOpen(false);
    setAccountCrewOpen(true);
  }

  const clearCrewPlacementRequest = useCallback(() => setCrewPlacementRunId(null), []);

  const personalInitialization = personalSync?.initialization ?? null;

  useEffect(() => {
    if (personalInitialization === null) return;
    queueMicrotask(() => {
      setSettingsOpen(false);
      setAccountCrewOpen(true);
    });
  }, [personalInitialization]);

  function openRunData(next: RunDataReview | null, fromSettings = false) {
    setReview(next);
    setRunDataVisit((visit) => visit + 1);
    setRunDataFromSettings(fromSettings);
    setRunDataOpen(true);
  }
  // Present only for a signed-in account; personal STACK has no runner to show.
  const runnerProfile = raceCrew.status === "signed-in" ? raceCrew.account?.profile ?? null : null;

  return (
    <div className="app-shell">
      {/*
        The brand is a small standing lockup rather than a headline. Each
        screen leads with the thing it is actually about — the date, the miles,
        the week — so nothing on any screen has to be titled with its own name.
        Nothing else belongs up here: the one action that used to share the row
        wrapped onto two lines on a phone, and it is a setting anyway.
      */}
      <header className="app-shell__header">
        <div className="app-shell__header-row">
          <div className="brand">
            <StackMark size={22} />
            <p className="wordmark">STACK</p>
          </div>
          {/*
            Settings is configuration, not a place the app can be, so it is a
            gear up here rather than a fifth thing in a bar of destinations. It
            opens over whatever tab you are on and closes back to it — the tab
            never changes, so there is nothing to restore.
          */}
          <div className="app-shell__header-actions">
            {/*
              The signed-in runner's own icon, standing next to the gear as
              the account affordance. It is the same mark their crewmates see,
              which is the point: this is who STACK currently is. It sits
              inside the existing row at the gear's own height, so the header
              gains an identity without gaining a pixel.
            */}
            {runnerProfile && (
              <button
                type="button"
                className="app-shell__runner"
                data-unread={raceCrew.unreadPropNotifications.length > 0 || undefined}
                aria-haspopup="dialog"
                aria-expanded={accountCrewOpen}
                aria-label={
                  raceCrew.unreadPropNotifications.length > 0
                    ? `${runnerProfile.displayName}. Account & Crew. New Props received.`
                    : `${runnerProfile.displayName}. Account & Crew.`
                }
                onClick={() => openAccountCrew(false)}
              >
                <RunnerIcon
                  icon={runnerProfile.runnerIcon}
                  accent={crewMemberAccent(runnerProfile.id, runnerProfile.accentColor)}
                  size={24}
                />
              </button>
            )}
            <IconButton
              label="Settings"
              icon={<SettingsIcon size={20} strokeWidth={1.8} />}
              aria-haspopup="dialog"
              aria-expanded={settingsOpen}
              onClick={() => setSettingsOpen(true)}
            />
          </div>
        </div>
      </header>
      {notice}
      <main className="app-shell__main">
        {activeTab === "today" && (
          <TodayScreen
            plan={plan}
            runLogs={runLogs}
            runnerRuns={runnerHistory?.runs}
            blockPlacements={blockPlacements}
            onViewPlan={() => onTabChange("plan")}
            onViewRuns={() => onTabChange("runs")}
            onViewBuild={() => onTabChange("build")}
            onStartPlacing={(runLogId) => {
              onPlacingChange(runLogId);
              onTabChange("build");
            }}
            onStartCrewPlacing={(sharedRunId) => {
              setCrewPlacementRunId(sharedRunId);
              onTabChange("crew");
            }}
            onSaveRun={onSaveRun}
            onEditPlan={onEditPlan}
            availability={availability}
            candidates={connectedSync.candidates}
            onReviewCandidate={(candidate) => openRunData({ candidate })}
            syncError={connectedSync.error}
            onRetrySync={connectedSync.sync}
            isSyncing={connectedSync.status === "syncing"}
            raceCrew={raceCrew}
            onViewCrew={() => onTabChange("crew")}
          />
        )}
        {activeTab === "build" && (
          <BuildScreen
            plan={plan}
            planHistory={planHistory}
            runLogs={runLogs}
            blockPlacements={blockPlacements}
            onSaveRun={onSaveRun}
            onDeleteRun={onDeleteRun}
            onPlaceBlock={onPlaceBlock}
            placingRunLogId={placingRunLogId}
            onPlacingChange={onPlacingChange}
            syncToken={intervalsConnection}
          />
        )}
        {activeTab === "runs" && (
          <RunsScreen
            plan={plan}
            planHistory={planHistory}
            runLogs={runLogs}
            runnerRuns={runnerHistory?.runs}
            historyPhase={runnerHistory?.phase}
            historyCompleteAt={runnerHistory?.lastCompleteAt ?? null}
            onSaveRun={onSaveRun}
            onDeleteRun={onDeleteRun}
            onLinkRun={onLinkRun}
            onUnlinkRun={onUnlinkRun}
            syncToken={intervalsConnection}
          />
        )}
        {activeTab === "crew" && crewAvailable && (
          <CrewScreen
            crew={raceCrew}
            onOpenAccountCrew={() => openAccountCrew(false)}
            placeCrewRunId={crewPlacementRunId}
            onCrewPlacementHandled={clearCrewPlacementRequest}
          />
        )}
        {activeTab === "plan" && (
          <PlanScreen
            plan={plan}
            planHistory={planHistory}
            runLogs={runLogs}
            runnerRuns={runnerHistory?.runs}
            onSaveRun={onSaveRun}
            onDeleteRun={onDeleteRun}
            onEditPlan={onEditPlan}
            availability={availability}
            raceSetup={raceSetup}
            runDays={runDays}
            crossTrainingDays={crossTrainingDays}
            onGeneratePlan={onGeneratePlan}
            onFinishPlan={onFinishPlan}
            syncToken={intervalsConnection}
            planAdjustments={raceCrew.planAdjustments}
          />
        )}
      </main>
      <nav className="app-shell__nav" aria-label="Primary">
        <BottomNav
          activeTab={activeTab}
          onTabChange={onTabChange}
          showCrew={crewAvailable}
        />
      </nav>
      <SettingsSheet
        isOpen={settingsOpen}
        onOpenChange={setSettingsOpen}
        plan={plan}
        runLogs={runLogs}
        blockPlacements={blockPlacements}
        today={todayLocalDate()}
        raceSetup={raceSetup}
        onGeneratePlan={onGeneratePlan}
        runDays={runDays}
        onSaveRunDays={onSaveRunDays}
        crossTrainingDays={crossTrainingDays}
        onSaveCrossTrainingDays={onSaveCrossTrainingDays}
        availability={availability}
        onSaveAvailability={onSaveAvailability}
        onResetPlan={onResetPlan}
        onOpenRunData={() => openRunData(null, true)}
        isConnected={Boolean(intervalsConnection)}
        lastSyncedAt={appState.intervalsSync.lastSuccessfulActivitySyncAt}
        onOpenAccountCrew={() => openAccountCrew(true)}
        accountCrewMark={
          runnerProfile ? (
            <RunnerIcon
              icon={runnerProfile.runnerIcon}
              accent={crewMemberAccent(runnerProfile.id, runnerProfile.accentColor)}
              size={22}
            />
          ) : null
        }
        accountCrewValue={
          raceCrew.status !== "signed-in"
            ? "Not signed in"
            : raceCrew.account?.crew
              ? `${raceCrew.account.profile.displayName} · ${raceCrew.account.crew.name}`
              : `${raceCrew.account?.profile.displayName ?? "Runner"} · No crew`
        }
        onReplayTour={() => {
          setSettingsOpen(false);
          onReplayTour();
        }}
      />
      <AccountCrewSheet
        isOpen={accountCrewOpen}
        onClose={() => {
          setAccountCrewOpen(false);
          if (accountCrewFromSettings) setSettingsOpen(true);
        }}
        crew={raceCrew}
        personalSync={personalSync}
        localRace={plan?.race ?? null}
      />
      <RunDataSheet
        key={runDataVisit}
        isOpen={runDataOpen}
        onClose={() => {
          setRunDataOpen(false);
          if (runDataFromSettings) {
            setSettingsOpen(true);
          }
        }}
        state={appState}
        initialToken={syncToken}
        connection={intervalsConnection}
        initialReview={review}
        candidates={connectedSync.candidates}
        isSyncing={connectedSync.status === "syncing"}
        syncError={connectedSync.error}
        onSync={connectedSync.sync}
        onFindOlderRuns={connectedSync.findOlderRuns}
        onSettle={connectedSync.settle}
        onConnect={onConnectIntervals}
        onForget={onForgetIntervals}
        onConnectApiKey={onConnectIntervalsApiKey}
        onForgetApiKey={onForgetIntervalsApiKey}
        onImport={onImportIntervals}
        onAttach={onAttachIntervals}
        onIgnore={onIgnoreIntervals}
        onClearIgnored={onClearIgnoredIntervals}
      />
    </div>
  );
}
