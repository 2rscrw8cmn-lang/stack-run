import { BottomNav } from "../components/shared/BottomNav";
import { Card } from "../components/ui/Card";
import type { RunLog, TrainingPlan, Workout } from "../domain/types";
import type { ValidRunEntry } from "../features/run-entry/runValidation";
import { TodayScreen } from "../features/today/TodayScreen";
import type { TabId } from "./App";

const TAB_LABELS: Record<Exclude<TabId, "today">, string> = {
  build: "Build",
  plan: "Plan",
};

const TAB_PLACEHOLDER_TEXT: Record<Exclude<TabId, "today">, string> = {
  build:
    "The Build screen will show your growing stack of completed workouts here.",
  plan: "The Plan screen will show your full 18-week schedule here.",
};

interface AppShellProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  plan: TrainingPlan;
  runLogs: RunLog[];
  onSaveRun: (workout: Workout, values: ValidRunEntry) => void;
}

export function AppShell({
  activeTab,
  onTabChange,
  plan,
  runLogs,
  onSaveRun,
}: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <p className="wordmark">STACK</p>
        <p className="tagline">Build your race.</p>
      </header>
      <main className="app-shell__main">
        {activeTab === "today" ? (
          <TodayScreen
            plan={plan}
            runLogs={runLogs}
            onViewPlan={() => onTabChange("plan")}
            onSaveRun={onSaveRun}
          />
        ) : (
          <Card>
            <h1>{TAB_LABELS[activeTab]}</h1>
            <p>{TAB_PLACEHOLDER_TEXT[activeTab]}</p>
          </Card>
        )}
      </main>
      <nav className="app-shell__nav" aria-label="Primary">
        <BottomNav activeTab={activeTab} onTabChange={onTabChange} />
      </nav>
    </div>
  );
}
