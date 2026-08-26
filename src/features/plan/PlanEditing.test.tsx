import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { findWorkout, workoutOnDate } from "../../domain/planEdit.js";
import type { RunLog, TrainingPlan } from "../../domain/types.js";
import { loadSeedPlan } from "../../seed/loadSeedPlan.js";
import { PlanScreen } from "./PlanScreen.js";

const seed = loadSeedPlan();

// Week 1 is Aug 3-9 2026: rest, easy (002), rest, easy (004), rest, easy (006),
// long (007). "Today" is Thursday Aug 6 unless a test says otherwise.
const MONDAY_REST = "Monday, August 3, Rest. Add a planned run";
const TUESDAY_EASY = "Tuesday, August 4, 2 Miles, Easy, 2 mi";
const SATURDAY_EASY = "Saturday, August 8, 2 Miles, Easy, 2 mi";

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
      today="2026-08-06"
      onEditPlan={onEditPlan}
      {...props}
    />,
  );
  return { onEditPlan, user, ...utils };
}

/** The plan handed to onEditPlan by the last call. */
function editedPlan(onEditPlan: ReturnType<typeof vi.fn>): TrainingPlan {
  expect(onEditPlan).toHaveBeenCalled();
  return onEditPlan.mock.calls[onEditPlan.mock.calls.length - 1][0];
}

async function openDetail(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  await user.click(screen.getByRole("button", { name: new RegExp(name) }));
}

