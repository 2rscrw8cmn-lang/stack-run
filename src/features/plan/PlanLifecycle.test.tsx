import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { earnedBlocks } from "../../domain/build";
import { findWorkout } from "../../domain/planEdit";
import type { RunLog, TrainingPlan } from "../../domain/types";
import { historicalRun } from "../../history/runnerFixtures";
import { unifiedRunnerHistory } from "../../history/runnerRun";
import { loadSeedPlan } from "../../seed/loadSeedPlan";
import { PlanScreen } from "./PlanScreen";

/**
 * NEXT-5 lifecycle behavior.
 *
 * A plan has edges. Before its start date every week is a preview of what it
 * will ask for; after race day every week is the structure the race was built
 * on. Neither edge is a statement about the runner, and neither one may claim
 * that a week nobody trained went wrong.
 */
const seed = loadSeedPlan();

// The seed plan runs Aug 3 – Dec 6 2026 for a Dec 5 race.
const BEFORE_PLAN = "2026-07-20";
const DURING_PLAN = "2026-08-06";
const AFTER_RACE = "2026-12-31";

function runLogFor(workoutId: string): RunLog {
  return {
    id: `run-${workoutId}`,
    workoutId,
    completedDate: "2026-08-04",
    activityType: "easy",
    distanceMiles: 2.4,
    durationSeconds: 1530,
    effort: "solid",
    notes: "",
    createdAt: "2026-08-04T12:00:00.000Z",
    updatedAt: "2026-08-04T12:00:00.000Z",
  };
}

function renderPlan(props: Partial<Parameters<typeof PlanScreen>[0]> = {}) {
  const onEditPlan = vi.fn();
  const user = userEvent.setup();
  const utils = render(
    <PlanScreen
      plan={seed}
      runLogs={[]}
      today={DURING_PLAN}
      onEditPlan={onEditPlan}
      {...props}
    />,
  );
  return { onEditPlan, user, ...utils };
}

function weekHeading() {
  return screen.getByRole("heading", { level: 1 });
}

function lifecycleNote() {
  return screen.queryByRole("region", { name: "Plan lifecycle" });
}

describe("Plan before the plan starts", () => {
  it("previews week 1 without claiming the runner missed anything", () => {
    renderPlan({ today: BEFORE_PLAN });

    expect(weekHeading()).toHaveTextContent("Week 1 of 18");
    const note = lifecycleNote()!;
    expect(within(note).getByText("Plan starts Aug 3")).toBeInTheDocument();
    expect(
      within(note).getByText(/Training has not started yet/),
    ).toBeInTheDocument();

    // Every scheduled day is still intent. Nothing is late, missed, unlinked
    // or incomplete before the plan has asked for anything.
    expect(screen.getAllByText("Planned")).toHaveLength(4);
    expect(screen.queryByText("No linked run")).not.toBeInTheDocument();
    expect(screen.queryByText("Missed")).not.toBeInTheDocument();
    expect(screen.queryByText(/complete/i)).not.toBeInTheDocument();
  });

  it("shows no zero-actual noise for a week that has not happened", () => {
    renderPlan({ today: BEFORE_PLAN });

    const summary = screen.getByLabelText("Week 1 plan and actual context");
    expect(within(summary).getByText("4 planned runs")).toBeInTheDocument();
    expect(within(summary).queryByText(/actual/)).not.toBeInTheDocument();
    expect(within(summary).queryByText(/^0 runs$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/plan runs linked/)).not.toBeInTheDocument();
  });

  it("leaves running done before the plan out of week 1", () => {
    const runnerRuns = unifiedRunnerHistory({
      activities: [historicalRun("history-july", "2026-07-25", { miles: 8 })],
    });

    renderPlan({ today: BEFORE_PLAN, runnerRuns });

    // The run is real and Runs still owns it; week 1 never asked for it, so
    // the plan does not absorb it as this week's actual running.
    const summary = screen.getByLabelText("Week 1 plan and actual context");
    expect(within(summary).queryByText(/8(\.0)? mi/)).not.toBeInTheDocument();
    expect(within(summary).queryByText(/actual/)).not.toBeInTheDocument();
  });
});

