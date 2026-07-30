import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RunLog } from "../../domain/types";
import { loadSeedPlan } from "../../seed/loadSeedPlan";
import { TodayScreen } from "./TodayScreen";

const plan = loadSeedPlan();

const completedEasyRun: RunLog = {
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
    expect(
      screen.getByRole("button", { name: "Log First Run" }),
    ).toBeInTheDocument();
  });

  it("opens run entry from the before-plan state", async () => {
    const user = userEvent.setup();
    render(
      <TodayScreen
        plan={plan}
        runLogs={[]}
        onViewPlan={vi.fn()}
        today="2026-07-15"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Log First Run" }));
    expect(
      screen.getByRole("heading", { name: "Complete Run" }),
    ).toBeInTheDocument();
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

    expect(screen.getByText(/Run complete/)).toBeInTheDocument();
    expect(
      screen.getAllByRole("definition").map((stat) => stat.textContent),
    ).toEqual(["2.1 mi", "20:30", "Solid"]);

    await user.click(screen.getByRole("button", { name: "Edit Run" }));
    expect(
      screen.getByRole("heading", { name: "Edit Run" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Distance/)).toHaveValue("2.1");
  });

  it("saves an entered run and announces the save", async () => {
    const user = userEvent.setup();
    const onSaveRun = vi.fn();
    render(
      <TodayScreen
        plan={plan}
        runLogs={[]}
        onViewPlan={vi.fn()}
        onSaveRun={onSaveRun}
        today="2026-08-04"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Mark Complete" }));
    await user.type(screen.getByLabelText(/Distance/), "2.1");
    await user.type(screen.getByLabelText(/Duration/), "2030");
    await user.click(screen.getByRole("button", { name: "Solid" }));
    await user.click(screen.getByRole("button", { name: "Save Run" }));

    expect(onSaveRun).toHaveBeenCalledWith(
      expect.objectContaining({ id: "workout-002" }),
      {
        distanceMiles: 2.1,
        durationSeconds: 1230,
        effort: "solid",
        notes: "",
      },
    );
    expect(
      screen.getByText("Run saved. You earned an Easy block."),
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

  it("shows the earned block and offers Place Block once a run is logged", async () => {
    const user = userEvent.setup();
    const onPlaceBlock = vi.fn();
    render(
      <TodayScreen
        plan={plan}
        runLogs={[completedEasyRun]}
        onViewPlan={vi.fn()}
        onPlaceBlock={onPlaceBlock}
        today="2026-08-04"
      />,
    );

    expect(screen.getByText("You earned an Easy block.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Place Block" }));
    expect(
      screen.getByRole("heading", { name: "Place Block" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Auto Place" }));
    expect(onPlaceBlock).toHaveBeenCalledWith({
      workoutId: "workout-002",
      weekNumber: 1,
      // Week 1 is the ground course, so Auto Place centres a span-1 block.
      columnStart: 4,
      span: 1,
    });
  });

  it("reports a placed block instead of offering to place it again", () => {
    render(
      <TodayScreen
        plan={plan}
        runLogs={[completedEasyRun]}
        blockPlacements={[
          {
            workoutId: "workout-002",
            weekNumber: 1,
            columnStart: 4,
            span: 1,
            placedAt: "2026-08-04T13:00:00.000Z",
          },
        ]}
        onViewPlan={vi.fn()}
        today="2026-08-04"
      />,
    );

    expect(
      screen.getByText("Your Easy block is built into week 1."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Place Block" }),
    ).not.toBeInTheDocument();
  });

});
