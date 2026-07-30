import { BottomNav } from "../components/shared/BottomNav";
import { Card } from "../components/ui/Card";
import type { BlockPlacement, RunLog, TrainingPlan, Workout } from "../domain/types";
import { BuildScreen } from "../features/build/BuildScreen";
import type { PlacementRequest } from "../features/build/PlaceBlockSheet";
import type { ValidRunEntry } from "../features/run-entry/runValidation";
import { TodayScreen } from "../features/today/TodayScreen";
import type { TabId } from "./App";

interface AppShellProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  plan: TrainingPlan;
  runLogs: RunLog[];
  blockPlacements: BlockPlacement[];
  onSaveRun: (workout: Workout, values: ValidRunEntry) => void;
  onPlaceBlock: (request: PlacementRequest) => void;
}

export function AppShell({
  activeTab,
  onTabChange,
  plan,
  runLogs,
  blockPlacements,
  onSaveRun,
  onPlaceBlock,
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
            onSaveRun={onSaveRun}
            onPlaceBlock={onPlaceBlock}
          />
        )}
        {activeTab === "build" && (
          <BuildScreen
            plan={plan}
            runLogs={runLogs}
            blockPlacements={blockPlacements}
            onPlaceBlock={onPlaceBlock}
          />
        )}
        {activeTab === "plan" && (
          <Card>
            <h1>Plan</h1>
            <p>The Plan screen will show your full 18-week schedule here.</p>
          </Card>
        )}
      </main>
      <nav className="app-shell__nav" aria-label="Primary">
        <BottomNav activeTab={activeTab} onTabChange={onTabChange} />
      </nav>
    </div>
  );
}
