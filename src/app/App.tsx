import { useState } from "react";
import type { AppState } from "../domain/types";
import { todayLocalDate } from "../domain/dates";
import { loadAppState, saveRunLog, StorageLoadError } from "../storage/appStateRepository";
import type { ValidRunEntry } from "../features/run-entry/runValidation";
import { createInitialAppState } from "../storage/migrations";
import { AppShell } from "./AppShell";

export type TabId = "today" | "build" | "plan";

function loadInitialAppState(): AppState {
  try {
    return loadAppState();
  } catch (error) {
    if (error instanceof StorageLoadError) {
      console.warn(error.message);
    }
    return createInitialAppState();
  }
}

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>("today");
  const [appState, setAppState] = useState<AppState>(loadInitialAppState);

  return (
    <AppShell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      plan={appState.plan}
      runLogs={appState.runLogs}
      onSaveRun={(workout, values: ValidRunEntry) =>
        setAppState((current) =>
          saveRunLog(current, {
            workoutId: workout.id,
            completedDate: todayLocalDate(),
            ...values,
          }),
        )
      }
    />
  );
}
