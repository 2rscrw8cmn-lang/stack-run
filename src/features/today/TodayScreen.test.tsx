import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { BlockPlacement, RunLog } from "../../domain/types";
import type { CrewDashboardData, CrewSharedRun } from "../../crew/types";
import type { RaceCrewController } from "../../crew/useRaceCrew";
import { loadSeedPlan } from "../../seed/loadSeedPlan";
import { TodayScreen } from "./TodayScreen";

const plan = loadSeedPlan();

// Week 1 is Aug 3-9 2026: rest, easy (002), rest, easy (004), rest, easy (006),
// long (007). Aug 4 is a run day.
const completedEasyRun: RunLog = {
  id: "run-workout-002",
  workoutId: "workout-002",
  completedDate: "2026-08-04",
  activityType: "easy",
  distanceMiles: 2.1,
  durationSeconds: 1230,
  effort: "solid",
  notes: "",
  createdAt: "2026-08-04T12:00:00.000Z",
  updatedAt: "2026-08-04T12:00:00.000Z",
};

const extraRun: RunLog = {
  ...completedEasyRun,
  id: "run-extra-2026-08-05",
  workoutId: null,
  completedDate: "2026-08-05",
  distanceMiles: 3.4,
};

function placementFor(runLogId: string): BlockPlacement {
  return {
    runLogId,
    row: 0,
    columnStart: 1,
    width: 1,
    height: 1,
    placedAt: "2026-08-04T13:00:00.000Z",
  };
}

/**
 * A signed-in crew whose only shared run is the projection of one local run.
 * `crewBuildRow` is what makes it READY rather than already standing in the
 * shared tower.
 */
function crewWith(run: Partial<CrewSharedRun>): RaceCrewController {
  const shared: CrewSharedRun = {
    id: "shared-1",
    localRunId: "run-workout-002",
    userId: "zack",
    displayName: "Zack",
    accentColor: null,
    runnerIcon: { head: 0, face: 0, body: 0, flair: 0, background: 0 },
    localDate: "2026-08-04",
    activityType: "easy",
    distanceMiles: 2.1,
    durationSeconds: 1230,
    createdAt: "2026-08-04T13:00:00Z",
    updatedAt: "2026-08-04T13:00:00Z",
    buildRow: null,
    buildColumnStart: null,
    crewBuildRow: null,
    crewBuildColumnStart: null,
    crewBuildPlacedAt: null,
    propsCount: 0,
    viewerHasPropped: false,
    ...run,
  };
  const crewData: CrewDashboardData = {
    members: [],
    summaries: [],
    runs: [shared],
    miniBuildRuns: [],
    crewBuildRuns: [],
    sharedRunsAvailable: true,
    sharedRunsTruncated: false,
    propsAvailable: true,
    propNotifications: [],
    loadedAt: "2026-08-04T13:00:00Z",
  };
  return {
    status: "signed-in",
    account: { profile: { id: "zack", displayName: "Zack" }, crew: { id: "crew-1" } },
    crewData,
    propsPendingRunIds: [],
    propsErrors: {},
    refreshCrewData: vi.fn(async () => undefined),
    toggleProps: vi.fn(async () => undefined),
  } as unknown as RaceCrewController;
}

function renderToday(props: Partial<Parameters<typeof TodayScreen>[0]> = {}) {
  const onSaveRun = vi.fn();
  const onDeleteRun = vi.fn();
  const onViewPlan = vi.fn();
  const onViewBuild = vi.fn();
  const onStartPlacing = vi.fn();
  const user = userEvent.setup();
  const utils = render(
    <TodayScreen
      plan={plan}
      runLogs={[]}
      today="2026-08-04"
      onViewPlan={onViewPlan}
      onViewBuild={onViewBuild}
      onStartPlacing={onStartPlacing}
      onSaveRun={onSaveRun}
      onDeleteRun={onDeleteRun}
      {...props}
    />,
  );
  return {
    onSaveRun,
    onDeleteRun,
    onViewPlan,
    onViewBuild,
    onStartPlacing,
    user,
    ...utils,
  };
}

describe("TodayScreen race context", () => {
  it("shows the race as a compact line rather than a countdown hero", () => {
    renderToday({ today: "2026-08-04" });

    expect(screen.getByText("OUC Half Marathon")).toBeInTheDocument();
    // 2026-08-04 to race day on 2026-12-05.
    expect(screen.getByText("123 days")).toBeInTheDocument();
  });

  it("says race day rather than zero days", () => {
    renderToday({ today: "2026-12-05" });
    expect(screen.getByText("Race day")).toBeInTheDocument();
  });
});

