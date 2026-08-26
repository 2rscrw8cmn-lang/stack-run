import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { BlockPlacement, RunActivityType, RunLog } from "../../domain/types";
import type { CrewDashboardData, CrewSharedRun } from "../../crew/types";
import type { RaceCrewController } from "../../crew/useRaceCrew";
import type { RunnerRun } from "../../history/runnerRun";
import type { PlanAdjustmentRecord } from "../../domain/planProvenance";
import { signalRuns } from "../../signals/signalTestRuns";
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

/**
 * A run the runner did that STACK holds only as connected history — never
 * logged, never accepted, carrying no STACK overlay. It is still a run, so it
 * is still what Today reports as this runner's actual training.
 */
function historicalRun(date: string, distanceMiles: number): RunnerRun {
  return {
    id: `history:intervals:${date}`,
    date,
    startTimeLocal: `${date}T07:00:00`,
    distanceMiles,
    durationSeconds: Math.round(distanceMiles * 540),
    paceSecondsPerMile: 540,
    averageHeartRate: null,
    maxHeartRate: null,
    hrZoneSeconds: null,
    elevationGainFeet: null,
    averageCadence: null,
    trainingLoad: null,
    sourceName: "Morning Run",
    sourceType: "Run",
    externalActivityId: date,
    origin: "historical-activity",
    isReconciled: false,
    stack: null,
  };
}

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
      {...props}
    />,
  );
  return {
    onSaveRun,
    onViewPlan,
    onViewBuild,
    onStartPlacing,
    user,
    ...utils,
  };
}

describe("TodayScreen race context", () => {
  it("keeps Today useful without inventing a race or rest day", async () => {
    const { onViewPlan, user } = renderToday({ plan: null });

    expect(screen.queryByText("OUC Half Marathon")).not.toBeInTheDocument();
    expect(screen.queryByText("Rest Day")).not.toBeInTheDocument();
    expect(screen.getByText("Running without a race plan")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your Build" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Set up a race plan" }));
    expect(onViewPlan).toHaveBeenCalledTimes(1);
  });

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

  /*
   * Issue #152: the plan states the same fact three times — `easy`, the title
   * `2 Miles`, and the target `2`. The card names the type once, leads with
   * the target once, and keeps the instruction, which is the line a runner
   * reads before going out.
   */
  it("states the scheduled run once rather than three times", () => {
    const { container } = renderToday({ today: "2026-08-06" });

    const card = container.querySelector(".today-action") as HTMLElement;
    expect(card).not.toBeNull();
    expect(within(card).getAllByText("Easy")).toHaveLength(1);
    expect(within(card).getByText("2 mi")).toBeInTheDocument();
    expect(within(card).queryByText("2 Miles")).toBeNull();
    expect(
      within(card).getByText("Easy conversational effort."),
    ).toBeInTheDocument();
  });

  /* `Long Run: 4 Miles` is the type and the target again, so neither repeats. */
  it("drops a title that only restates the type and the target", () => {
    const { container } = renderToday({ today: "2026-08-09" });

    const card = container.querySelector(".today-action") as HTMLElement;
    expect(within(card).getByText("Long Run")).toBeInTheDocument();
    expect(within(card).getByText("4 mi")).toBeInTheDocument();
    expect(within(card).queryByText(/Long Run: 4 Miles/)).toBeNull();
  });

  /* Both states of the same card, so Today has one action surface (#152). */
  it("uses one card for the scheduled run and for what it still owes", () => {
    const { container } = renderToday({ today: "2026-08-06" });
    expect(
      container.querySelector('.today-action[data-state="scheduled"]'),
    ).not.toBeNull();

    const completed = renderToday({ runLogs: [completedEasyRun] });
    expect(
      completed.container.querySelector('.today-action[data-state="complete"]'),
    ).not.toBeNull();
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
    // A week that has not started cannot report scheduled progress, and Today
    // does not invent one for it.
    expect(screen.queryByRole("progressbar", { name: /scheduled runs complete/ })).not.toBeInTheDocument();
    expect(screen.getByText("Up next")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Mark Complete" }),
    ).not.toBeInTheDocument();
  });

  it("shows the after-race state once race day has passed", () => {
    renderToday({ today: "2026-12-31" });
    expect(screen.getByText("Race complete")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar", { name: /scheduled runs complete/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Up next")).not.toBeInTheDocument();
  });

  it("drops the countdown once the race is behind the runner", () => {
    renderToday({ today: "2026-12-31" });
    expect(screen.getByText("OUC Half Marathon")).toBeInTheDocument();
    expect(screen.queryByText("Race day")).not.toBeInTheDocument();
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
    expect(screen.getByText(/1 of 4 scheduled/)).toBeInTheDocument();
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

    expect(screen.getByText(/1 of 4 scheduled/)).toBeInTheDocument();
    expect(screen.getByText("+1 extra")).toBeInTheDocument();
  });

  it("leads with what was actually run and keeps scheduled progress beside it", () => {
    renderToday({
      runLogs: [completedEasyRun, extraRun],
      today: "2026-08-06",
    });

    // Actuals first: both runs count, because the legs do not know which one
    // the plan asked for. Scheduled progress is still one of four.
    const actual = within(screen.getByLabelText("Actually run this week"));
    expect(actual.getByText("5.5")).toBeInTheDocument();
    expect(actual.getByText("2 runs")).toBeInTheDocument();
    expect(screen.getByText(/1 of 4 scheduled/)).toBeInTheDocument();
  });

  it("reports an empty week as zero miles rather than hiding the week", () => {
    renderToday({ today: "2026-08-06" });
    const actual = within(screen.getByLabelText("Actually run this week"));
    expect(actual.getByText("0")).toBeInTheDocument();
    expect(actual.getByText("0 runs")).toBeInTheDocument();
  });

  it("counts a connected run STACK never accepted as running this week", () => {
    renderToday({
      runnerRuns: [historicalRun("2026-08-05", 6.2)],
      today: "2026-08-06",
    });

    const actual = within(screen.getByLabelText("Actually run this week"));
    expect(actual.getByText("6.2")).toBeInTheDocument();
    // It is a run, not a completed workout: the plan count is untouched.
    expect(screen.getByText(/0 of 4 scheduled/)).toBeInTheDocument();
  });

  it("keeps the week outside the plan, without a schedule to report", () => {
    renderToday({
      runnerRuns: [historicalRun("2026-07-14", 4)],
      today: "2026-07-15",
    });

    expect(screen.getByText("This Week")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View Plan" })).not.toBeInTheDocument();
  });

  it("links through to the full schedule", async () => {
    const { user, onViewPlan } = renderToday();

    await user.click(screen.getByRole("button", { name: "View Plan" }));
    expect(onViewPlan).toHaveBeenCalled();
  });
});