describe("Plan after the race", () => {
  it("does not present the final week as the active training week", () => {
    renderPlan({ today: AFTER_RACE });

    expect(weekHeading()).toHaveTextContent("Week 18 of 18");
    expect(screen.queryByText("This week")).not.toBeInTheDocument();
    const note = lifecycleNote()!;
    expect(within(note).getByText("Plan complete")).toBeInTheDocument();
    expect(
      within(note).getByText(/OUC Half Marathon · Dec 5/),
    ).toBeInTheDocument();
  });

  it("keeps every earlier week browsable, and offers the way back", async () => {
    const { user } = renderPlan({ today: AFTER_RACE });

    await user.click(screen.getByRole("button", { name: "Previous week" }));
    await user.click(screen.getByRole("button", { name: "Previous week" }));
    expect(weekHeading()).toHaveTextContent("Week 16 of 18");
    // Historical intent is still readable: the week says what it asked for and
    // what actually ran in its dates.
    expect(
      screen.getByLabelText("Week 16 plan and actual context"),
    ).toBeInTheDocument();
    expect(lifecycleNote()).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Final Week" }));
    expect(weekHeading()).toHaveTextContent("Week 18 of 18");
    expect(
      screen.queryByRole("button", { name: "Final Week" }),
    ).not.toBeInTheDocument();
  });

  it("routes the next race into the existing race setup flow", async () => {
    const before = structuredClone(seed);
    const onGeneratePlan = vi.fn();
    const { user } = renderPlan({ today: AFTER_RACE, onGeneratePlan });

    await user.click(screen.getByRole("button", { name: /Set up next race/ }));

    // The same sheet Settings opens, not a second plan generator.
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByRole("heading", { name: "Race" })).toBeInTheDocument();

    fireEvent.change(within(sheet).getByLabelText("Race name"), {
      target: { value: "Spring Half" },
    });
    fireEvent.change(within(sheet).getByLabelText("Race date"), {
      target: { value: "2027-04-11" },
    });
    await user.click(screen.getByRole("button", { name: /Build Plan/ }));

    expect(onGeneratePlan).toHaveBeenCalledTimes(1);
    const [setup, generated] = onGeneratePlan.mock.calls[0] as [
      { name: string; date: string },
      TrainingPlan,
    ];
    expect(setup).toMatchObject({ name: "Spring Half", date: "2027-04-11" });
    expect(generated.race.date).toBe("2027-04-11");
    // Generating a plan is the caller's decision to persist. Nothing about the
    // plan on screen was mutated on the way there.
    expect(seed).toEqual(before);
  });

  it("offers no next-race action where the setup flow is not available", () => {
    renderPlan({ today: AFTER_RACE });

    expect(lifecycleNote()).not.toBeNull();
    expect(
      screen.queryByRole("button", { name: /Set up next race/ }),
    ).not.toBeInTheDocument();
  });
});

describe("Plan during training", () => {
  it("says nothing about lifecycle and offers no next race", () => {
    const onGeneratePlan = vi.fn();
    renderPlan({ today: DURING_PLAN, onGeneratePlan });

    expect(lifecycleNote()).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Set up next race/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("This week")).toBeInTheDocument();
  });
});

describe("Plan reads history and intent without changing them", () => {
  it("mutates no plan, run log or runner run it was handed", async () => {
    const runLogs = [runLogFor("workout-002")];
    const runnerRuns = unifiedRunnerHistory({
      activities: [historicalRun("history-aug5", "2026-08-05", { miles: 6.2 })],
    });
    const before = {
      plan: structuredClone(seed),
      runLogs: structuredClone(runLogs),
      runnerRuns: structuredClone(runnerRuns),
    };

    const { user } = renderPlan({ runLogs, runnerRuns });
    await user.click(screen.getByRole("button", { name: "Next week" }));
    await user.click(screen.getByRole("button", { name: "Previous week" }));
    await user.click(
      screen.getByRole("button", {
        name: /Tuesday, August 4, 2 Miles, Easy, 2 mi, Completed/,
      }),
    );

    expect(seed).toEqual(before.plan);
    expect(runLogs).toEqual(before.runLogs);
    expect(runnerRuns).toEqual(before.runnerRuns);
  });
});

describe("Plan edits and Build", () => {
  it("leaves what a run earned exactly where it was", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const runLogs = [runLogFor("workout-002")];
    const earnedBefore = earnedBlocks(seed, runLogs);
    const { user, onEditPlan } = renderPlan({ runLogs });

    await user.click(
      screen.getByRole("button", {
        name: /Tuesday, August 4, 2 Miles, Easy, 2 mi, Completed/,
      }),
    );
    await user.click(screen.getByRole("button", { name: "Move Workout" }));
    await user.clear(screen.getByLabelText(/Move to/));
    await user.type(screen.getByLabelText(/Move to/), "2026-08-05");
    await user.click(screen.getByRole("button", { name: "Move Workout" }));

    const edited: TrainingPlan = onEditPlan.mock.calls.at(-1)![0];
    expect(findWorkout(edited, "workout-002")!.date).toBe("2026-08-05");

    // Moving the intent moves the day the run is counted against. It does not
    // re-earn, un-earn or re-shape the block: same run, same workout, same
    // footprint, and Plan never touched a placement.
    const earnedAfter = earnedBlocks(edited, runLogs);
    expect(earnedAfter).toHaveLength(earnedBefore.length);
    expect(earnedAfter[0].runLog).toEqual(earnedBefore[0].runLog);
    expect(earnedAfter[0].footprint).toEqual(earnedBefore[0].footprint);
    expect(earnedAfter[0].workout!.id).toBe(earnedBefore[0].workout!.id);
    confirm.mockRestore();
  });
});
