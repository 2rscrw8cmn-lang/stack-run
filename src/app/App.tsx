import { useState } from "react";
import type { AppState } from "../domain/types";
import {
  deleteRunLog,
  loadAppState,
  placeBlock,
  resetAppState,
  savePlan,
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
  const [placingRunLogId, setPlacingRunLogId] = useState<string | null>(null);
  const [appState, setAppState] = useState<AppState>(loadInitialAppState);

  return (
    <>
    <AppShell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      plan={appState.plan}
      runLogs={appState.runLogs}
      blockPlacements={appState.blockPlacements}
      onSaveRun={(workout, values: ValidRunEntry, runLogId?: string) =>
        setAppState((current) =>
          saveRunLog(current, {
            // Editing an extra run needs its own id: it has no workout to be
            // found by. A scheduled run is still found by its workout.
            id: runLogId,
            workoutId: workout?.id ?? null,
            ...values,
          }),
        )
      }
      onDeleteRun={(runLogId) =>
        setAppState((current) => deleteRunLog(current, runLogId))
      }
      onEditPlan={(plan) => setAppState((current) => savePlan(current, plan))}
      onResetPlan={() => setAppState(resetAppState())}
      onPlaceBlock={(request) =>
        setAppState((current) => placeBlock(current, request))
      }
      placingRunLogId={placingRunLogId}
      onPlacingChange={setPlacingRunLogId}
    />
    {/*
      Local scaffolding for bulk-seeding a tower by hand. Per D-025 it is gated
      on DEV, so it is absent from production bundles and from every deployed
      preview the product is reviewed in — and from the test DOM with them.
    */}
    {import.meta.env.DEV && (
      <DevDataPanel state={appState} onChange={setAppState} />
    )}
    </>
  );
}
