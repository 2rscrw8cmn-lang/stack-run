import { useCallback, useState } from "react";
import type { AvailabilityCalendar } from "../domain/availability";
import type { AppState } from "../domain/types";
import {
  deleteRunLog,
  loadAppState,
  placeBlock,
  resetAppState,
  saveAvailability,
  savePlan,
  saveGeneratedPlan,
  saveRunDays,
  saveRunLog,
  StorageLoadError,
} from "../storage/appStateRepository";
import type { ValidRunEntry } from "../features/run-entry/runValidation";
import { createInitialAppState } from "../storage/migrations";
import { DevDataPanel } from "../dev/DevDataPanel";
import { useRosterRefresh } from "../features/availability/useRosterRefresh";
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

  const saveCalendar = useCallback(
    (calendar: AvailabilityCalendar | null) =>
      setAppState((current) => saveAvailability(current, calendar)),
    [],
  );

  // A remembered roster is re-read once when the app opens, so blocked days
  // are as current as the calendar rather than as current as the last time
  // anybody tapped Refresh. Quiet on failure; the stored roster stands.
  useRosterRefresh(appState.availability, saveCalendar);

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
      availability={appState.availability}
      onSaveAvailability={saveCalendar}
      raceSetup={appState.raceSetup}
      onGeneratePlan={(setup, plan) =>
        setAppState((current) => saveGeneratedPlan(current, setup, plan))
      }
      runDays={appState.runDays}
      onSaveRunDays={(runDays, plan) =>
        setAppState((current) => saveRunDays(current, runDays, plan))
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