describe("TodayScreen Up next", () => {
  it("shows the next scheduled run after today", () => {
    renderToday({ today: "2026-08-04" });

    const next = screen.getByText("Up next").closest(".next-workout") as HTMLElement;
    // Aug 5 is a rest day, so the next run is Thursday Aug 6.
    expect(within(next).getByText(/Thursday, Aug 6/)).toBeInTheDocument();
  });

  it("omits the section when no run remains before the race", () => {
    renderToday({ today: "2026-12-05" });
    expect(screen.queryByText("Up next")).not.toBeInTheDocument();
  });
});

describe("TodayScreen assistant provenance (#182)", () => {
  const nextWorkout = plan.weeks[0]!.workouts.find((w) => w.date === "2026-08-06")!;
  const todayWorkout = plan.weeks[0]!.workouts.find((w) => w.date === "2026-08-04")!;

  function adjustmentFor(workoutId: string, workout: typeof nextWorkout): PlanAdjustmentRecord {
    return {
      id: "adj-1",
      operations: [{
        op: "editRun",
        workoutId,
        // Both fixture workouts (Aug 4 and Aug 6) are real run days, never rest.
        values: { type: workout.type as RunActivityType, title: workout.title, targetDistanceMiles: workout.targetDistanceMiles, details: workout.details },
      }],
      reason: null,
      beforeWorkouts: [{ ...workout, title: "Old title" }],
      resultingPlanRevision: plan.revision,
      createdAt: "2026-08-01T00:00:00Z",
    };
  }

  it("shows the sparkle on Up next when the ledger matches it", () => {
    renderToday({
      today: "2026-08-04",
      raceCrew: { ...crewWith({}), planAdjustments: [adjustmentFor(nextWorkout.id, nextWorkout)] },
    });
    expect(screen.getByRole("button", { name: "Assistant-adjusted — view change" })).toBeInTheDocument();
  });

  it("never shows a sparkle on today's own workout, even if the ledger names it", () => {
    renderToday({
      today: "2026-08-04",
      raceCrew: { ...crewWith({}), planAdjustments: [adjustmentFor(todayWorkout.id, todayWorkout)] },
    });
    // Today's own workout can never have been assistant-adjusted (only strictly
    // future workouts can), so nothing here should ever check the ledger for it.
    expect(screen.queryByRole("button", { name: "Assistant-adjusted — view change" })).not.toBeInTheDocument();
  });

  it("undoes through onEditPlan when Undo is used from Up next", async () => {
    const onEditPlan = vi.fn();
    const { user } = renderToday({
      today: "2026-08-04",
      onEditPlan,
      raceCrew: { ...crewWith({}), planAdjustments: [adjustmentFor(nextWorkout.id, nextWorkout)] },
    });
    await user.click(screen.getByRole("button", { name: "Assistant-adjusted — view change" }));
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(onEditPlan).toHaveBeenCalledTimes(1);
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
    // Today records runs; it never saves over one (issue #152).
    expect(onSaveRun.mock.calls[0][2]).toBeUndefined();
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
    expect(screen.queryByRole("progressbar", { name: /scheduled runs complete/ })).not.toBeInTheDocument();
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

  /*
   * Issue #152: a run that owes nothing is a fact, not an action, so the card
   * retires. One line of confirmation is left, and editing goes back to Runs
   * with the rest of the record.
   */
  it("collapses the card once the block is placed and nothing else is owed", () => {
    const { container } = renderToday({
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
    expect(container.querySelector(".today-action")).toBeNull();

    // What is left says the run happened, and stops there.
    expect(screen.getByText("Run complete")).toBeInTheDocument();
    expect(screen.getByText("2.1 mi · 20:30 · 9:46 /MI")).toBeInTheDocument();
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

  /*
   * Issue #152: Today logs a run and hands over the blocks it earned. Nothing
   * on this screen corrects or deletes a recorded run — that is Runs/Run
   * Detail's job, with the rest of the runner's record.
   */
  it("offers no way to edit or delete a run it has already recorded", () => {
    renderToday({ runLogs: [completedEasyRun] });

    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete Run" }),
    ).not.toBeInTheDocument();
  });

  it("offers no delete on an entry that has not been saved yet", async () => {
    const { user } = renderToday();

    await user.click(screen.getByRole("button", { name: "Mark Complete" }));
    expect(
      screen.queryByRole("button", { name: "Delete Run" }),
    ).not.toBeInTheDocument();
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
   * Issue #153: a likely completion becomes the one Today Action Card. It is
   * still a prompt, not the import workflow: the decision remains in Run Data.
   */
  it("replaces the manual completion card with the suggested synced run", () => {
    const { container } = renderToday({ candidates: [candidate] });

    expect(screen.getByText("Run found")).toBeInTheDocument();
    expect(screen.getByText("2.15 mi · 20:30")).toBeInTheDocument();
    expect(screen.getByText(/^Looks like /)).toBeInTheDocument();
    expect(
      container.querySelectorAll('.today-action[data-state="found"]'),
    ).toHaveLength(1);
    expect(container.querySelectorAll(".today-action")).toHaveLength(1);
    expect(screen.queryByText("Today’s workout")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Mark Complete" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("9:32 /MI")).not.toBeInTheDocument();
    expect(screen.queryByText(/bpm/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Extra Run" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Not now" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ignore this run" })).not.toBeInTheDocument();
  });

  it("continues into the existing review rather than importing behind the user", async () => {
    const onReviewCandidate = vi.fn();
    const { user } = renderToday({ candidates: [candidate], onReviewCandidate });

    await user.click(screen.getByRole("button", { name: "Review Run →" }));
    expect(onReviewCandidate).toHaveBeenCalledWith(candidate);
  });

  it("promotes a late sync without reopening Today", () => {
    const props = {
      plan,
      runLogs: [] as RunLog[],
      today: "2026-08-04",
      onViewPlan: vi.fn(),
      onSaveRun: vi.fn(),
    };
    const { container, rerender } = render(<TodayScreen {...props} />);
    expect(screen.getByText("Today’s workout")).toBeInTheDocument();

    rerender(<TodayScreen {...props} candidates={[candidate]} />);

    expect(screen.getByText("Run found")).toBeInTheDocument();
    expect(screen.queryByText("Today’s workout")).not.toBeInTheDocument();
    expect(container.querySelectorAll(".today-action")).toHaveLength(1);
  });

  it("keeps an unmatched run as an explicit Extra review when no workout is due", async () => {
    const extraCandidate = { ...candidate, completedDate: "2026-07-15" };
    const onReviewCandidate = vi.fn();
    const { user } = renderToday({
      today: "2026-07-15",
      candidates: [extraCandidate],
      onReviewCandidate,
    });

    expect(screen.getByText("Run found")).toBeInTheDocument();
    expect(screen.getByText("Wed, Jul 15")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark Complete" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Review Run →" }));
    expect(onReviewCandidate).toHaveBeenCalledWith(extraCandidate);
  });

  it("does not let an unrelated candidate displace today's scheduled workout", () => {
    renderToday({
      candidates: [{ ...candidate, completedDate: "2026-08-01" }],
    });

    expect(screen.getByText("Today’s workout")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark Complete" })).toBeInTheDocument();
    expect(screen.queryByText("Run found")).not.toBeInTheDocument();
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

describe("TodayScreen recent training", () => {
  it("orients the runner in two or three facts, each with its window", () => {
    // Sep 17 is a scheduled easy run: the context sits under the workout, not
    // instead of it.
    renderToday({
      runnerRuns: signalRuns({
        today: "2026-09-17",
        current: { runCount: 8, options: { miles: 5 } },
        baseline: { runCount: 8, options: { miles: 5 } },
      }),
      today: "2026-09-17",
    });

    const context = within(screen.getByRole("group", { name: "Recent training" }));
    expect(context.getByText("Last 28 days")).toBeInTheDocument();
    expect(context.getByText("Last 8 wks")).toBeInTheDocument();
    expect(context.getByText("Longest 28d")).toBeInTheDocument();
  });

  it("says nothing rather than explaining that it has nothing to say", () => {
    renderToday({ today: "2026-08-04" });
    expect(screen.queryByRole("group", { name: "Recent training" })).not.toBeInTheDocument();
    expect(screen.queryByText(/not enough history/i)).not.toBeInTheDocument();
  });

  it("keeps working on a rest day, which is the point of having it", () => {
    // Sep 16 is a rest day: the plan has nothing to say, and the screen does.
    renderToday({
      runnerRuns: signalRuns({
        today: "2026-09-16",
        current: { runCount: 8, options: { miles: 5 } },
        baseline: { runCount: 8, options: { miles: 5 } },
      }),
      today: "2026-09-16",
    });

    expect(screen.getByText("Rest Day")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Recent training" })).toBeInTheDocument();
    expect(screen.getByText("This Week")).toBeInTheDocument();
    expect(screen.getByText("Your Build")).toBeInTheDocument();
  });
});

describe("TodayScreen observation", () => {
  const today = "2026-09-16";
  const rising = signalRuns({
    today,
    current: { runCount: 8, options: { miles: 5 } },
    baseline: { runCount: 6, options: { miles: 4 } },
  });

  it("shows one observation, with the evidence NEXT-3 already computed", () => {
    renderToday({ runnerRuns: rising, today, onViewRuns: vi.fn() });

    expect(screen.getByText("Volume is building")).toBeInTheDocument();
    expect(
      screen.getByText(/40 mi in the last 28 days, up from 24 mi in the 28 before\./),
    ).toBeInTheDocument();
  });

  it("shows exactly one, never a list", () => {
    const { container } = renderToday({ runnerRuns: rising, today, onViewRuns: vi.fn() });
    expect(container.querySelectorAll(".today-signal")).toHaveLength(1);
    expect(screen.queryByText("Training Signals")).not.toBeInTheDocument();
  });

  it("does not repeat the number the observation already states", () => {
    renderToday({ runnerRuns: rising, today, onViewRuns: vi.fn() });
    const context = within(screen.getByRole("group", { name: "Recent training" }));
    expect(context.queryByText("Last 28 days")).not.toBeInTheDocument();
    expect(context.getByText("Last 8 wks")).toBeInTheDocument();
  });

  it("observes without advising", () => {
    renderToday({ runnerRuns: rising, today, onViewRuns: vi.fn() });
    expect(screen.queryByText(/take it easy|should|recovered|ready|try to/i)).not.toBeInTheDocument();
  });

  it("routes into Runs rather than opening a second detail sheet", async () => {
    const onViewRuns = vi.fn();
    const { user } = renderToday({ runnerRuns: rising, today, onViewRuns });

    await user.click(screen.getByRole("button", { name: /Volume is building/ }));
    expect(onViewRuns).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows nothing when the runner's training has not changed", () => {
    const { container } = renderToday({
      runnerRuns: signalRuns({
        today,
        current: { runCount: 8, options: { miles: 5 } },
        baseline: { runCount: 8, options: { miles: 5 } },
      }),
      today,
      onViewRuns: vi.fn(),
    });
    expect(container.querySelectorAll(".today-signal")).toHaveLength(0);
  });
});
