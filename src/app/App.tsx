import { useState } from "react";
import type { AppState } from "../domain/types";
import { todayLocalDate } from "../domain/dates";
import {
  loadAppState,
  placeBlock,
  saveRunLog,
  StorageLoadError,
} from "../storage/appStateRepository";
import type { ValidRunEntry } from "../features/run-entry/runValidation";
import { createInitialAppState } from "../storage/migrations";
import { DevDataPanel } from "../dev/DevDataPanel";
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
    <>
    <AppShell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      plan={appState.plan}
      runLogs={appState.runLogs}
      blockPlacements={appState.blockPlacements}
      onSaveRun={(workout, values: ValidRunEntry) =>
        setAppState((current) =>
          saveRunLog(current, {
            workoutId: workout.id,
            completedDate: todayLocalDate(),
            ...values,
          }),
        )
      }
      onPlaceBlock={(request) =>
        setAppState((current) => placeBlock(current, request))
      }
    />
    {/*
      Temporary scaffolding, present in deployed builds too: there is no other
      way to log a run that is not scheduled for today until the Plan screen
      lands in UI-5. Excluded from the test DOM only. Remove in UI-7.
    */}
    {import.meta.env.MODE !== "test" && (
      <DevDataPanel state={appState} onChange={setAppState} />
    )}
    </>
  );
}
