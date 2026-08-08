import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RunLog } from "../../domain/types";
import { loadSeedPlan } from "../../seed/loadSeedPlan";
import { PlanScreen } from "./PlanScreen";

const plan = loadSeedPlan();

// Week 1 is Aug 3-9 2026: rest, easy (002), rest, easy (004), rest,
// easy (006), long (007) — four scheduled runs. Week 2 starts Aug 10.
const easyTuesday = "Tuesday, August 4, 2 Miles, Easy, 2 mi";
const easyThursday = "Thursday, August 6, 2 Miles, Easy, 2 mi";
const longSunday = "Sunday, August 9, Long Run: 4 Miles, Long Run, 4 mi";

function runLogFor(workoutId: string, overrides: Partial<RunLog> = {}): RunLog {
  return {
    id: `run-${workoutId}`,
    workoutId,
    completedDate: "2026-08-04",
    activityType: "easy",
    distanceMiles: 2.4,
    durationSeconds: 1530,
    effort: "solid",
    notes: "Legs felt fresh",
    createdAt: "2026-08-04T12:00:00.000Z",
    updatedAt: "2026-08-04T12:00:00.000Z",
    ...overrides,
  };
}

function renderPlan(props: Partial<Parameters<typeof PlanScreen>[0]> = {}) {
  const onSaveRun = vi.fn();
  const user = userEvent.setup();
  const utils = render(
    <PlanScreen
      plan={plan}
      runLogs={[]}
      today="2026-08-06"
      onSaveRun={onSaveRun}
      {...props}
    />,
  );
  return { onSaveRun, user, ...utils };
}

function weekList() {
  return screen.getByRole("list", { name: /^Week \d+ workouts$/ });
}

