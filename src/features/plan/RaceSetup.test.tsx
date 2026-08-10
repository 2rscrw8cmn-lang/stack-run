import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { relinkRunLogs } from "../../domain/racePlan";
import type { RunLog, TrainingPlan } from "../../domain/types";
import { loadSeedPlan } from "../../seed/loadSeedPlan";
import { OpenSettings } from "../../test/OpenSettings";

const plan = loadSeedPlan();

function runLogFor(
  workoutId: string | null,
  completedDate: string,
  createdAt = `${completedDate}T12:00:00.000Z`,
): RunLog {
  return {
    id: workoutId ? `run-${workoutId}` : `run-extra-${completedDate}`,
    workoutId,
    completedDate,
    activityType: "easy",
    distanceMiles: 2,
    durationSeconds: 1200,
    effort: "solid",
    notes: "",
    createdAt,
    updatedAt: createdAt,
  };
}

/** Race setup is reached from Settings, which the bottom bar opens. */
function renderPlan(props: Partial<Parameters<typeof OpenSettings>[0]> = {}) {
  const onGeneratePlan = vi.fn();
  const user = userEvent.setup();
  const utils = render(
    <OpenSettings
      plan={plan}
      runLogs={[]}
      today="2026-08-10"
      onGeneratePlan={onGeneratePlan}
      {...props}
    />,
  );
  return { onGeneratePlan, user, ...utils };
}

