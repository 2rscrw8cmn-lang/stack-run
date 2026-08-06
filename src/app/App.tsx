import { useState } from "react";
import type { AppState } from "../domain/types";
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
  const [placingWorkoutId, setPlacingWorkoutId] = useState<string | null>(null);
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
            // A log belongs to a scheduled workout, so it is dated by that
            // workout, not by when it was entered. Today's log is unaffected;
            // Plan can now log a run from an earlier week, and dating that one
            // "today" would misreport when it happened.
            completedDate: workout.date,
            ...values,
          }),
        )
      }
      onPlaceBlock={(request) =>
        setAppState((current) => placeBlock(current, request))
      }
      placingWorkoutId={placingWorkoutId}
      onPlacingChange={setPlacingWorkoutId}
    />
    {/*
      Temporary scaffolding, present in deployed builds too. Plan now logs a
      past run one at a time, so this only remains for bulk-seeding a tower by
      hand. Excluded from the test DOM only. Removed in UI-7, which owns it.
    */}
    {import.meta.env.MODE !== "test" && (
      <DevDataPanel state={appState} onChange={setAppState} />
    )}
    </>
  );
}