describe("TodayScreen workout states", () => {
  it("shows the run state with a Mark Complete action", async () => {
    const { user } = renderToday();

    expect(screen.getByText("Today’s workout")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Mark Complete" }));
    expect(
      screen.getByRole("heading", { name: "Complete Run" }),
    ).toBeInTheDocument();
  });

  it("shows the rest-day state with no completion requirement", () => {
    renderToday({ today: "2026-08-05" });

    expect(screen.getByText("Rest Day")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Mark Complete" }),
    ).not.toBeInTheDocument();
  });

  /*
   * Issue #120: the completed state is one line of facts and whatever the run
   * still owes. Effort, the earned-block chip and the "built into the tower"
   * sentence are all gone — once the run exists, none of them is an action.
   */
  it("states the completed run as one compact line", () => {
    renderToday({ runLogs: [completedEasyRun] });

    expect(screen.getByText("2.1 mi · 20:30 · 9:46 /MI")).toBeInTheDocument();
    expect(screen.queryByText("Solid")).not.toBeInTheDocument();
    expect(screen.queryByText(/You earned an Easy block/)).not.toBeInTheDocument();
    // `View Build` survives only as the Build preview's own section link.
    expect(screen.getAllByRole("button", { name: /View Build/ })).toHaveLength(1);
  });

  it("shows the before-plan state without pretending a workout is due", () => {
    renderToday({ today: "2026-07-15" });

    expect(screen.getByText("Plan starts soon")).toBeInTheDocument();
    expect(screen.getByText(/Training begins Monday, August 3, 2026/)).toBeInTheDocument();
    expect(screen.queryByText("This Week")).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar", { name: /scheduled runs complete/ })).not.toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Mark Complete" }),
    ).not.toBeInTheDocument();
  });

  it("shows the after-race state once race day has passed", () => {
    renderToday({ today: "2026-12-31" });
    expect(screen.getByText("Race complete")).toBeInTheDocument();
    expect(screen.queryByText("This Week")).not.toBeInTheDocument();
    expect(screen.queryByText("Next")).not.toBeInTheDocument();
  });
});

