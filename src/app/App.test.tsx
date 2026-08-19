import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { createInitialAppState } from "../storage/migrations";

const COMPLETED_ONBOARDING = JSON.stringify({
  version: 1,
  introSeen: true,
  coreTourCompleted: true,
  crewTourSeen: true,
});

// App reads the real local date, and the plan only offers a run to log on days
// that schedule one. Pin the clock to a week 1 run day so these tests do not
// depend on when they happen to run.
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("stack.onboarding.v1", COMPLETED_ONBOARDING);
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-08-04T09:00:00"));
});

afterEach(() => {
  vi.useRealTimers();
});

function setupUser() {
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

/** Plan leads with the week rather than with the word "Plan". */
function weekHeading() {
  return screen.getByRole("heading", { level: 1 });
}

async function logTodaysRun(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Mark Complete" }));
  await user.type(screen.getByLabelText(/Distance/), "2.1");
  await user.type(screen.getByLabelText(/Duration/), "2030");
  await user.click(screen.getByRole("button", { name: "Solid" }));
  await user.click(screen.getByRole("button", { name: "Save Run" }));
}

describe("App", () => {
  it("welcomes a brand-new user, then teaches Plan before the rest of the app", async () => {
    localStorage.clear();
    const user = setupUser();
    render(<App />);

    const welcome = screen.getByRole("dialog", { name: "STACK" });
    expect(within(welcome).getByText("Build your race.")).toBeInTheDocument();
    expect(within(welcome).getByText(/Every completed run earns a block/)).toBeInTheDocument();

    await user.click(within(welcome).getByRole("button", { name: "Get Started" }));
    expect(screen.getByRole("button", { name: "Plan" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("dialog", { name: "Plan" })).toHaveTextContent("1 of 4");
  });

  it("does not force an existing local user through first-run onboarding", async () => {
    localStorage.removeItem("stack.onboarding.v1");
    localStorage.setItem("stack.app-state.v1", JSON.stringify(createInitialAppState()));
    render(<App />);

    expect(screen.queryByRole("dialog", { name: "STACK" })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem("stack.onboarding.v1") ?? "{}")).toMatchObject({
        introSeen: true,
        coreTourCompleted: true,
      }),
    );
  });

  it("replays and dismisses the tour from Settings", async () => {
    const user = setupUser();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.click(screen.getByRole("button", { name: /^App Tour/ }));
    expect(screen.getByRole("button", { name: "Plan" })).toHaveAttribute("aria-current", "page");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Plan" })).not.toBeInTheDocument();
  });

  it("shows the real Today screen, seeded from the training plan, by default", () => {
    render(<App />);
    expect(screen.getByText("OUC Half Marathon")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Today" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("switches to the Build structure and the Plan schedule on tap", async () => {
    const user = setupUser();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Build" }));
    // Build leads with the miles the tower is made of, not the word "Build".
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "0 miles built",
    );
    expect(screen.getByRole("button", { name: "Build" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByText("Nothing built yet")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Plan" }));
    // Plan opens on the week containing the pinned date.
    expect(weekHeading()).toHaveTextContent("Week 1 of 18");
    expect(
      within(screen.getByRole("list", { name: "Week 1 workouts" })).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(7);
  });

  it("logs a past run from Plan, dates it by the workout, and keeps it after a reload", async () => {
    const user = setupUser();
    // Wednesday of week 2, so every week 1 run is genuinely in the past.
    vi.setSystemTime(new Date("2026-08-12T09:00:00"));
    const { unmount } = render(<App />);

    await user.click(screen.getByRole("button", { name: "Plan" }));
    expect(weekHeading()).toHaveTextContent("Week 2 of 18");
    await user.click(screen.getByRole("button", { name: "Previous week" }));
    await user.click(
      screen.getByRole("button", {
        name: "Tuesday, August 4, 2 Miles, Easy, 2 mi, Missed",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Log Run" }));
    await user.type(screen.getByLabelText(/Distance/), "2.1");
    await user.type(screen.getByLabelText(/Duration/), "2030");
    await user.click(screen.getByRole("button", { name: "Solid" }));
    await user.click(screen.getByRole("button", { name: "Save Run" }));

    expect(
      screen.getByRole("button", {
        name: "Tuesday, August 4, 2 Miles, Easy, 2 mi, Completed",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("1 of 4 runs complete")).toBeInTheDocument();

    // The log is dated by the workout it belongs to, not by the entry time.
    const stored = JSON.parse(localStorage.getItem("stack.app-state.v1") ?? "{}");
    expect(stored.runLogs).toHaveLength(1);
    expect(stored.runLogs[0].completedDate).toBe("2026-08-04");

    unmount();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Plan" }));
    await user.click(screen.getByRole("button", { name: "Previous week" }));
    expect(screen.getByText("1 of 4 runs complete")).toBeInTheDocument();
  });

  it("earns a block on save and keeps it pending until it is placed", async () => {
    const user = setupUser();
    const { unmount } = render(<App />);

    await logTodaysRun(user);
    // Today no longer restates the run it just recorded; what it offers is
    // the block that is still unplaced (issue #120).
    expect(screen.getByRole("button", { name: "Place Personal Block" })).toBeInTheDocument();

    // The block is waiting in Build's staging tray, not in the structure.
    await user.click(screen.getByRole("button", { name: "Build" }));
    expect(
      within(screen.getByRole("list", { name: "Blocks ready to place" })).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(1);
    // Earned is not built: with nothing placed the tower is still the
    // first-run empty state rather than a grid of blocks.
    expect(screen.queryByRole("list", { name: "Built blocks" })).toBeNull();
    expect(screen.getByText("Nothing built yet")).toBeInTheDocument();

    // A pending block survives a reload.
    unmount();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Build" }));
    expect(
      screen.getByRole("list", { name: "Blocks ready to place" }),
    ).toBeInTheDocument();
  });

  it("logs an extra run that earns a block without completing anything scheduled", async () => {
    const user = setupUser();
    render(<App />);

    expect(screen.queryByRole("button", { name: "Log Run" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Runs" }));
    await user.click(screen.getByRole("button", { name: "Log Run" }));
    expect(screen.getByRole("heading", { name: "Log Run" })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Intervals" }));
    await user.type(screen.getByLabelText(/Distance/), "5");
    await user.type(screen.getByLabelText(/Duration/), "4000");
    await user.click(screen.getByRole("button", { name: "Great" }));
    await user.click(screen.getByRole("button", { name: "Save Run" }));

    // Today's scheduled easy run is still owed when we return to Today.
    await user.click(screen.getByRole("button", { name: "Today" }));
    expect(
      screen.getByRole("button", { name: "Mark Complete" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/0 of 4 runs/)).toBeInTheDocument();
    expect(screen.getByText("+1 extra")).toBeInTheDocument();

    const stored = JSON.parse(localStorage.getItem("stack.app-state.v1") ?? "{}");
    expect(stored.schemaVersion).toBe(9);
    expect(stored.runLogs).toHaveLength(1);
    expect(stored.runLogs[0].workoutId).toBeNull();
    expect(stored.runLogs[0].activityType).toBe("intervals");

    // The block it earned is waiting in Build, and its miles are counted.
    await user.click(screen.getByRole("button", { name: "Build" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "5.0 miles built",
    );
    // Build leads with the miles and stops there: no runs-complete, no streak.
    expect(screen.queryByText("Runs Complete")).not.toBeInTheDocument();
    expect(screen.queryByText("Run Streak")).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("list", { name: "Blocks ready to place" })).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(1);
  });

  it("migrates a stored schema 4 state without losing the run or the block", async () => {
    const user = setupUser();
    localStorage.setItem(
      "stack.app-state.v1",
      JSON.stringify({
        schemaVersion: 4,
        settings: { units: "miles", theme: "dark" },
        plan: JSON.parse(
          JSON.stringify(
            (await import("../seed/loadSeedPlan")).loadSeedPlan(),
          ),
        ),
        runLogs: [
          {
            id: "run-workout-002",
            workoutId: "workout-002",
            completedDate: "2026-08-04",
            distanceMiles: 2.1,
            durationSeconds: 1230,
            effort: "solid",
            notes: "Old run",
            createdAt: "2026-08-04T12:00:00.000Z",
            updatedAt: "2026-08-04T12:00:00.000Z",
          },
        ],
        // A position in the old ten-column grid, which no longer exists.
        blockPlacements: [
          {
            workoutId: "workout-002",
            row: 0,
            columnStart: 10,
            width: 1,
            height: 2,
            placedAt: "2026-08-04T13:00:00.000Z",
          },
        ],
      }),
    );

    render(<App />);

    // The run survived: Today shows it completed, with its own values, and
    // its block is already built rather than waiting to be placed again.
    expect(screen.getByText("2.1 mi · 20:30 · 9:46 /MI")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Place Personal Block" }),
    ).not.toBeInTheDocument();

    const stored = JSON.parse(localStorage.getItem("stack.app-state.v1") ?? "{}");
    expect(stored.schemaVersion).toBe(9);
    expect(stored.runLogs[0].activityType).toBe("easy");
    expect(stored.blockPlacements[0].runLogId).toBe("run-workout-002");
    expect(stored.blockPlacements[0].columnStart).toBeLessThanOrEqual(8);
    // Height is the activity type's now, not the old pace-derived two.
    expect(stored.blockPlacements[0].height).toBe(1);

    // And the block is still in the tower rather than back in the tray.
    await user.click(screen.getByRole("button", { name: "Build" }));
    expect(
      within(screen.getByRole("list", { name: "Built blocks" })).getAllByRole(
        "button",
      ),
    ).toHaveLength(1);
  });

  it("edits the plan from Plan and keeps the edit after a reload", async () => {
    const user = setupUser();
    const { unmount } = render(<App />);

    await user.click(screen.getByRole("button", { name: "Plan" }));
    // Monday of week 1 is a rest day; plan a run on it.
    await user.click(
      screen.getByRole("button", {
        name: "Monday, August 3, Rest. Add a planned run",
      }),
    );
    await user.click(screen.getByRole("radio", { name: "Intervals" }));
    await user.type(screen.getByLabelText(/Name/), "6 x 400m");
    await user.type(screen.getByLabelText(/Target/), "5");
    await user.click(screen.getByRole("button", { name: "Add Planned Run" }));

    expect(
      screen.getByRole("button", {
        name: "Monday, August 3, 6 x 400m, Intervals, 5 mi, Missed",
      }),
    ).toBeInTheDocument();
    // The week now schedules five runs rather than four.
    expect(screen.getByText("0 of 5 runs complete")).toBeInTheDocument();

    unmount();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Plan" }));
    expect(screen.getByText("0 of 5 runs complete")).toBeInTheDocument();
  });

  it("resets everything back to the seed after two confirmations", async () => {
    const user = setupUser();
    render(<App />);

    await logTodaysRun(user);
    await user.click(screen.getByRole("button", { name: "Plan" }));
    // Reset lives in Settings, reached from the header gear rather than from
    // the foot of the Plan screen.
    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.click(screen.getByRole("button", { name: /^Reset Plan/ }));

    const sheet = screen.getByRole("dialog");
    await user.click(within(sheet).getByRole("button", { name: "Reset Plan" }));
    await user.click(
      within(sheet).getByRole("button", { name: "Yes, Erase Everything" }),
    );

    expect(screen.getByText("0 of 4 runs complete")).toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem("stack.app-state.v1") ?? "{}");
    expect(stored.runLogs).toEqual([]);
    expect(stored.blockPlacements).toEqual([]);
  });

  it("places an earned block, shows it in the structure, and keeps it after a reload", async () => {
    const user = setupUser();
    const { unmount } = render(<App />);

    await logTodaysRun(user);
    // Place Personal Block hands off to Build, where it hovers over the tower.
    await user.click(screen.getByRole("button", { name: "Place Personal Block" }));
    expect(screen.getByRole("button", { name: "Build" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Drop" }));
    const placed = within(
      screen.getByRole("list", { name: "Built blocks" }),
    ).getAllByRole("button");
    expect(placed).toHaveLength(1);
    expect(placed[0]).toHaveAccessibleName(
      "Tuesday, August 4, Easy, 2.1 miles, week 1, course 0, column 1",
    );
    expect(
      screen.queryByRole("list", { name: "Blocks ready to place" }),
    ).not.toBeInTheDocument();

    unmount();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Build" }));
    expect(
      within(screen.getByRole("list", { name: "Built blocks" })).getAllByRole(
        "button",
      ),
    ).toHaveLength(1);
  });
  it("offers four destinations and opens Settings from the header instead", async () => {
    const user = setupUser();
    render(<App />);

    const bar = within(screen.getByRole("navigation", { name: "Primary" }));
    expect(bar.getAllByRole("button").map((tab) => tab.textContent)).toEqual([
      "Today",
      "Build",
      "Runs",
      "Plan",
    ]);
    expect(
      bar.queryByRole("button", { name: "Settings" }),
    ).not.toBeInTheDocument();
    // Crew is a destination only for an active crew member, and this build has
    // no Race Crew configured at all.
    expect(bar.queryByRole("button", { name: "Crew" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Runs" }));
    expect(screen.getByRole("button", { name: "Runs" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    // Runs is personal only: the UI-19 `YOU | CREW` switch left with UI-21.
    expect(
      screen.queryByRole("tablist", { name: "Runs context" }),
    ).not.toBeInTheDocument();

    // The gear opens a sheet over the tab, and closing it leaves you on the
    // same tab rather than moving the app somewhere.
    const gear = screen.getByRole("button", { name: "Settings" });
    expect(gear).not.toHaveAttribute("aria-current");
    await user.click(gear);
    expect(
      within(screen.getByRole("dialog")).getByRole("heading", {
        name: "Settings",
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByRole("button", { name: "Runs" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("finds a run logged on Today from Runs, without going through Plan or Build", async () => {
    const user = setupUser();
    render(<App />);

    await logTodaysRun(user);
    await user.click(screen.getByRole("button", { name: "Runs" }));

    expect(screen.getByLabelText("Running history summary")).toHaveTextContent("1run");
    expect(screen.getByText("2.1 miles run")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Easy. Tuesday, August 4. 2.1 mi, 20:30, 9:46 /MI",
      }),
    ).toBeInTheDocument();
  });

  it("keeps a scheduled run attached to its day when it is edited from Runs", async () => {
    const user = setupUser();
    render(<App />);

    await logTodaysRun(user);
    await user.click(screen.getByRole("button", { name: "Runs" }));
    await user.click(screen.getByRole("button", { name: /^Easy\. Tuesday/ }));
    await user.click(screen.getByRole("button", { name: "Edit Run" }));
    await user.clear(screen.getByLabelText(/Distance/));
    await user.type(screen.getByLabelText(/Distance/), "2.6");
    await user.click(screen.getByRole("button", { name: "Save Run" }));

    // The day is still complete: editing what happened never edits the plan,
    // and never quietly turns a scheduled run into an extra one.
    await user.click(screen.getByRole("button", { name: "Plan" }));
    expect(screen.getByText("1 of 4 runs complete")).toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem("stack.app-state.v1") ?? "{}");
    expect(stored.runLogs).toHaveLength(1);
    expect(stored.runLogs[0].workoutId).toBe("workout-002");
    expect(stored.runLogs[0].distanceMiles).toBe(2.6);
  });

  it("deletes a run from Runs and takes its block out of the tower", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = setupUser();
    render(<App />);

    await logTodaysRun(user);
    await user.click(screen.getByRole("button", { name: "Place Personal Block" }));
    await user.click(screen.getByRole("button", { name: "Drop" }));

    await user.click(screen.getByRole("button", { name: "Runs" }));
    await user.click(screen.getByRole("button", { name: /^Easy\. Tuesday/ }));
    await user.click(screen.getByRole("button", { name: "Edit Run" }));
    await user.click(screen.getByRole("button", { name: "Delete Run" }));

    expect(screen.getByText("No runs yet")).toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem("stack.app-state.v1") ?? "{}");
    expect(stored.runLogs).toEqual([]);
    expect(stored.blockPlacements).toEqual([]);
    confirm.mockRestore();
  });
});
