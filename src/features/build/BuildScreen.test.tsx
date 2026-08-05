import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { BlockPlacement, RunLog } from "../../domain/types";
import { loadSeedPlan } from "../../seed/loadSeedPlan";
import { BuildScreen } from "./BuildScreen";

const plan = loadSeedPlan();

function runLogFor(workoutId: string, overrides: Partial<RunLog> = {}): RunLog {
  return {
    id: `log-${workoutId}`,
    workoutId,
    completedDate: "2026-08-04",
    distanceMiles: 2.1,
    durationSeconds: 1230,
    effort: "solid",
    notes: "",
    createdAt: "2026-08-04T12:00:00.000Z",
    updatedAt: "2026-08-04T12:00:00.000Z",
    ...overrides,
  };
}

function placementFor(
  workoutId: string,
  weekNumber: number,
  columnStart: number,
  span: 1 | 2 | 3 | 4,
  row = 0,
): BlockPlacement {
  return {
    workoutId,
    weekNumber,
    row,
    columnStart,
    span,
    placedAt: "2026-08-04T13:00:00.000Z",
  };
}

function renderBuild(
  props: Partial<Parameters<typeof BuildScreen>[0]> = {},
) {
  const onPlaceBlock = vi.fn();
  render(
    <BuildScreen
      plan={plan}
      runLogs={[]}
      blockPlacements={[]}
      onPlaceBlock={onPlaceBlock}
      today="2026-08-05"
      {...props}
    />,
  );
  return { onPlaceBlock };
}

function courses() {
  return screen.getByRole("list", { name: "Built courses" });
}

