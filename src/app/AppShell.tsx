import type { ReactNode } from "react";
import { BottomNav } from "../components/shared/BottomNav";
import { StackMark } from "../components/shared/StackMark";
import type { AvailabilityCalendar } from "../domain/availability";
import type { RacePlanSetup } from "../domain/racePlan";
import type { Weekday } from "../domain/runDays";
import type { BlockPlacement, RunLog, TrainingPlan, Workout } from "../domain/types";
import { BuildScreen } from "../features/build/BuildScreen";
import type { PlacementRequest } from "../features/build/BuildScreen";
import { PlanScreen } from "../features/plan/PlanScreen";
import type { ValidRunEntry } from "../features/run-entry/runValidation";
import { TodayScreen } from "../features/today/TodayScreen";
import type { TabId } from "./App";
import type { AppState, Effort, RunActivityType } from "../domain/types";
import type { IntervalsCandidate } from "../connected/intervals";
import { RunDataSheet, type RunDataReview } from "../features/connected/RunDataSheet";
import type { ConnectedSync } from "../features/connected/useConnectedSync";
import { Button } from "../components/ui/Button";
import { Database } from "lucide-react";
import { useState } from "react";

interface AppShellProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  /** Something the whole app needs to say, shown under the brand bar. */
  notice?: ReactNode;
  plan: TrainingPlan;
  runLogs: RunLog[];
  blockPlacements: BlockPlacement[];
  onSaveRun: (
    workout: Workout | null,
    values: ValidRunEntry,
    runLogId?: string,
  ) => void;
  /** Removes one recorded run, and the block it earned with it. */
  onDeleteRun: (runLogId: string) => void;
  /** Persists an edited plan, and restores the seed. */
  onEditPlan: (plan: TrainingPlan) => void;
  onResetPlan: () => void;
  /** Days the user cannot run, imported from a calendar. */
  availability: AvailabilityCalendar | null;
  onSaveAvailability: (calendar: AvailabilityCalendar | null) => void;
  runDays: Weekday[] | null;
  onSaveRunDays: (runDays: Weekday[], plan: TrainingPlan) => void;
  raceSetup: RacePlanSetup | null;
  onGeneratePlan: (setup: RacePlanSetup, plan: TrainingPlan) => void;
  onPlaceBlock: (request: PlacementRequest) => void;
  /** The earned block Build is currently holding, identified by its run log. */
  placingRunLogId: string | null;
  onPlacingChange: (runLogId: string | null) => void;
  appState: AppState; syncToken: string | null;
  /** The one sync every screen reads from, so none of them disagree. */
  connectedSync: ConnectedSync;
  onConnectIntervals: (token: string) => void; onForgetIntervals: () => void;
  onImportIntervals: (candidate: IntervalsCandidate, workoutId: string | null, type: RunActivityType, effort: Effort, notes: string) => void;
  onAttachIntervals: (candidate: IntervalsCandidate, runLogId: string) => void; onIgnoreIntervals: (id: string) => void; onClearIgnoredIntervals: () => void;
}

export function AppShell({
  activeTab,
  onTabChange,
  notice,
  plan,
  runLogs,
  blockPlacements,
  onSaveRun,
  onDeleteRun,
  onEditPlan,
  onResetPlan,
  availability,
  onSaveAvailability,
  runDays,
  onSaveRunDays,
  raceSetup,
  onGeneratePlan,
  onPlaceBlock,
  placingRunLogId,
  onPlacingChange,
  appState, syncToken, connectedSync, onConnectIntervals, onForgetIntervals, onImportIntervals, onAttachIntervals, onIgnoreIntervals, onClearIgnoredIntervals,
}: AppShellProps) {
  const [runDataOpen, setRunDataOpen] = useState(false);
  // A review handed in from Today, and a counter that remounts the sheet so it
  // opens on that run rather than on whatever it was last showing.
  const [review, setReview] = useState<RunDataReview | null>(null);
  const [runDataVisit, setRunDataVisit] = useState(0);

  function openRunData(next: RunDataReview | null) {
    setReview(next);
    setRunDataVisit((visit) => visit + 1);
    setRunDataOpen(true);
  }
  return (
    <div className="app-shell">
      {/*
        The brand is a small standing lockup rather than a headline. Each
        screen leads with the thing it is actually about — the date, the miles,
        the week — so nothing on any screen has to be titled with its own name.
      */}
      <header className="app-shell__header">
        <div className="brand">
          <StackMark size={22} />
          <p className="wordmark">STACK</p>
        </div>
        <Button className="run-data-trigger" variant="ghost" icon={<Database size={17}/>} onClick={() => openRunData(null)}>Run Data</Button>
      </header>
      {notice}
      <main className="app-shell__main">
        {activeTab === "today" && (
          <TodayScreen
            plan={plan}
            runLogs={runLogs}
            blockPlacements={blockPlacements}
            onViewPlan={() => onTabChange("plan")}
            onViewBuild={() => onTabChange("build")}
            onStartPlacing={(runLogId) => {
              onPlacingChange(runLogId);
              onTabChange("build");
            }}
            onSaveRun={onSaveRun}
            onDeleteRun={onDeleteRun}
            availability={availability}
            candidates={connectedSync.candidates}
            onReviewCandidate={(candidate, asExtra) => openRunData({ candidate, asExtra })}
            onDismissCandidate={connectedSync.dismiss}
            onIgnoreCandidate={(externalId) => {
              onIgnoreIntervals(externalId);
              connectedSync.settle(externalId);
            }}
            syncError={connectedSync.error}
            onRetrySync={connectedSync.sync}
            isSyncing={connectedSync.status === "syncing"}
          />
        )}
        {activeTab === "build" && (
          <BuildScreen
            plan={plan}
            runLogs={runLogs}
            blockPlacements={blockPlacements}
            onSaveRun={onSaveRun}
            onDeleteRun={onDeleteRun}
            onPlaceBlock={onPlaceBlock}
            placingRunLogId={placingRunLogId}
            onPlacingChange={onPlacingChange}
            syncToken={syncToken}
          />
        )}
        {activeTab === "plan" && (
          <PlanScreen
            plan={plan}
            runLogs={runLogs}
            blockPlacements={blockPlacements}
            onSaveRun={onSaveRun}
            onDeleteRun={onDeleteRun}
            onEditPlan={onEditPlan}
            onResetPlan={onResetPlan}
            availability={availability}
            onSaveAvailability={onSaveAvailability}
            runDays={runDays}
            onSaveRunDays={onSaveRunDays}
            raceSetup={raceSetup}
            onGeneratePlan={onGeneratePlan}
            syncToken={syncToken}
          />
        )}
      </main>
      <nav className="app-shell__nav" aria-label="Primary">
        <BottomNav activeTab={activeTab} onTabChange={onTabChange} />
      </nav>
      <RunDataSheet key={runDataVisit} isOpen={runDataOpen} onClose={() => setRunDataOpen(false)} state={appState} initialToken={syncToken} initialReview={review} candidates={connectedSync.candidates} isSyncing={connectedSync.status === "syncing"} syncError={connectedSync.error} onSync={connectedSync.sync} onSettle={connectedSync.settle} onConnect={onConnectIntervals} onForget={onForgetIntervals} onImport={onImportIntervals} onAttach={onAttachIntervals} onIgnore={onIgnoreIntervals} onClearIgnored={onClearIgnoredIntervals}/>
    </div>
  );
}
