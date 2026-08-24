import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RunLog } from "../../domain/types";
import { historicalRun } from "../../history/runnerFixtures";
import { unifiedRunnerHistory } from "../../history/runnerRun";
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

/** The week is the screen's heading; there is no separate "Plan" title. */
function weekHeading() {
  return screen.getByRole("heading", { level: 1 });
}

describe("PlanScreen without an active plan", () => {
  it("offers setup and opens an archived plan read-only", async () => {
    const archive = {
      id: "archive-ouc",
      plan,
      baselinePlan: plan,
      baselineOrigin: "created" as const,
      raceGoal: { type: "none" as const },
      finalRevision: 1,
      raceSetup: null,
      runLinks: {},
      archivedAt: "2026-12-06T12:00:00.000Z",
    };
    const { user } = renderPlan({
      plan: null,
      planHistory: [archive],
      onGeneratePlan: vi.fn(),
    });

    expect(weekHeading()).toHaveTextContent("No active race plan");
    expect(screen.getByRole("button", { name: "Set Up Next Race" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /OUC Half Marathon/ }));

    expect(weekHeading()).toHaveTextContent("Week 1 of 18");
    expect(screen.getByRole("button", { name: "Race plan history" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Tuesday, August 4/ }));
    expect(screen.queryByRole("button", { name: "Log Run" })).not.toBeInTheDocument();
  });

  it("keeps archived plans readable while a newer plan is active", async () => {
    const { user } = renderPlan({
      planHistory: [{
        id: "archive-old",
        plan: { ...plan, id: "old-plan", race: { ...plan.race, name: "Earlier Race" } },
        baselinePlan: { ...plan, id: "old-plan", race: { ...plan.race, name: "Earlier Race" } },
        baselineOrigin: "created",
        raceGoal: { type: "none" },
        finalRevision: 1,
        raceSetup: null,
        runLinks: {},
        archivedAt: "2026-01-01T12:00:00.000Z",
      }],
    });

    await user.click(screen.getByRole("button", { name: /Earlier Race/ }));
    expect(screen.getByRole("button", { name: "Race plan history" })).toBeInTheDocument();
  });
});