describe("editing a planned workout", () => {
  it("changes what the day asks for without touching its date or id", async () => {
    const { user, onEditPlan } = renderPlan();

    await openDetail(user, SATURDAY_EASY);
    await user.click(screen.getByRole("button", { name: "Edit Workout" }));

    expect(
      screen.getByRole("heading", { name: "Edit Workout" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Intervals" }));
    await user.clear(screen.getByLabelText(/Name/));
    await user.type(screen.getByLabelText(/Name/), "6 x 400m");
    await user.clear(screen.getByLabelText(/Target/));
    await user.type(screen.getByLabelText(/Target/), "5");
    await user.click(screen.getByRole("button", { name: "Save Workout" }));

    const workout = findWorkout(editedPlan(onEditPlan), "workout-006")!;
    expect(workout.type).toBe("intervals");
    expect(workout.title).toBe("6 x 400m");
    expect(workout.targetDistanceMiles).toBe("5");
    expect(workout.date).toBe("2026-08-08");
  });

  it("rejects a target that is not miles or a range of them", async () => {
    const { user, onEditPlan } = renderPlan();

    await openDetail(user, SATURDAY_EASY);
    await user.click(screen.getByRole("button", { name: "Edit Workout" }));
    await user.clear(screen.getByLabelText(/Target/));
    await user.type(screen.getByLabelText(/Target/), "about five");
    await user.click(screen.getByRole("button", { name: "Save Workout" }));

    expect(
      screen.getByText("Use miles like 5 or a range like 4-5."),
    ).toBeInTheDocument();
    expect(onEditPlan).not.toHaveBeenCalled();
  });

  it("requires a name", async () => {
    const { user, onEditPlan } = renderPlan();

    await openDetail(user, SATURDAY_EASY);
    await user.click(screen.getByRole("button", { name: "Edit Workout" }));
    await user.clear(screen.getByLabelText(/Name/));
    await user.click(screen.getByRole("button", { name: "Save Workout" }));

    expect(screen.getByText("Give the workout a name.")).toBeInTheDocument();
    expect(onEditPlan).not.toHaveBeenCalled();
  });
});

describe("adding a run to a rest day", () => {
  it("plans a run on a day the plan left empty", async () => {
    const { user, onEditPlan } = renderPlan();

    await user.click(screen.getByRole("button", { name: MONDAY_REST }));
    expect(
      screen.getByRole("heading", { name: "Add Planned Run" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Long Run" }));
    await user.type(screen.getByLabelText(/Name/), "Long Run: 6 Miles");
    await user.type(screen.getByLabelText(/Target/), "6");
    await user.click(screen.getByRole("button", { name: "Add Planned Run" }));

    const workout = findWorkout(editedPlan(onEditPlan), "workout-001")!;
    expect(workout.type).toBe("long");
    expect(workout.title).toBe("Long Run: 6 Miles");
    expect(workout.date).toBe("2026-08-03");
    expect(workout.build.colorKey).toBe("long");
  });

  it("opens a rest day straight into planning, with no detail step", async () => {
    const { user } = renderPlan();

    await user.click(screen.getByRole("button", { name: MONDAY_REST }));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByText(/is a rest day/)).toBeInTheDocument();
  });
});

describe("changing a run to a rest day", () => {
  it("clears the day", async () => {
    const { user, onEditPlan } = renderPlan();

    await openDetail(user, SATURDAY_EASY);
    await user.click(screen.getByRole("button", { name: "Change to Rest" }));

    const workout = findWorkout(editedPlan(onEditPlan), "workout-006")!;
    expect(workout.type).toBe("rest");
    expect(workout.title).toBe("Rest");
  });

  it("is not offered for a day with a run logged against it", async () => {
    const { user } = renderPlan({ runLogs: [runLogFor("workout-002")] });

    await openDetail(user, TUESDAY_EASY);
    expect(
      screen.queryByRole("button", { name: "Change to Rest" }),
    ).not.toBeInTheDocument();
  });
});

describe("moving a workout", () => {
  it("moves onto a rest day and leaves rest behind", async () => {
    const { user, onEditPlan } = renderPlan();

    await openDetail(user, SATURDAY_EASY);
    await user.click(screen.getByRole("button", { name: "Move Workout" }));
    await user.clear(screen.getByLabelText(/Move to/));
    await user.type(screen.getByLabelText(/Move to/), "2026-08-07");

    expect(screen.getByText(/is a rest day/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Move Workout" }));

    const plan = editedPlan(onEditPlan);
    expect(findWorkout(plan, "workout-006")!.date).toBe("2026-08-07");
    expect(workoutOnDate(plan, "2026-08-08")!.type).toBe("rest");
  });

  it("warns before swapping two runs, and names both days", async () => {
    const { user, onEditPlan } = renderPlan();

    await openDetail(user, SATURDAY_EASY);
    await user.click(screen.getByRole("button", { name: "Move Workout" }));
    await user.clear(screen.getByLabelText(/Move to/));
    // Sunday holds the week's long run.
    await user.type(screen.getByLabelText(/Move to/), "2026-08-09");

    expect(
      screen.getByText(/already has Long Run: 4 Miles/),
    ).toBeInTheDocument();
    expect(screen.getByText(/moves to Sat, Aug 8/)).toBeInTheDocument();
    // The action itself changes, so the swap cannot be committed by muscle
    // memory on the ordinary Move button.
    expect(
      screen.queryByRole("button", { name: "Move Workout" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Swap These Days" }));

    const plan = editedPlan(onEditPlan);
    expect(findWorkout(plan, "workout-006")!.date).toBe("2026-08-09");
    expect(findWorkout(plan, "workout-007")!.date).toBe("2026-08-08");
  });

  it("moves across weeks, adopting the destination week and phase", async () => {
    const { user, onEditPlan } = renderPlan();

    await openDetail(user, SATURDAY_EASY);
    await user.click(screen.getByRole("button", { name: "Move Workout" }));
    await user.clear(screen.getByLabelText(/Move to/));
    await user.type(screen.getByLabelText(/Move to/), "2026-09-16");
    await user.click(screen.getByRole("button", { name: "Move Workout" }));

    const moved = findWorkout(editedPlan(onEditPlan), "workout-006")!;
    expect(moved.weekNumber).toBe(7);
    expect(moved.phase).toBe("Prep");
  });

  it("keeps the date picker inside the plan's own range", async () => {
    const { user } = renderPlan();

    await openDetail(user, SATURDAY_EASY);
    await user.click(screen.getByRole("button", { name: "Move Workout" }));

    const field = screen.getByLabelText(/Move to/);
    expect(field).toHaveAttribute("min", "2026-08-03");
    expect(field).toHaveAttribute("max", "2026-12-06");
  });

  it("refuses a date outside the plan", async () => {
    const { user, onEditPlan } = renderPlan();

    await openDetail(user, SATURDAY_EASY);
    await user.click(screen.getByRole("button", { name: "Move Workout" }));
    await user.clear(screen.getByLabelText(/Move to/));
    await user.type(screen.getByLabelText(/Move to/), "2027-01-04");
    await user.click(screen.getByRole("button", { name: "Move Workout" }));

    expect(screen.getByText(/Pick a date between/)).toBeInTheDocument();
    expect(onEditPlan).not.toHaveBeenCalled();
  });
});

describe("a day that already has a run logged", () => {
  it("confirms before letting the plan change under it", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { user } = renderPlan({ runLogs: [runLogFor("workout-002")] });

    await openDetail(user, TUESDAY_EASY);
    await user.click(screen.getByRole("button", { name: "Edit Workout" }));

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("heading", { name: "Edit Workout" }),
    ).toBeInTheDocument();
    confirm.mockRestore();
  });

  it("leaves the plan alone when the confirmation is declined", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { user, onEditPlan } = renderPlan({
      runLogs: [runLogFor("workout-002")],
    });

    await openDetail(user, TUESDAY_EASY);
    await user.click(screen.getByRole("button", { name: "Move Workout" }));

    expect(
      screen.queryByRole("heading", { name: "Move Workout" }),
    ).not.toBeInTheDocument();
    expect(onEditPlan).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it("keeps the run attached to the workout it satisfied after a move", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { user, onEditPlan } = renderPlan({
      runLogs: [runLogFor("workout-002")],
    });

    await openDetail(user, TUESDAY_EASY);
    await user.click(screen.getByRole("button", { name: "Move Workout" }));
    await user.clear(screen.getByLabelText(/Move to/));
    await user.type(screen.getByLabelText(/Move to/), "2026-08-05");
    await user.click(screen.getByRole("button", { name: "Move Workout" }));

    // The run log names workout-002; the workout still exists, on its new day.
    const moved = findWorkout(editedPlan(onEditPlan), "workout-002")!;
    expect(moved.date).toBe("2026-08-05");
    expect(moved.type).toBe("easy");
    confirm.mockRestore();
  });
});

describe("race day", () => {
  it("offers no plan edits at all", async () => {
    const { user } = renderPlan({ today: "2026-12-05" });

    await user.click(
      screen.getByRole("button", { name: /Saturday, December 5/ }),
    );

    const sheet = screen.getByRole("dialog");
    expect(
      within(sheet).queryByRole("button", { name: "Edit Workout" }),
    ).not.toBeInTheDocument();
    expect(
      within(sheet).queryByRole("button", { name: "Move Workout" }),
    ).not.toBeInTheDocument();
    expect(
      within(sheet).queryByRole("button", { name: "Change to Rest" }),
    ).not.toBeInTheDocument();
  });

  it("cannot be displaced by moving another workout onto it", async () => {
    const { user, onEditPlan } = renderPlan({ today: "2026-12-01" });

    await user.click(
      screen.getByRole("button", { name: /Tuesday, December 1/ }),
    );
    await user.click(screen.getByRole("button", { name: "Move Workout" }));
    await user.clear(screen.getByLabelText(/Move to/));
    await user.type(screen.getByLabelText(/Move to/), "2026-12-05");

    expect(screen.getByText("Race day is fixed and cannot be moved.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move Workout" })).toBeDisabled();
    expect(onEditPlan).not.toHaveBeenCalled();
  });
});

// Resetting the plan moved to Settings; its tests moved with it, to
// src/features/settings/Settings.test.tsx.