describe("setting up the race", () => {
  it("opens on the plan's own race and says what a plan would look like", async () => {
    const { user } = renderPlan();

    await user.click(screen.getByRole("button", { name: /^Race/ }));

    expect(screen.getByLabelText("Race name")).toHaveValue("OUC Half Marathon");
    expect(screen.getByLabelText("Race date")).toHaveValue("2026-12-05");
    expect(screen.getByRole("button", { name: "Half Marathon" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // 17 weeks from the week of Aug 10 to the week of Dec 5.
    expect(
      screen.getByText(/17 weeks, Mon, Aug 10 to Sat, Dec 5/),
    ).toBeInTheDocument();
  });

  it("says when a race is so far out that training starts later", async () => {
    const { user } = renderPlan();

    await user.click(screen.getByRole("button", { name: /^Race/ }));
    await user.click(screen.getByRole("button", { name: "5K" }));

    // A 5K in December does not want a seventeen-week plan.
    expect(screen.getByText(/training starts .* rather than now/)).toBeInTheDocument();
  });

  it("builds a plan that ends on race day", async () => {
    const { user, onGeneratePlan } = renderPlan();

    await user.click(screen.getByRole("button", { name: /^Race/ }));
    await user.click(screen.getByRole("button", { name: /Build Plan/ }));

    const [setup, generated] = onGeneratePlan.mock.calls[0] as [
      { distance: string },
      TrainingPlan,
    ];
    expect(setup.distance).toBe("half");
    expect(generated.weeks).toHaveLength(17);
    expect(generated.race.date).toBe("2026-12-05");
    expect(
      generated.weeks.at(-1)!.workouts.some((w) => w.type === "race"),
    ).toBe(true);
  });

  it("follows the distance and the level", async () => {
    const { user, onGeneratePlan } = renderPlan();

    await user.click(screen.getByRole("button", { name: /^Race/ }));
    await user.click(screen.getByRole("button", { name: "Marathon" }));
    await user.click(screen.getByRole("button", { name: /Advanced/ }));
    await user.click(screen.getByRole("button", { name: /Build Plan/ }));

    const [setup, generated] = onGeneratePlan.mock.calls[0] as [
      { distance: string; level: string },
      TrainingPlan,
    ];
    expect(setup).toMatchObject({ distance: "marathon", level: "advanced" });
    expect(generated.race.distanceMiles).toBe(26.2);
    const types = new Set(
      generated.weeks.flatMap((w) => w.workouts).map((w) => w.type),
    );
    expect(types).toContain("intervals");
    expect(types).toContain("simulation");
  });

  it("only schedules runs on the days the runner said they run", async () => {
    const { user, onGeneratePlan } = renderPlan({ runDays: [1, 3, 5] });

    await user.click(screen.getByRole("button", { name: /^Race/ }));
    await user.click(screen.getByRole("button", { name: /Build Plan/ }));

    const generated = onGeneratePlan.mock.calls[0][1] as TrainingPlan;
    const days = new Set(
      generated.weeks
        .flatMap((week) => week.workouts)
        .filter((workout) => workout.type !== "rest" && workout.type !== "race")
        .map((workout) => new Date(`${workout.date}T00:00:00`).getDay()),
    );
    expect([...days].sort()).toEqual([1, 3, 5]);
  });

  it("warns when the race is too close for the distance, without refusing", async () => {
    const { user } = renderPlan({ today: "2026-11-16" });

    await user.click(screen.getByRole("button", { name: /^Race/ }));
    await user.click(screen.getByRole("button", { name: "Marathon" }));

    expect(screen.getByText(/usually wants at least 12 weeks/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Build Plan/ })).toBeEnabled();
  });

  it("refuses a date that has already gone", async () => {
    const { user } = renderPlan({ today: "2026-12-20" });

    await user.click(screen.getByRole("button", { name: /^Race/ }));

    expect(screen.getByText("That date has already passed.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Build Plan/ })).toBeDisabled();
  });

  it("suggests a start date and follows the race until the runner changes it", async () => {
    const { user } = renderPlan();

    await user.click(screen.getByRole("button", { name: /^Race/ }));
    expect(screen.getByLabelText("Start training")).toHaveValue("2026-08-10");

    // A 5K in December starts much later, and the suggestion keeps up.
    await user.click(screen.getByRole("button", { name: "5K" }));
    expect(screen.getByLabelText("Start training")).toHaveValue("2026-09-14");
  });

  it("builds from a chosen start date, and stops suggesting one", async () => {
    const { user, onGeneratePlan } = renderPlan();

    await user.click(screen.getByRole("button", { name: /^Race/ }));
    await user.clear(screen.getByLabelText("Start training"));
    await user.type(screen.getByLabelText("Start training"), "2026-09-07");
    // Changing the distance no longer moves it: the runner has said.
    await user.click(screen.getByRole("button", { name: "10K" }));
    expect(screen.getByLabelText("Start training")).toHaveValue("2026-09-07");

    expect(screen.getByText(/13 weeks, Mon, Sep 7 to Sat, Dec 5/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Build Plan/ }));

    const [setup, generated] = onGeneratePlan.mock.calls[0] as [
      { startDate?: string },
      TrainingPlan,
    ];
    expect(setup.startDate).toBe("2026-09-07");
    expect(generated.startDate).toBe("2026-09-07");
    expect(generated.weeks).toHaveLength(13);
  });

  it("says which Monday a mid-week start really begins on", async () => {
    const { user } = renderPlan();

    await user.click(screen.getByRole("button", { name: /^Race/ }));
    await user.clear(screen.getByLabelText("Start training"));
    await user.type(screen.getByLabelText("Start training"), "2026-09-09");

    expect(
      screen.getByText(/Training weeks run Monday to Sunday, so this plan begins Mon, Sep 7/),
    ).toBeInTheDocument();
  });

  it("refuses a start after race day", async () => {
    const { user } = renderPlan();

    await user.click(screen.getByRole("button", { name: /^Race/ }));
    await user.clear(screen.getByLabelText("Start training"));
    await user.type(screen.getByLabelText("Start training"), "2026-12-14");

    expect(
      screen.getByText("Training has to start before race day."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Build Plan/ })).toBeDisabled();
  });

  it("gives the suggested start back", async () => {
    const { user } = renderPlan();

    await user.click(screen.getByRole("button", { name: /^Race/ }));
    await user.clear(screen.getByLabelText("Start training"));
    await user.type(screen.getByLabelText("Start training"), "2026-09-07");
    await user.click(
      screen.getByRole("button", { name: "Use the suggested start" }),
    );

    expect(screen.getByLabelText("Start training")).toHaveValue("2026-08-10");
  });

  it("says what will happen to the runs already recorded", async () => {
    const { user } = renderPlan({
      runLogs: [runLogFor("workout-002", "2026-08-04")],
    });

    await user.click(screen.getByRole("button", { name: /^Race/ }));

    expect(
      screen.getByText(/1 recorded run keeps its miles and its block/),
    ).toBeInTheDocument();
  });
});

describe("keeping recorded runs across a rebuild", () => {
  it("re-attaches a run to whatever the new plan asks for that day", () => {
    const runLogs = [runLogFor("workout-002", "2026-08-04")];
    const target = plan.weeks[0].workouts.find(
      (workout) => workout.date === "2026-08-04",
    )!;

    const { runLogs: relinked, linked } = relinkRunLogs(runLogs, plan);

    expect(relinked[0].workoutId).toBe(target.id);
    expect(linked).toBe(1);
  });

  it("turns a run with nothing scheduled that day into an extra run", () => {
    // Aug 3 is a rest day in the seed plan.
    const runLogs = [runLogFor("workout-999", "2026-08-03")];

    const { runLogs: relinked, unlinked } = relinkRunLogs(runLogs, plan);

    expect(relinked[0].workoutId).toBeNull();
    expect(unlinked).toBe(1);
    // Nothing is discarded: the miles and the run itself survive.
    expect(relinked).toHaveLength(1);
    expect(relinked[0].distanceMiles).toBe(2);
  });

  it("lets only the first of two runs on one date satisfy the workout", () => {
    const runLogs = [
      runLogFor("workout-002", "2026-08-04", "2026-08-04T07:00:00.000Z"),
      runLogFor(null, "2026-08-04", "2026-08-04T18:00:00.000Z"),
    ];

    const { runLogs: relinked } = relinkRunLogs(runLogs, plan);

    expect(relinked[0].workoutId).not.toBeNull();
    expect(relinked[1].workoutId).toBeNull();
  });
});
