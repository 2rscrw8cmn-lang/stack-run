import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RunLog } from "../../domain/types";
import { loadSeedPlan } from "../../seed/loadSeedPlan";
import { TodayScreen } from "./TodayScreen";

const plan = loadSeedPlan();

describe("TodayScreen", () => {
  it("shows the race summary card regardless of state", () => {
    render(
      <TodayScreen
        plan={plan}
        runLogs={[]}
        onViewPlan={vi.fn()}
        today="2026-07-15"
      />,
    );
    expect(screen.getByText("OUC Half Marathon")).toBeInTheDocument();
  });

  it("shows the before-plan state ahead of the plan start date", () => {
    const onViewPlan = vi.fn();
    render(
      <TodayScreen
        plan={plan}
        runLogs={[]}
        onViewPlan={onViewPlan}
        today="2026-07-15"
      />,
    );

    expect(screen.getByText("Plan starts soon")).toBeInTheDocument();
    expect(screen.getByText(/August 3, 2026/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Mark Complete" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log First Run" })).toBeInTheDocument();
  });

  it("opens run entry from the before-plan state", async () => {
    const user = userEvent.setup();
    render(<TodayScreen plan={plan} runLogs={[]} onViewPlan={vi.fn()} today="2026-07-29" />);
    await user.click(screen.getByRole("button", { name: "Log First Run" }));
    expect(screen.getByRole("heading", { name: "Complete Run" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Distance/)).toBeInTheDocument();
  });

  it("shows the rest-day state with a View Plan action and no completion requirement", async () => {
    const onViewPlan = vi.fn();
    const user = userEvent.setup();
    render(
      <TodayScreen
        plan={plan}
        runLogs={[]}
        onViewPlan={onViewPlan}
        today="2026-08-03"
      />,
    );

    expect(screen.getByText("Rest Day")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Mark Complete" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "View Plan" }));
    expect(onViewPlan).toHaveBeenCalledTimes(1);
  });

  it("shows the run state with a Mark Complete action that opens the placeholder sheet", async () => {
    const user = userEvent.setup();
    render(
      <TodayScreen
        plan={plan}
        runLogs={[]}
        onViewPlan={vi.fn()}
        today="2026-08-04"
      />,
    );

    expect(screen.getByText("2 Miles")).toBeInTheDocument();
    const markComplete = screen.getByRole("button", { name: "Mark Complete" });

    await user.click(markComplete);
    expect(
      screen.getByRole("heading", { name: "Complete Run" }),
    ).toBeInTheDocument();
  });

  it("shows the completed state using the existing run log", async () => {
    const runLog: RunLog = {
      id: "log-1",
      workoutId: "workout-002",
      completedDate: "2026-08-04",
      distanceMiles: 2.1,
      durationSeconds: 1230,
      effort: "solid",
      notes: "",
      createdAt: "2026-08-04T12:00:00.000Z",
      updatedAt: "2026-08-04T12:00:00.000Z",
    };
    const user = userEvent.setup();
    render(
      <TodayScreen
        plan={plan}
        runLogs={[runLog]}
        onViewPlan={vi.fn()}
        today="2026-08-04"
      />,
    );

    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("2.1 mi")).toBeInTheDocument();
    expect(screen.getByText("20:30")).toBeInTheDocument();
    expect(screen.getByText("Solid")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit Run" }));
    expect(
      screen.getByRole("heading", { name: "Complete Run" }),
    ).toBeInTheDocument();
  });

  it("shows the after-race state once race day has passed", () => {
    render(
      <TodayScreen
        plan={plan}
        runLogs={[]}
        onViewPlan={vi.fn()}
        today="2026-12-06"
      />,
    );

    expect(screen.getByText("Race complete")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Mark Complete" }),
    ).not.toBeInTheDocument();
  });
});
