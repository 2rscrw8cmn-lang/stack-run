import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { earnsBlock } from "../../domain/build";
import { weekdayOf } from "../../domain/runDays";
import type { TrainingPlan } from "../../domain/types";
import { loadSeedPlan } from "../../seed/loadSeedPlan";
import { OpenSettings } from "../../test/OpenSettings";

const plan = loadSeedPlan();

/** Run Days is reached from Settings, which the bottom bar opens. */
function renderPlan(props: Partial<Parameters<typeof OpenSettings>[0]> = {}) {
  const onSaveRunDays = vi.fn();
  const user = userEvent.setup();
  const utils = render(
    <OpenSettings plan={plan} runLogs={[]} today="2026-08-01" onSaveRunDays={onSaveRunDays} {...props} />,
  );
  return { onSaveRunDays, user, ...utils };
}

function sundayRuns(saved: TrainingPlan): string[] {
  return saved.weeks
    .flatMap((week) => week.workouts)
    .filter((workout) => earnsBlock(workout.type) && weekdayOf(workout.date) === 0)
    .map((workout) => workout.date);
}

describe("choosing which days to run", () => {
  it("opens on every day, and says what shape the plan has now", async () => {
    const { user } = renderPlan();

    await user.click(screen.getByRole("button", { name: /^Run Days/ }));

    // Willingness, not the plan's current shape: those are different facts,
    // and starting from the plan makes "not Sundays" mean "three days for
    // four runs" instead of what the runner meant.
    for (const day of ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]) {
      expect(screen.getByRole("button", { name: day })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    }
    expect(screen.getByText("Your plan currently runs Tue, Thu, Sat, Sun.")).toBeInTheDocument();
    expect(screen.getByText(/already fits/)).toBeInTheDocument();
  });

  it("says what dropping a day would do before it does it", async () => {
    const { user, onSaveRunDays } = renderPlan();

    await user.click(screen.getByRole("button", { name: /^Run Days/ }));
    await user.click(screen.getByRole("button", { name: "Sunday" }));

    expect(screen.getByText(/17 runs move/)).toBeInTheDocument();
    // Shown, not yet done.
    expect(onSaveRunDays).not.toHaveBeenCalled();
  });

  it("moves every Sunday run off Sunday when applied", async () => {
    const { user, onSaveRunDays } = renderPlan();

    await user.click(screen.getByRole("button", { name: /^Run Days/ }));
    await user.click(screen.getByRole("button", { name: "Sunday" }));
    await user.click(screen.getByRole("button", { name: /Move 17 Runs/ }));

    const [days, saved] = onSaveRunDays.mock.calls[0] as [number[], TrainingPlan];
    expect(days).not.toContain(0);
    expect(sundayRuns(saved)).toEqual([]);
    // Nothing was lost on the way: the plan still holds one workout per date.
    const dates = saved.weeks.flatMap((week) =>
      week.workouts.map((workout) => workout.date),
    );
    expect(dates).toHaveLength(126);
    expect(new Set(dates).size).toBe(126);
  });

  it("warns about the weeks it cannot help rather than failing quietly", async () => {
    const { user } = renderPlan();

    await user.click(screen.getByRole("button", { name: /^Run Days/ }));
    // Leave one day standing against four runs a week.
    for (const day of ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]) {
      await user.click(screen.getByRole("button", { name: day }));
    }

    expect(screen.getByText(/nowhere to go/)).toBeInTheDocument();
  });

  it("refuses to save a week with no run days at all", async () => {
    const { user } = renderPlan();

    await user.click(screen.getByRole("button", { name: /^Run Days/ }));
    for (const day of ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]) {
      await user.click(screen.getByRole("button", { name: day }));
    }

    expect(screen.getByText(/Pick at least one day/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Apply to Plan/ })).toBeDisabled();
  });

  it("opens on the saved preference once there is one", async () => {
    const { user } = renderPlan({ runDays: [1, 3, 5] });

    await user.click(screen.getByRole("button", { name: /^Run Days/ }));

    expect(screen.getByRole("button", { name: "Monday" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Sunday" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
