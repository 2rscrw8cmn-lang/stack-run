import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { fetchIntervals } from "../../connected/intervals";
import { selectPlanWeekViewModel } from "../../domain/plan";
import type { AppState } from "../../domain/types";
import {
  acceptIntervalsRun,
  saveIntervalsSync,
  saveRunLog,
} from "../../storage/appStateRepository";
import { loadPendingIntervalsCandidates } from "../../storage/intervalsPendingRepository";
import { createInitialAppState } from "../../storage/migrations";
import { RunDataSheet } from "./RunDataSheet";
import { useConnectedSync } from "./useConnectedSync";

/**
 * Issues #40 and #41 arriving together, which is how a real device meets them.
 *
 * An Intervals run is discovered by the first wide read, is still unreviewed
 * when the next narrow read no longer covers its date, and belongs to a
 * scheduled workout further away than the automatic suggestion will go. Every
 * one of those steps used to end the run's life in STACK: it disappeared from
 * the queue, and even if it had not, its workout was not in the dropdown.
 */

/** The run happened on a rest day, four days before the workout it satisfies. */
const RUN_DATE = "2026-08-05";
const NEARBY_WORKOUTS = ["workout-002", "workout-004"];
const TRUE_WORKOUT = "workout-007";

const activity = {
  id: "i-old",
  type: "Run",
  start_date_local: `${RUN_DATE}T06:30:00`,
  distance: 6437,
  moving_time: 2400,
  average_heartrate: 151,
};

/** A plan with the run's neighbours already run, so nothing is suggested. */
function startingState(): AppState {
  let state = createInitialAppState();
  for (const workoutId of NEARBY_WORKOUTS) {
    const workout = state.plan.weeks.flatMap((week) => week.workouts).find((item) => item.id === workoutId)!;
    state = saveRunLog(state, { workoutId, completedDate: workout.date, activityType: "easy", distanceMiles: 2, durationSeconds: 1200, effort: "solid", notes: "" });
  }
  return state;
}

function Harness({ initial, read }: { initial: AppState; read: typeof fetchIntervals }) {
  const [state, setState] = useState(initial);
  const sync = useConnectedSync({
    token: "t",
    state,
    onSynced: (at) => setState((current) => saveIntervalsSync(current, at)),
    read,
  });
  return (
    <RunDataSheet
      isOpen
      onClose={vi.fn()}
      state={state}
      initialToken="t"
      candidates={sync.candidates}
      isSyncing={sync.status === "syncing"}
      syncError={sync.error}
      onSync={sync.sync}
      onFindOlderRuns={sync.findOlderRuns}
      onSettle={sync.settle}
      onConnect={vi.fn()}
      onForget={vi.fn()}
      onImport={(candidate, workoutId, type, effort, notes) =>
        setState((current) => acceptIntervalsRun(current, candidate, workoutId, type, effort, notes))}
      onAttach={vi.fn()}
      onIgnore={vi.fn()}
      onClearIgnored={vi.fn()}
    />
  );
}

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("an old synced run stays reviewable and matchable", () => {
  it("survives a narrower sync and a reload, then matches a workout four days away", async () => {
    const user = userEvent.setup();

    // Day one: the first connection reaches back far enough to find it.
    const first = render(<Harness initial={startingState()} read={vi.fn(async () => [activity])} />);
    await screen.findByText("Runs to Review");
    first.unmount();

    // Day two, a reload and a rolling read that does not mention the run.
    const synced = saveIntervalsSync(startingState(), new Date(Date.now() - 60 * 60_000).toISOString());
    render(<Harness initial={synced} read={vi.fn(async () => [])} />);

    expect(await screen.findByText("Runs to Review")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /4 mi.*Aug 5/ }));

    // Nothing within two days is free, so STACK proposes nothing — correctly.
    const match = screen.getByLabelText("Match");
    expect(match).toHaveValue("");
    expect(screen.queryByRole("group", { name: "Suggested" })).not.toBeInTheDocument();

    // The workout it really was is four days out, and still the user's to pick.
    const values = within(match).getAllByRole("option").map((option) => option.getAttribute("value"));
    expect(values).toContain(TRUE_WORKOUT);
    expect(values).not.toContain(NEARBY_WORKOUTS[0]);

    await user.selectOptions(match, TRUE_WORKOUT);
    await user.click(screen.getByRole("button", { name: "Confirm Match" }));
    await screen.findByRole("status");

    const stored: AppState = JSON.parse(localStorage.getItem("stack.app-state.v1")!);
    const imported = stored.runLogs.find((run) => run.externalSource?.activityId === "i-old")!;
    expect(imported.workoutId).toBe(TRUE_WORKOUT);
    // The run happened when it happened; the link is a separate statement.
    expect(imported.completedDate).toBe(RUN_DATE);
    expect(imported.activityType).toBe("long");
    expect(imported.distanceMiles).toBe(4);

    const week = selectPlanWeekViewModel(stored.plan, stored.runLogs, 1, RUN_DATE);
    expect(week.days.find((day) => day.workout.id === TRUE_WORKOUT)?.status).toBe("completed");
    expect(week.days.filter((day) => day.status === "completed")).toHaveLength(3);

    // And it is settled for good: gone from the screen and off the device.
    await waitFor(() => expect(screen.getByText("No runs are waiting to be reviewed.")).toBeInTheDocument());
    expect(loadPendingIntervalsCandidates()).toEqual([]);
  });
});
