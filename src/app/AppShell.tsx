import { BottomNav } from "../components/shared/BottomNav";
import type { BlockPlacement, RunLog, TrainingPlan, Workout } from "../domain/types";
import { BuildScreen } from "../features/build/BuildScreen";
import type { PlacementRequest } from "../features/build/BuildScreen";
import { PlanScreen } from "../features/plan/PlanScreen";
import type { ValidRunEntry } from "../features/run-entry/runValidation";
import { TodayScreen } from "../features/today/TodayScreen";
import type { TabId } from "./App";

interface AppShellProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  plan: TrainingPlan;
  runLogs: RunLog[];
  blockPlacements: BlockPlacement[];
  onSaveRun: (
    workout: Workout | null,
    values: ValidRunEntry,
    runLogId?: string,
  ) => void;
  onPlaceBlock: (request: PlacementRequest) => void;
  /** The earned block Build is currently holding, identified by its run log. */
  placingRunLogId: string | null;
  onPlacingChange: (runLogId: string | null) => void;
}

export function AppShell({
  activeTab,
  onTabChange,
  plan,
  runLogs,
  blockPlacements,
  onSaveRun,
  onPlaceBlock,
  placingRunLogId,
  onPlacingChange,
}: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <p className="wordmark">STACK</p>
        <p className="tagline">Build your race.</p>
      </header>
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
          />
        )}
        {activeTab === "build" && (
          <BuildScreen
            plan={plan}
            runLogs={runLogs}
            blockPlacements={blockPlacements}
            onPlaceBlock={onPlaceBlock}
            placingRunLogId={placingRunLogId}
            onPlacingChange={onPlacingChange}
          />
        )}
        {activeTab === "plan" && (
          <PlanScreen plan={plan} runLogs={runLogs} onSaveRun={onSaveRun} />
        )}
      </main>
      <nav className="app-shell__nav" aria-label="Primary">
        <BottomNav activeTab={activeTab} onTabChange={onTabChange} />
      </nav>
    </div>
  );
}