describe("BuildScreen", () => {
  it("shows the summary metrics", () => {
    renderBuild({
      runLogs: [
        runLogFor("workout-002", { distanceMiles: 2.1 }),
        runLogFor("workout-004", { distanceMiles: 2.4 }),
      ],
      today: "2026-08-06",
    });

    expect(screen.getByText("Runs Complete").parentElement).toHaveTextContent(
      "2 / 71",
    );
    expect(screen.getByText("Total Miles").parentElement).toHaveTextContent(
      "4.5",
    );
    expect(screen.getByText("Run Streak").parentElement).toHaveTextContent("2");
  });

  it("does not render a full 18-week blueprint of future workouts", () => {
    renderBuild();

    // Nothing is built until a block is placed, so there are no courses.
    expect(within(courses()).queryAllByRole("listitem")).toHaveLength(0);
    expect(
      screen.getByText("Nothing built yet. Complete a run to earn your first block."),
    ).toBeInTheDocument();
  });

  it("builds a week into as many courses as it needs, newest on top", () => {
    renderBuild({
      runLogs: [runLogFor("workout-002"), runLogFor("workout-007")],
      blockPlacements: [
        placementFor("workout-002", 1, 3, 1),
        placementFor("workout-007", 1, 1, 3, 1),
      ],
      today: "2026-08-10",
    });

    const rows = within(courses()).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAccessibleName("Week 1, course 2");
    expect(rows[1]).toHaveAccessibleName("Week 1, course 1");
    expect(screen.getByText("Week 2 next")).toBeInTheDocument();
  });

  it("shows only placed blocks in the structure", () => {
    renderBuild({
      runLogs: [runLogFor("workout-002"), runLogFor("workout-004")],
      blockPlacements: [placementFor("workout-002", 1, 3, 1)],
      today: "2026-08-07",
    });

    const blocks = within(courses()).getAllByRole("button");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toHaveAccessibleName(
      "Week 1 Tuesday, Easy, 2 miles, course 1, column 3",
    );
  });

  it("lists earned but unplaced blocks in the staging tray", async () => {
    const user = userEvent.setup();
    renderBuild({
      runLogs: [runLogFor("workout-002"), runLogFor("workout-007")],
      blockPlacements: [placementFor("workout-002", 1, 3, 1)],
      today: "2026-08-10",
    });

    const tray = screen.getByRole("list", { name: "Blocks ready to place" });
    const items = within(tray).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("Long Run");
    expect(items[0]).toHaveTextContent("Sun, Aug 9");

    await user.click(
      within(tray).getByRole("button", { name: /Place Long Run block/ }),
    );
    expect(
      screen.getByRole("heading", { name: "Place Block" }),
    ).toBeInTheDocument();
  });

  it("hides the staging tray when every earned block is placed", () => {
    renderBuild({
      runLogs: [runLogFor("workout-002")],
      blockPlacements: [placementFor("workout-002", 1, 3, 1)],
    });

    expect(
      screen.queryByRole("list", { name: "Blocks ready to place" }),
    ).not.toBeInTheDocument();
  });

  it("offers only valid positions, and places the block on tap", async () => {
    const user = userEvent.setup();
    const { onPlaceBlock } = renderBuild({
      runLogs: [runLogFor("workout-002"), runLogFor("workout-004")],
      blockPlacements: [placementFor("workout-004", 1, 3, 2)],
      today: "2026-08-10",
    });

    await user.click(screen.getByRole("button", { name: /Place Easy block/ }));

    const grid = screen.getByRole("group", { name: "Week 1 courses" });
    const options = within(grid).getAllByRole("button");
    // Columns 3 and 4 of the ground course are built, so 1, 2 and 5 remain
    // there, and the whole of the course above is open.
    expect(options.map((option) => option.textContent)).toEqual([
      "Place Easy block in Week 1, course 2, column 1",
      "Place Easy block in Week 1, course 2, column 2",
      "Place Easy block in Week 1, course 2, column 3",
      "Place Easy block in Week 1, course 2, column 4",
      "Place Easy block in Week 1, course 2, column 5",
      "Place Easy block in Week 1, course 1, column 1",
      "Place Easy block in Week 1, course 1, column 2",
      "Place Easy block in Week 1, course 1, column 5",
    ]);

    await user.click(
      within(grid).getByRole("button", {
        name: "Place Easy block in Week 1, course 1, column 5",
      }),
    );
    expect(onPlaceBlock).toHaveBeenCalledWith({
      workoutId: "workout-002",
      weekNumber: 1,
      row: 0,
      columnStart: 5,
      span: 1,
    });
  });

  it("places a block from the keyboard", async () => {
    const user = userEvent.setup();
    const { onPlaceBlock } = renderBuild({
      runLogs: [runLogFor("workout-002")],
      today: "2026-08-10",
    });

    await user.click(screen.getByRole("button", { name: /Place Easy block/ }));

    const option = screen.getByRole("button", {
      name: "Place Easy block in Week 1, course 1, column 2",
    });
    option.focus();
    expect(option).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(onPlaceBlock).toHaveBeenCalledWith({
      workoutId: "workout-002",
      weekNumber: 1,
      row: 0,
      columnStart: 2,
      span: 1,
    });
  });

  it("auto places into a deterministic position", async () => {
    const user = userEvent.setup();
    const { onPlaceBlock } = renderBuild({
      runLogs: [runLogFor("workout-007")],
      today: "2026-08-10",
    });

    await user.click(
      screen.getByRole("button", { name: /Place Long Run block/ }),
    );
    await user.click(screen.getByRole("button", { name: "Auto Place" }));

    // The ground course is empty, so a span-3 block is centred in it.
    expect(onPlaceBlock).toHaveBeenCalledWith({
      workoutId: "workout-007",
      weekNumber: 1,
      row: 0,
      columnStart: 2,
      span: 3,
    });
  });

  it("announces a placement politely", async () => {
    const user = userEvent.setup();
    renderBuild({ runLogs: [runLogFor("workout-002")], today: "2026-08-10" });

    await user.click(screen.getByRole("button", { name: /Place Easy block/ }));
    await user.click(screen.getByRole("button", { name: "Auto Place" }));

    expect(
      screen.getByText("Block placed in week 1, course 1, column 3."),
    ).toBeInTheDocument();
  });

  it("opens the workout detail sheet from a placed block", async () => {
    const user = userEvent.setup();
    renderBuild({
      runLogs: [runLogFor("workout-007", { distanceMiles: 4.2 })],
      blockPlacements: [placementFor("workout-007", 1, 2, 3)],
      today: "2026-08-10",
    });

    await user.click(within(courses()).getByRole("button"));

    const sheet = screen.getByRole("dialog");
    expect(
      within(sheet).getByRole("heading", { name: "Long Run: 4 Miles" }),
    ).toBeInTheDocument();
    expect(
      within(sheet).getByText("Placed in week 1, course 1, columns 2 through 4."),
    ).toBeInTheDocument();
    expect(within(sheet).getByText("4.2 mi")).toBeInTheDocument();
  });

  it("offers Move Block while the block's week is still active", async () => {
    const user = userEvent.setup();
    renderBuild({
      runLogs: [runLogFor("workout-002")],
      blockPlacements: [placementFor("workout-002", 1, 3, 1)],
      today: "2026-08-07",
    });

    await user.click(within(courses()).getByRole("button"));
    await user.click(screen.getByRole("button", { name: "Move Block" }));

    expect(
      screen.getByRole("heading", { name: "Move Block" }),
    ).toBeInTheDocument();
    // The block being moved does not block its own position.
    expect(
      screen.getByRole("button", {
        name: "Place Easy block in Week 1, course 1, column 3",
      }),
    ).toBeInTheDocument();
  });

  it("locks a past week's course", async () => {
    const user = userEvent.setup();
    renderBuild({
      runLogs: [runLogFor("workout-002")],
      blockPlacements: [placementFor("workout-002", 1, 3, 1)],
      today: "2026-08-20",
    });

    await user.click(within(courses()).getAllByRole("button")[0]);

    const sheet = screen.getByRole("dialog");
    expect(
      within(sheet).queryByRole("button", { name: "Move Block" }),
    ).not.toBeInTheDocument();
    expect(
      within(sheet).getByText("This week is finished, so its course is locked."),
    ).toBeInTheDocument();
  });

  it("shows a compact legend of block types without Rest", () => {
    renderBuild();

    const types = screen.getByRole("list", { name: "Workout types" });
    expect(
      within(types)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Easy", "Intervals", "Simulation", "Long Run", "Race"]);
  });
});