describe("PlanScreen week navigation", () => {
  it("opens on the week containing today", () => {
    renderPlan({ today: "2026-08-12" });

    expect(screen.getByText("Week 2 of 18")).toBeInTheDocument();
    expect(screen.getByText("Aug 10 – Aug 16")).toBeInTheDocument();
    expect(screen.getByText("This week")).toBeInTheDocument();
  });

  it("opens on week 1 before the plan starts and week 18 after the race", () => {
    const { unmount } = renderPlan({ today: "2026-07-01" });
    expect(screen.getByText("Week 1 of 18")).toBeInTheDocument();
    unmount();

    renderPlan({ today: "2026-12-31" });
    expect(screen.getByText("Week 18 of 18")).toBeInTheDocument();
  });

  it("steps to the previous and next week", async () => {
    const { user } = renderPlan({ today: "2026-09-30" });
    expect(screen.getByText("Week 9 of 18")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next week" }));
    expect(screen.getByText("Week 10 of 18")).toBeInTheDocument();
    expect(screen.getByText("Oct 5 – Oct 11")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Previous week" }));
    await user.click(screen.getByRole("button", { name: "Previous week" }));
    expect(screen.getByText("Week 8 of 18")).toBeInTheDocument();
  });

  it("stops at the first week", async () => {
    const { user } = renderPlan({ today: "2026-08-06" });

    expect(screen.getByRole("button", { name: "Previous week" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Next week" }));
    expect(
      screen.getByRole("button", { name: "Previous week" }),
    ).toBeEnabled();
  });

  it("reaches all eighteen weeks and stops at the last one", async () => {
    const { user } = renderPlan({ today: "2026-08-06" });
    const next = () => screen.getByRole("button", { name: "Next week" });

    for (let weekNumber = 1; weekNumber <= 18; weekNumber += 1) {
      expect(screen.getByText(`Week ${weekNumber} of 18`)).toBeInTheDocument();
      expect(within(weekList()).getAllByRole("listitem")).toHaveLength(7);
      if (weekNumber < 18) {
        expect(next()).toBeEnabled();
        await user.click(next());
      }
    }

    expect(screen.getByText("Week 18 of 18")).toBeInTheDocument();
    expect(next()).toBeDisabled();
    expect(screen.getByText("Nov 30 – Dec 6")).toBeInTheDocument();
  });

  it("offers the current-week shortcut only when away from the current week", async () => {
    const { user } = renderPlan({ today: "2026-08-06" });
    expect(
      screen.queryByRole("button", { name: "Current Week" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next week" }));
    await user.click(screen.getByRole("button", { name: "Next week" }));
    expect(screen.getByText("Week 3 of 18")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Current Week" }));
    expect(screen.getByText("Week 1 of 18")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Current Week" }),
    ).not.toBeInTheDocument();
  });

  it("closes an open detail sheet when the week changes", async () => {
    const { user } = renderPlan();

    await user.click(
      screen.getByRole("button", { name: `${easyTuesday}, Missed` }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next week" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("PlanScreen week list", () => {
  it("shows all seven days, with rest days offering to be planned", () => {
    renderPlan();
    const rows = within(weekList()).getAllByRole("listitem");

    expect(rows).toHaveLength(7);
    // The row names the rest day and repeats it as its status.
    expect(within(rows[0]).getAllByText("Rest")).toHaveLength(2);
    expect(within(rows[0]).getByText("No scheduled run")).toBeInTheDocument();
    expect(within(rows[0]).getByRole("button")).toHaveAccessibleName(
      "Monday, August 3, Rest. Add a planned run",
    );
    expect(within(rows[1]).getByRole("button")).toBeInTheDocument();
  });

  it("shows target distance and type on a run row", () => {
    renderPlan();
    const row = screen.getByRole("button", { name: `${easyTuesday}, Missed` });

    expect(within(row).getByText("2 Miles")).toBeInTheDocument();
    expect(within(row).getByText("Easy · 2 mi")).toBeInTheDocument();
  });

  it("reports completed, missed, and planned status against the run logs", () => {
    renderPlan({ runLogs: [runLogFor("workout-004")] });

    // Tuesday's run is in the past and unlogged; Thursday is today and logged;
    // Saturday's long run is still ahead.
    expect(
      screen.getByRole("button", { name: `${easyTuesday}, Missed` }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: `${easyThursday}, Completed` }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: `${longSunday}, Planned` }),
    ).toBeInTheDocument();
  });

  it("shows the week's completion count and progress bar", () => {
    renderPlan({
      runLogs: [runLogFor("workout-002"), runLogFor("workout-004")],
    });

    // Week 1 schedules four runs; two of them are logged.
    expect(screen.getByText("2 of 4 runs complete")).toBeInTheDocument();
    const progress = screen.getByRole("progressbar", {
      name: "Week 1 progress",
    });
    expect(progress).toHaveAttribute("aria-valuenow", "2");
    expect(progress).toHaveAttribute("aria-valuemax", "4");
  });
});

describe("PlanScreen workout detail", () => {
  it("opens read-only details for a future run", async () => {
    const { user } = renderPlan({ today: "2026-08-03" });

    await user.click(
      screen.getByRole("button", { name: `${easyThursday}, Planned` }),
    );
    const sheet = screen.getByRole("dialog");

    expect(within(sheet).getByText("Planned")).toBeInTheDocument();
    expect(
      within(sheet).getByText("Easy conversational effort."),
    ).toBeInTheDocument();
    expect(
      within(sheet).queryByRole("button", { name: "Log Run" }),
    ).not.toBeInTheDocument();
    expect(
      within(sheet).queryByRole("button", { name: "Edit Run" }),
    ).not.toBeInTheDocument();
  });

  it("shows the actual result for a completed run", async () => {
    const { user } = renderPlan({ runLogs: [runLogFor("workout-002")] });

    await user.click(
      screen.getByRole("button", { name: `${easyTuesday}, Completed` }),
    );
    const sheet = screen.getByRole("dialog");

    expect(within(sheet).getByText("2.4 mi")).toBeInTheDocument();
    expect(within(sheet).getByText("25:30")).toBeInTheDocument();
    expect(within(sheet).getByText("Solid")).toBeInTheDocument();
    expect(within(sheet).getByText("Legs felt fresh")).toBeInTheDocument();
  });

  it("logs a past incomplete run from the detail sheet", async () => {
    const { user, onSaveRun } = renderPlan();

    await user.click(
      screen.getByRole("button", { name: `${easyTuesday}, Missed` }),
    );
    await user.click(screen.getByRole("button", { name: "Log Run" }));

    // The detail sheet gives way to run entry, so only one sheet is ever open.
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(
      screen.getByRole("heading", { name: "Complete Run" }),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Distance/), "2.1");
    await user.type(screen.getByLabelText(/Duration/), "2030");
    await user.click(screen.getByRole("button", { name: "Solid" }));
    await user.click(screen.getByRole("button", { name: "Save Run" }));

    expect(onSaveRun).toHaveBeenCalledTimes(1);
    const [workout, values] = onSaveRun.mock.calls[0];
    expect(workout.id).toBe("workout-002");
    expect(workout.date).toBe("2026-08-04");
    expect(values).toEqual({
      completedDate: "2026-08-04",
      activityType: "easy",
      distanceMiles: 2.1,
      durationSeconds: 1230,
      effort: "solid",
      notes: "",
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("edits a completed run from the detail sheet", async () => {
    const { user, onSaveRun } = renderPlan({
      runLogs: [runLogFor("workout-002")],
    });

    await user.click(
      screen.getByRole("button", { name: `${easyTuesday}, Completed` }),
    );
    await user.click(screen.getByRole("button", { name: "Edit Run" }));

    const distance = screen.getByLabelText(/Distance/);
    expect(distance).toHaveValue("2.4");
    expect(screen.getByLabelText(/Duration/)).toHaveValue("25:30");

    await user.clear(distance);
    await user.type(distance, "2.6");
    await user.click(screen.getByRole("button", { name: "Save Run" }));

    expect(onSaveRun).toHaveBeenCalledTimes(1);
    expect(onSaveRun.mock.calls[0][1]).toMatchObject({ distanceMiles: 2.6 });
  });

  it("starts run entry fresh after a discarded draft", async () => {
    const { user } = renderPlan();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);

    await user.click(
      screen.getByRole("button", { name: `${easyTuesday}, Missed` }),
    );
    await user.click(screen.getByRole("button", { name: "Log Run" }));
    await user.type(screen.getByLabelText(/Distance/), "9.9");
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(confirm).toHaveBeenCalledTimes(1);

    await user.click(
      screen.getByRole("button", { name: `${easyTuesday}, Missed` }),
    );
    await user.click(screen.getByRole("button", { name: "Log Run" }));
    expect(screen.getByLabelText(/Distance/)).toHaveValue("");
    confirm.mockRestore();
  });

  it("does not offer logging for a run that is still in the future", async () => {
    const { user } = renderPlan({ today: "2026-08-03" });

    await user.click(
      screen.getByRole("button", { name: `${longSunday}, Planned` }),
    );
    expect(
      screen.queryByRole("button", { name: "Log Run" }),
    ).not.toBeInTheDocument();
  });

  it("logs today's scheduled run from the current week", async () => {
    const { user, onSaveRun } = renderPlan();

    await user.click(
      screen.getByRole("button", { name: `${easyThursday}, Planned` }),
    );
    await user.click(screen.getByRole("button", { name: "Log Run" }));
    await user.type(screen.getByLabelText(/Distance/), "2");
    await user.type(screen.getByLabelText(/Duration/), "2000");
    await user.click(screen.getByRole("button", { name: "Great" }));
    await user.click(screen.getByRole("button", { name: "Save Run" }));

    expect(onSaveRun.mock.calls[0][0].id).toBe("workout-004");
  });
});
