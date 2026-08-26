import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { planCrossTrainingDayChange } from "../../domain/crossTrainingDays.js";
import type { TrainingPlan } from "../../domain/types.js";
import { loadSeedPlan } from "../../seed/loadSeedPlan.js";
import { OpenSettings } from "../../test/OpenSettings.js";

const plan = loadSeedPlan();
const TODAY = "2026-08-01";

/** Cross Training Days is reached from Settings, which the bottom bar opens. */
function renderPlan(props: Partial<Parameters<typeof OpenSettings>[0]> = {}) {
  const onSaveCrossTrainingDays = vi.fn();
  const user = userEvent.setup();
  const utils = render(
    <OpenSettings
      plan={plan}
      runLogs={[]}
      today={TODAY}
      onSaveCrossTrainingDays={onSaveCrossTrainingDays}
      {...props}
    />,
  );
  return { onSaveCrossTrainingDays, user, ...utils };
}

describe("choosing which days get Cross Training", () => {
  it("opens on no day, with none set yet", async () => {
    const { user } = renderPlan();

    await user.click(screen.getByRole("button", { name: /^Cross Training Days/ }));

    for (const day of ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]) {
      expect(screen.getByRole("button", { name: day })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    }
    expect(screen.queryByText(/currently has Cross Training/)).not.toBeInTheDocument();
    expect(screen.getByText(/Pick a day/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply to Plan" })).toBeDisabled();
  });

  it("says what choosing a rest day would do before it does it", async () => {
    const { user, onSaveCrossTrainingDays } = renderPlan();
    // Monday is a rest day every week in the seed plan.
    const { fills } = planCrossTrainingDayChange(plan, [1], { today: TODAY });
    expect(fills.length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /^Cross Training Days/ }));
    await user.click(screen.getByRole("button", { name: "Monday" }));

    expect(
      screen.getByText(new RegExp(`${fills.length} rest days? becomes? Cross Training`)),
    ).toBeInTheDocument();
    expect(onSaveCrossTrainingDays).not.toHaveBeenCalled();
  });

  it("fills every rest day on the chosen weekday when applied", async () => {
    const { user, onSaveCrossTrainingDays } = renderPlan();
    const { fills } = planCrossTrainingDayChange(plan, [1], { today: TODAY });

    await user.click(screen.getByRole("button", { name: /^Cross Training Days/ }));
    await user.click(screen.getByRole("button", { name: "Monday" }));
    await user.click(
      screen.getByRole("button", { name: new RegExp(`Add ${fills.length} Cross Training`) }),
    );

    const [days, saved] = onSaveCrossTrainingDays.mock.calls[0] as [
      number[],
      TrainingPlan,
    ];
    expect(days).toEqual([1]);
    const crossDates = saved.weeks
      .flatMap((week) => week.workouts)
      .filter((workout) => workout.type === "cross")
      .map((workout) => workout.date);
    expect(crossDates).toHaveLength(fills.length);
    // Nothing was lost on the way: the plan still holds one workout per date.
    const dates = saved.weeks.flatMap((week) => week.workouts.map((w) => w.date));
    expect(new Set(dates).size).toBe(dates.length);
  });

  it("never offers to fill a day that already runs", async () => {
    const { user } = renderPlan();
    // Tuesday already runs every week in the seed plan.
    await user.click(screen.getByRole("button", { name: /^Cross Training Days/ }));
    await user.click(screen.getByRole("button", { name: "Tuesday" }));

    expect(screen.getByText(/No rest days land on those weekdays/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply to Plan" })).toBeDisabled();
  });

  it("opens on the saved preference once there is one", async () => {
    const { user } = renderPlan({ crossTrainingDays: [1, 3] });

    await user.click(screen.getByRole("button", { name: /^Cross Training Days/ }));

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