describe("TodayScreen This Week", () => {
  it("appears on the first actual plan day", () => {
    renderToday({ today: "2026-08-03" });
    expect(screen.getByText("This Week")).toBeInTheDocument();
  });

  it("counts scheduled completion for the current week", () => {
    renderToday({ runLogs: [completedEasyRun], today: "2026-08-06" });

    // Week 1 schedules four runs; one of them is logged.
    expect(screen.getByText(/1 of 4 runs/)).toBeInTheDocument();
    expect(
      within(screen.getByRole("list", { name: "Week 1 days" })).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(7);
  });

  it("counts an extra run beside the scheduled progress, never inside it", () => {
    renderToday({
      runLogs: [completedEasyRun, extraRun],
      today: "2026-08-06",
    });

    expect(screen.getByText(/1 of 4 runs/)).toBeInTheDocument();
    expect(screen.getByText("+1 extra")).toBeInTheDocument();
  });

  it("adds up what was actually run without touching scheduled completion", () => {
    renderToday({
      runLogs: [completedEasyRun, extraRun],
      today: "2026-08-06",
    });

    // Scheduled progress is still one of four; the totals below it count both
    // runs, because the legs do not know which one the plan asked for.
    expect(screen.getByText(/1 of 4 runs/)).toBeInTheDocument();
    const totals = within(screen.getByRole("group", { name: "Week 1 actual totals" }));
    expect(totals.getByText("5.5")).toBeInTheDocument();
    expect(totals.getByText("41:00")).toBeInTheDocument();
    expect(totals.getByText("3.4 mi")).toBeInTheDocument();
  });

  it("says nothing about totals in a week with nothing in it", () => {
    renderToday({ today: "2026-08-06" });
    expect(screen.queryByRole("group", { name: /actual totals/ })).not.toBeInTheDocument();
  });

  it("links through to the full schedule", async () => {
    const { user, onViewPlan } = renderToday();

    await user.click(screen.getByRole("button", { name: "View Plan" }));
    expect(onViewPlan).toHaveBeenCalled();
  });
});

describe("TodayScreen Next", () => {
  it("shows the next scheduled run after today", () => {
    renderToday({ today: "2026-08-04" });

    const next = screen.getByText("Next").closest(".next-workout") as HTMLElement;
    // Aug 5 is a rest day, so the next run is Thursday Aug 6.
    expect(within(next).getByText(/Thursday, Aug 6/)).toBeInTheDocument();
  });

  it("omits the section when no run remains before the race", () => {
    renderToday({ today: "2026-12-05" });
    expect(screen.queryByText("Next")).not.toBeInTheDocument();
  });
});

describe("TodayScreen run entry", () => {
  it("does not duplicate the generic Log Run action from Runs", () => {
    renderToday({ today: "2026-08-05" });
    expect(screen.queryByRole("button", { name: "Log Run" })).not.toBeInTheDocument();
  });

  it("saves today's scheduled run against its workout", async () => {
    const { user, onSaveRun } = renderToday();

    await user.click(screen.getByRole("button", { name: "Mark Complete" }));
    await user.type(screen.getByLabelText(/Distance/), "2.1");
    await user.type(screen.getByLabelText(/Duration/), "2030");
    await user.click(screen.getByRole("button", { name: "Solid" }));
    await user.click(screen.getByRole("button", { name: "Save Run" }));

    expect(onSaveRun.mock.calls[0][0].id).toBe("workout-002");
    expect(
      screen.getByText("Run saved. You earned an Easy block."),
    ).toBeInTheDocument();
  });
});

describe("TodayScreen build preview", () => {
  it("keeps a pre-plan extra run real without activating Week 1", () => {
    const prePlanExtra = {
      ...extraRun,
      id: "run-extra-pre-plan",
      completedDate: "2026-07-14",
    };
    renderToday({ runLogs: [prePlanExtra], today: "2026-07-15" });

    expect(screen.getByText("Plan starts soon")).toBeInTheDocument();
    expect(screen.queryByText("This Week")).not.toBeInTheDocument();
    expect(screen.getByText("1 ready to place")).toBeInTheDocument();
  });

  it("summarises what has been built and what is waiting", () => {
    renderToday({
      runLogs: [completedEasyRun, extraRun],
      blockPlacements: [placementFor("run-workout-002")],
      today: "2026-08-06",
    });

    expect(screen.getByText("1 block built")).toBeInTheDocument();
    expect(screen.getByText("1 ready to place")).toBeInTheDocument();
  });

  it("links through to Build", async () => {
    const { user, onViewBuild } = renderToday();

    await user.click(screen.getByRole("button", { name: "View Build" }));
    expect(onViewBuild).toHaveBeenCalled();
  });
});

describe("TodayScreen earned block", () => {
  it("hands an unplaced block to Build by its run log", async () => {
    const { user, onStartPlacing } = renderToday({
      runLogs: [completedEasyRun],
    });

    await user.click(screen.getByRole("button", { name: "Place Personal Block" }));
    expect(onStartPlacing).toHaveBeenCalledWith("run-workout-002");
  });

  it("says nothing at all once the block is placed and nothing else is owed", () => {
    renderToday({
      runLogs: [completedEasyRun],
      blockPlacements: [placementFor("run-workout-002")],
    });

    expect(
      screen.queryByRole("button", { name: "Place Personal Block" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Place Crew Block" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/built into the tower/),
    ).not.toBeInTheDocument();
    // The compact summary and its quiet Edit are all that remain.
    expect(screen.getByText("2.1 mi · 20:30 · 9:46 /MI")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  /*
   * Issue #120: a run can owe two independent blocks, and Today offers each
   * only while it is actually owed (D-066).
   */
  it("offers both placements while both blocks are still owed", () => {
    renderToday({ runLogs: [completedEasyRun], raceCrew: crewWith({}) });

    expect(screen.getByRole("button", { name: "Place Personal Block" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Place Crew Block" })).toBeInTheDocument();
  });

  it("keeps offering the Crew block after the Personal block is placed", async () => {
    const onStartCrewPlacing = vi.fn();
    const { user } = renderToday({
      runLogs: [completedEasyRun],
      blockPlacements: [placementFor("run-workout-002")],
      raceCrew: crewWith({}),
      onStartCrewPlacing,
    });

    expect(
      screen.queryByRole("button", { name: "Place Personal Block" }),
    ).not.toBeInTheDocument();

    // And it enters placement for that exact shared run, not the Crew page.
    await user.click(screen.getByRole("button", { name: "Place Crew Block" }));
    expect(onStartCrewPlacing).toHaveBeenCalledWith("shared-1");
  });

  it("offers only the Personal block once the Crew block is standing", () => {
    renderToday({
      runLogs: [completedEasyRun],
      raceCrew: crewWith({ crewBuildRow: 0, crewBuildColumnStart: 1 }),
    });

    expect(screen.getByRole("button", { name: "Place Personal Block" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Place Crew Block" }),
    ).not.toBeInTheDocument();
  });

  it("offers no Crew block for a run that never became a shared contribution", () => {
    renderToday({
      runLogs: [completedEasyRun],
      raceCrew: crewWith({ localRunId: "some-other-run" }),
    });

    expect(
      screen.queryByRole("button", { name: "Place Crew Block" }),
    ).not.toBeInTheDocument();
  });

  it("deletes a logged run after confirming", async () => {
    const { user, onDeleteRun } = renderToday({ runLogs: [completedEasyRun] });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Delete Run" }));

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(onDeleteRun).toHaveBeenCalledWith("run-workout-002");
    confirm.mockRestore();
  });

  it("keeps the run when the confirmation is declined", async () => {
    const { user, onDeleteRun } = renderToday({ runLogs: [completedEasyRun] });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Delete Run" }));

    expect(onDeleteRun).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it("offers no delete on an entry that has not been saved yet", async () => {
    const { user } = renderToday();

    await user.click(screen.getByRole("button", { name: "Mark Complete" }));
    expect(
      screen.queryByRole("button", { name: "Delete Run" }),
    ).not.toBeInTheDocument();
  });

  it("edits a completed run through the same form", async () => {
    const { user, onSaveRun } = renderToday({ runLogs: [completedEasyRun] });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText(/Distance/)).toHaveValue("2.1");

    await user.clear(screen.getByLabelText(/Distance/));
    await user.type(screen.getByLabelText(/Distance/), "2.6");
    await user.click(screen.getByRole("button", { name: "Save Run" }));

    expect(onSaveRun).toHaveBeenCalledTimes(1);
    expect(onSaveRun.mock.calls[0][1]).toMatchObject({ distanceMiles: 2.6 });
    expect(onSaveRun.mock.calls[0][2]).toBe("run-workout-002");
  });
});

const candidate = {
  externalId: "i1",
  sourceType: "Run",
  completedDate: "2026-08-04",
  distanceMiles: 2.15,
  durationSeconds: 1230,
  sourceUpdatedAt: null,
  metrics: { averageHeartRate: 152 },
  inferredActivityType: "easy" as const,
};

describe("TodayScreen run found", () => {
  /*
   * Issue #120: a prompt, not the import workflow. Pace, heart rate, the
   * extra-run decision and the ignore control all belong to Run Data now.
   */
  it("names the synced run and what it looks like, and nothing more", () => {
    renderToday({ candidates: [candidate] });

    expect(screen.getByText("Run found")).toBeInTheDocument();
    expect(screen.getByText("2.15 mi · 20:30")).toBeInTheDocument();
    expect(screen.getByText(/^Looks like /)).toBeInTheDocument();
    expect(screen.queryByText("9:32 /MI")).not.toBeInTheDocument();
    expect(screen.queryByText(/bpm/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Extra Run" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Not now" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ignore this run" })).not.toBeInTheDocument();
    // Whatever sync found, the day's workout is still the thing on screen.
    expect(screen.getByText("Today’s workout")).toBeInTheDocument();
  });

  it("continues into the existing review rather than importing behind the user", async () => {
    const onReviewCandidate = vi.fn();
    const { user } = renderToday({ candidates: [candidate], onReviewCandidate });

    await user.click(screen.getByRole("button", { name: "Review Run →" }));
    expect(onReviewCandidate).toHaveBeenCalledWith(candidate);
  });

  it("leaves an older synced run to Run Data rather than putting it on Today", () => {
    renderToday({ candidates: [{ ...candidate, completedDate: "2026-07-28" }] });
    expect(screen.queryByText("Run found")).not.toBeInTheDocument();
  });

  it("reports a failed sync quietly and keeps the day's workout in place", async () => {
    const onRetrySync = vi.fn();
    const { user } = renderToday({ syncError: "Intervals.icu could not be reached.", onRetrySync });

    expect(screen.getByText("Today’s workout")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark Complete" })).toBeInTheDocument();
    expect(screen.getByText("Intervals.icu could not be reached.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetrySync).toHaveBeenCalled();
  });

  it("does not talk about sync while it has a run to offer", () => {
    renderToday({ candidates: [candidate], syncError: "Intervals.icu could not be reached." });
    expect(screen.queryByText("Intervals.icu could not be reached.")).not.toBeInTheDocument();
  });
});
