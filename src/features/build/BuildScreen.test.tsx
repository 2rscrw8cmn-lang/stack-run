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
  const onPlacingChange = vi.fn();
  const utils = render(
    <BuildScreen
      plan={plan}
      runLogs={[]}
      blockPlacements={[]}
      onPlaceBlock={onPlaceBlock}
      onPlacingChange={onPlacingChange}
      today="2026-08-05"
      {...props}
    />,
  );
  return { onPlaceBlock, onPlacingChange, ...utils };
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

  it("shows how tall the finished tower will be without listing a workout", () => {
    renderBuild({
      runLogs: [runLogFor("workout-002")],
      blockPlacements: [placementFor("workout-002", 1, 3, 1)],
      today: "2026-08-10",
    });

    // A height and a destination, never a block-by-block outline.
    expect(screen.getByText("1 of about 36 courses · 1 block")).toBeInTheDocument();
    expect(screen.getByText("36 courses to the race")).toBeInTheDocument();
    expect(within(courses()).getAllByRole("button")).toHaveLength(1);
  });

  it("shows the training phases as a height gauge", () => {
    renderBuild();

    const gauge = screen.getByRole("list", { name: "Training phases" });
    expect(
      within(gauge)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Taper / Race", "Main", "Prep", "Foundation"]);
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
    expect(screen.getByText("Week 2 builds next.")).toBeInTheDocument();
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

  it("lists earned but unplaced blocks in the staging tray", () => {
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

  it("hovers the block over the tower and drops it where you choose", async () => {
    const user = userEvent.setup();
    const { onPlaceBlock } = renderBuild({
      runLogs: [runLogFor("workout-002"), runLogFor("workout-004")],
      blockPlacements: [placementFor("workout-004", 1, 3, 2)],
      placingWorkoutId: "workout-002",
      today: "2026-08-10",
    });

    // No sheet covers the tower: the landing slots are on the structure.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const slots = within(courses()).getAllByRole("button", { name: /^Move Easy/ });
    // Columns 3 and 4 of the ground course are built, so 1, 2 and 5 remain
    // there, and the whole of the course above is open.
    expect(slots.map((slot) => slot.textContent)).toEqual([
      "Move Easy block to week 1, course 2, column 1",
      "Move Easy block to week 1, course 2, column 2",
      "Move Easy block to week 1, course 2, column 3",
      "Move Easy block to week 1, course 2, column 4",
      "Move Easy block to week 1, course 2, column 5",
      "Move Easy block to week 1, course 1, column 1",
      "Move Easy block to week 1, course 1, column 2",
      "Move Easy block to week 1, course 1, column 5",
    ]);

    await user.click(
      screen.getByRole("button", {
        name: "Move Easy block to week 1, course 1, column 5",
      }),
    );
    // Choosing does not commit; the block is hovering there.
    expect(onPlaceBlock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Drop" }));
    expect(onPlaceBlock).toHaveBeenCalledWith({
      workoutId: "workout-002",
      weekNumber: 1,
      row: 0,
      columnStart: 5,
      span: 1,
    });
  });

  it("slides the hovering block with the left and right controls", async () => {
    const user = userEvent.setup();
    const { onPlaceBlock } = renderBuild({
      runLogs: [runLogFor("workout-002")],
      placingWorkoutId: "workout-002",
      today: "2026-08-10",
    });

    // Auto Place centres a span-1 block on the empty ground course.
    expect(screen.getByText("Week 1 · course 1 · col 3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Move block left" }));
    expect(screen.getByText("Week 1 · course 1 · col 2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Move block right" }));
    await user.click(screen.getByRole("button", { name: "Move block right" }));
    expect(screen.getByText("Week 1 · course 1 · col 4")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Drop" }));
    expect(onPlaceBlock).toHaveBeenCalledWith({
      workoutId: "workout-002",
      weekNumber: 1,
      row: 0,
      columnStart: 4,
      span: 1,
    });
  });

  it("drops from the keyboard", async () => {
    const user = userEvent.setup();
    const { onPlaceBlock } = renderBuild({
      runLogs: [runLogFor("workout-002")],
      placingWorkoutId: "workout-002",
      today: "2026-08-10",
    });

    const slot = screen.getByRole("button", {
      name: "Move Easy block to week 1, course 1, column 2",
    });
    slot.focus();
    await user.keyboard("{Enter}");

    const drop = screen.getByRole("button", { name: "Drop" });
    drop.focus();
    await user.keyboard("{Enter}");

    expect(onPlaceBlock).toHaveBeenCalledWith({
      workoutId: "workout-002",
      weekNumber: 1,
      row: 0,
      columnStart: 2,
      span: 1,
    });
  });

  it("announces where the hovering block would land", () => {
    renderBuild({
      runLogs: [runLogFor("workout-007")],
      placingWorkoutId: "workout-007",
      today: "2026-08-10",
    });

    expect(
      screen.getByText(
        "Long Run block over week 1, course 1, columns 2 to 4, resting on the course below.",
      ),
    ).toBeInTheDocument();
  });

  it("auto places into a deterministic position", async () => {
    const user = userEvent.setup();
    const { onPlaceBlock } = renderBuild({
      runLogs: [runLogFor("workout-007")],
      placingWorkoutId: "workout-007",
      today: "2026-08-10",
    });

    await user.click(screen.getByRole("button", { name: "Auto Place" }));
    await user.click(screen.getByRole("button", { name: "Drop" }));

    // The ground course is empty, so a span-3 block is centred in it.
    expect(onPlaceBlock).toHaveBeenCalledWith({
      workoutId: "workout-007",
      weekNumber: 1,
      row: 0,
      columnStart: 2,
      span: 3,
    });
  });

  it("cancels placing without building anything", async () => {
    const user = userEvent.setup();
    const { onPlaceBlock, onPlacingChange } = renderBuild({
      runLogs: [runLogFor("workout-002")],
      placingWorkoutId: "workout-002",
      today: "2026-08-10",
    });

    await user.click(screen.getByRole("button", { name: "Cancel placing" }));
    expect(onPlacingChange).toHaveBeenCalledWith(null);
    expect(onPlaceBlock).not.toHaveBeenCalled();
  });

  it("starts placing from the staging tray", async () => {
    const user = userEvent.setup();
    const { onPlacingChange } = renderBuild({
      runLogs: [runLogFor("workout-007")],
      today: "2026-08-10",
    });

    await user.click(
      screen.getByRole("button", { name: /Place Long Run block/ }),
    );
    expect(onPlacingChange).toHaveBeenCalledWith("workout-007");
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
    const { onPlacingChange } = renderBuild({
      runLogs: [runLogFor("workout-002")],
      blockPlacements: [placementFor("workout-002", 1, 3, 1)],
      today: "2026-08-07",
    });

    await user.click(within(courses()).getByRole("button"));
    await user.click(screen.getByRole("button", { name: "Move Block" }));

    expect(onPlacingChange).toHaveBeenCalledWith("workout-002");
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
