import { useState } from "react";
import type { AppState } from "../domain/types";
import { loadAppState, StorageLoadError } from "../storage/appStateRepository";
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
  const [appState] = useState<AppState>(loadInitialAppState);

  return (
    <AppShell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      plan={appState.plan}
      runLogs={appState.runLogs}
    />
  );
}