describe("PlanScreen week navigation", () => {
  it("opens on the week containing today", () => {
    renderPlan({ today: "2026-08-12" });

    expect(weekHeading()).toHaveTextContent("Week 2 of 18");
    expect(screen.getByText("Aug 10 – Aug 16")).toBeInTheDocument();
    expect(screen.getByText("This week")).toBeInTheDocument();
  });

  it("opens on week 1 before the plan starts and week 18 after the race", () => {
    const { unmount } = renderPlan({ today: "2026-07-01" });
    expect(weekHeading()).toHaveTextContent("Week 1 of 18");
    expect(screen.getByText("Plan starts Aug 3")).toBeInTheDocument();
    expect(screen.queryByText("This week")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Current Week" })).not.toBeInTheDocument();
    unmount();

    renderPlan({ today: "2026-12-31" });
    expect(weekHeading()).toHaveTextContent("Week 18 of 18");
    expect(screen.getByText("Plan complete")).toBeInTheDocument();
    expect(screen.queryByText("This week")).not.toBeInTheDocument();
  });

  it("steps to the previous and next week", async () => {
    const { user } = renderPlan({ today: "2026-09-30" });
    expect(weekHeading()).toHaveTextContent("Week 9 of 18");

    await user.click(screen.getByRole("button", { name: "Next week" }));
    expect(weekHeading()).toHaveTextContent("Week 10 of 18");
    expect(screen.getByText("Oct 5 – Oct 11")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Previous week" }));
    await user.click(screen.getByRole("button", { name: "Previous week" }));
    expect(weekHeading()).toHaveTextContent("Week 8 of 18");
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
      expect(weekHeading()).toHaveTextContent(`Week ${weekNumber} of 18`);
      expect(within(weekList()).getAllByRole("listitem")).toHaveLength(7);
      if (weekNumber < 18) {
        expect(next()).toBeEnabled();
        await user.click(next());
      }
    }

    expect(weekHeading()).toHaveTextContent("Week 18 of 18");
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
    expect(weekHeading()).toHaveTextContent("Week 3 of 18");

    await user.click(screen.getByRole("button", { name: "Current Week" }));
    expect(weekHeading()).toHaveTextContent("Week 1 of 18");
    expect(
      screen.queryByRole("button", { name: "Current Week" }),
    ).not.toBeInTheDocument();
  });

  it("closes an open detail sheet when the week changes", async () => {
    const { user } = renderPlan();

    await user.click(
      screen.getByRole("button", { name: `${easyTuesday}, No linked run` }),
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
    expect(within(rows[0]).getAllByText("Rest")).toHaveLength(2);
    expect(within(rows[0]).getByText("No scheduled run")).toBeInTheDocument();
    expect(within(rows[0]).getByRole("button")).toHaveAccessibleName(
      "Monday, August 3, Rest. Add a planned run",
    );
    expect(within(rows[1]).getByRole("button")).toBeInTheDocument();
  });

  it("shows target distance and type on a run row", () => {
    renderPlan();
    const row = screen.getByRole("button", { name: `${easyTuesday}, No linked run` });

    expect(within(row).getByText("2 Miles")).toBeInTheDocument();
    expect(within(row).getByText("Easy · 2 mi")).toBeInTheDocument();
  });

  it("reports linked, unlinked, and planned relationship states", () => {
    renderPlan({ runLogs: [runLogFor("workout-004")] });

    // Tuesday is past without an explicit plan link; Thursday is linked;
    // Sunday's long run is still future intent.
    expect(
      screen.getByRole("button", { name: `${easyTuesday}, No linked run` }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: `${easyThursday}, Completed` }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: `${longSunday}, Planned` }),
    ).toBeInTheDocument();
  });

  it("separates planned intent, actual history, and explicit plan links", () => {
    renderPlan({
      runLogs: [runLogFor("workout-002"), runLogFor("workout-004")],
    });

    const summary = screen.getByLabelText("Week 1 plan and actual context");
    expect(within(summary).getByText("4 planned runs")).toBeInTheDocument();
    expect(within(summary).getByText("4.8 mi actual")).toBeInTheDocument();
    expect(within(summary).getByText("2 runs")).toBeInTheDocument();
    expect(screen.getByText("2 of 4 plan runs linked")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar", { name: "Week 1 progress" })).not.toBeInTheDocument();
  });

  it("counts historical-only running as actual without pretending it satisfies the plan", () => {
    const runnerRuns = unifiedRunnerHistory({
      activities: [historicalRun("history-aug4", "2026-08-04", { miles: 6.2 })],
    });

    renderPlan({ runnerRuns });

    const summary = screen.getByLabelText("Week 1 plan and actual context");
    expect(within(summary).getByText("6.2 mi actual")).toBeInTheDocument();
    expect(within(summary).getByText("1 run")).toBeInTheDocument();
    expect(screen.getByText("0 of 4 plan runs linked")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: `${easyTuesday}, No linked run` }),
    ).toBeInTheDocument();
  });

  it("does not headline zero actuals for a week that has not happened yet", async () => {
    const { user } = renderPlan({ today: "2026-08-06" });
    await user.click(screen.getByRole("button", { name: "Next week" }));

    const summary = screen.getByLabelText("Week 2 plan and actual context");
    expect(within(summary).getByText(/planned run/)).toBeInTheDocument();
    expect(within(summary).queryByText(/actual/)).not.toBeInTheDocument();
    expect(screen.queryByText(/plan runs linked/)).not.toBeInTheDocument();
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

  it("shows truthful relationship language for a past unlinked plan item", async () => {
    const { user } = renderPlan();

    await user.click(
      screen.getByRole("button", { name: `${easyTuesday}, No linked run` }),
    );
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByText("No linked run")).toBeInTheDocument();
    expect(within(sheet).queryByText("Missed")).not.toBeInTheDocument();
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

  it("logs a past unlinked run from the detail sheet", async () => {
    const { user, onSaveRun } = renderPlan();

    await user.click(
      screen.getByRole("button", { name: `${easyTuesday}, No linked run` }),
    );
    await user.click(screen.getByRole("button", { name: "Log Run" }));

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
      manualHeartRate: null,
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
      screen.getByRole("button", { name: `${easyTuesday}, No linked run` }),
    );
    await user.click(screen.getByRole("button", { name: "Log Run" }));
    await user.type(screen.getByLabelText(/Distance/), "9.9");
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(confirm).toHaveBeenCalledTimes(1);

    await user.click(
      screen.getByRole("button", { name: `${easyTuesday}, No linked run` }),
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
