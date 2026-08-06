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
  columnStart: number,
  width: 1 | 2 | 3 | 4,
  row = 0,
  height: 1 | 2 | 3 | 4 = 1,
  placedAt = "2026-08-04T13:00:00.000Z",
): BlockPlacement {
  return { workoutId, row, columnStart, width, height, placedAt };
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

function tower() {
  return screen.getByRole("list", { name: "Built blocks" });
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

    // Nothing is built until a block is placed, so the tower is empty.
    expect(within(tower()).queryAllByRole("listitem")).toHaveLength(0);
    expect(
      screen.getByText("Nothing built yet. Complete a run to earn your first block."),
    ).toBeInTheDocument();
  });

  it("shows how tall the finished tower will be without listing a workout", () => {
    renderBuild({
      runLogs: [runLogFor("workout-002")],
      blockPlacements: [placementFor("workout-002", 3, 1)],
      today: "2026-08-10",
    });

    // A height and a destination, never a block-by-block outline.
    expect(screen.getByText(/1 of about \d+ courses · 1 block/)).toBeInTheDocument();
    expect(screen.getByText(/\d+ courses to the race/)).toBeInTheDocument();
    expect(within(tower()).getAllByRole("button")).toHaveLength(1);
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

  it("stacks blocks continuously and marks where each week topped out", () => {
    renderBuild({
      runLogs: [runLogFor("workout-002"), runLogFor("workout-007")],
      blockPlacements: [
        placementFor("workout-002", 3, 1),
        placementFor("workout-007", 3, 1, 1),
      ],
      today: "2026-08-10",
    });

    expect(within(tower()).getAllByRole("button")).toHaveLength(2);
    // One week, one mortar line, wherever its last block came to rest.
    expect(screen.getByText("Week 1 tops out at course 2")).toBeInTheDocument();
    expect(screen.getByText("2 courses standing.")).toBeInTheDocument();
  });

  it("shows only placed blocks in the structure", () => {
    renderBuild({
      runLogs: [runLogFor("workout-002"), runLogFor("workout-004")],
      blockPlacements: [placementFor("workout-002", 3, 1)],
      today: "2026-08-07",
    });

    const blocks = within(tower()).getAllByRole("button");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toHaveAccessibleName(
      "Week 1 Tuesday, Easy, course 0, column 3",
    );
  });

  it("lists earned but unplaced blocks in the staging tray", () => {
    renderBuild({
      runLogs: [runLogFor("workout-002"), runLogFor("workout-007")],
      blockPlacements: [placementFor("workout-002", 3, 1)],
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
      blockPlacements: [placementFor("workout-002", 3, 1)],
    });

    expect(
      screen.queryByRole("list", { name: "Blocks ready to place" }),
    ).not.toBeInTheDocument();
  });

  it("hovers the block over the tower and drops it where you choose", async () => {
    const user = userEvent.setup();
    const { onPlaceBlock } = renderBuild({
      runLogs: [runLogFor("workout-002"), runLogFor("workout-004")],
      blockPlacements: [placementFor("workout-004", 3, 2)],
      placingWorkoutId: "workout-002",
      today: "2026-08-10",
    });

    // No sheet covers the tower: the landing slots are on the structure.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const slots = within(tower()).getAllByRole("button", { name: /^Drop Easy/ });
    // One slot per column, and each says where gravity would put the block:
    // columns 3 and 4 are built on, so a block dropped there lands higher.
    expect(slots).toHaveLength(10);
    expect(slots[0]).toHaveAccessibleName(
      "Drop Easy block down column 1, landing on course 0",
    );
    expect(slots[2]).toHaveAccessibleName(
      "Drop Easy block down column 3, landing on course 1",
    );

    await user.click(
      screen.getByRole("button", {
        name: "Drop Easy block down column 5, landing on course 0",
      }),
    );
    // Choosing does not commit; the block is hovering there.
    expect(onPlaceBlock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Drop" }));
    expect(onPlaceBlock).toHaveBeenCalledWith({
      workoutId: "workout-002",
      row: 0,
      columnStart: 5,
      width: 1,
      height: 1,
    });
  });

  it("slides the hovering block with the left and right controls", async () => {
    const user = userEvent.setup();
    const { onPlaceBlock } = renderBuild({
      runLogs: [runLogFor("workout-002")],
      placingWorkoutId: "workout-002",
      today: "2026-08-10",
    });

    // Auto Place puts a 1-wide block flush against the left edge of empty
    // ground, because flushness breaks the tie between equal landings.
    expect(screen.getByText("Column 1 · lands on course 0")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Move block right" }));
    expect(screen.getByText("Column 2 · lands on course 0")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Move block right" }));
    await user.click(screen.getByRole("button", { name: "Move block left" }));
    expect(screen.getByText("Column 2 · lands on course 0")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Drop" }));
    expect(onPlaceBlock).toHaveBeenCalledWith({
      workoutId: "workout-002",
      row: 0,
      columnStart: 2,
      width: 1,
      height: 1,
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
      name: "Drop Easy block down column 2, landing on course 0",
    });
    slot.focus();
    await user.keyboard("{Enter}");

    const drop = screen.getByRole("button", { name: "Drop" });
    drop.focus();
    await user.keyboard("{Enter}");

    expect(onPlaceBlock).toHaveBeenCalledWith({
      workoutId: "workout-002",
      row: 0,
      columnStart: 2,
      width: 1,
      height: 1,
    });
  });

  it("announces where the hovering block would land", () => {
    renderBuild({
      runLogs: [runLogFor("workout-007", { distanceMiles: 9 })],
      placingWorkoutId: "workout-007",
      today: "2026-08-10",
    });

    expect(
      screen.getByText(
        "Long Run block over columns 1 to 4, landing on course 0, resting flat.",
      ),
    ).toBeInTheDocument();
  });

  it("auto places into a deterministic position", async () => {
    const user = userEvent.setup();
    const { onPlaceBlock } = renderBuild({
      runLogs: [runLogFor("workout-007", { distanceMiles: 9 })],
      placingWorkoutId: "workout-007",
      today: "2026-08-10",
    });

    await user.click(screen.getByRole("button", { name: "Auto Place" }));
    await user.click(screen.getByRole("button", { name: "Drop" }));

    // Empty ground is level everywhere and seals nothing, so the tie falls to
    // the flush edge: hard against the left wall.
    expect(onPlaceBlock).toHaveBeenCalledWith({
      workoutId: "workout-007",
      row: 0,
      columnStart: 1,
      width: 4,
      height: 1,
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
      blockPlacements: [placementFor("workout-007", 2, 3)],
      today: "2026-08-10",
    });

    await user.click(within(tower()).getByRole("button"));

    const sheet = screen.getByRole("dialog");
    expect(
      within(sheet).getByRole("heading", { name: "Long Run: 4 Miles" }),
    ).toBeInTheDocument();
    expect(
      within(sheet).getByText("Placed on course 0, columns 2 through 4."),
    ).toBeInTheDocument();
    expect(within(sheet).getByText("4.2 mi")).toBeInTheDocument();
  });

  it("offers Move Block on the most recently placed block", async () => {
    const user = userEvent.setup();
    const { onPlacingChange } = renderBuild({
      runLogs: [runLogFor("workout-002")],
      blockPlacements: [placementFor("workout-002", 3, 1)],
      today: "2026-08-07",
    });

    await user.click(within(tower()).getByRole("button"));
    await user.click(screen.getByRole("button", { name: "Move Block" }));

    expect(onPlacingChange).toHaveBeenCalledWith("workout-002");
  });

  it("locks a block that has another resting on it", async () => {
    const user = userEvent.setup();
    renderBuild({
      runLogs: [runLogFor("workout-002"), runLogFor("workout-004")],
      blockPlacements: [
        placementFor("workout-002", 3, 1, 0, 1, "2026-08-04T13:00:00.000Z"),
        placementFor("workout-004", 3, 1, 1, 1, "2026-08-06T13:00:00.000Z"),
      ],
      today: "2026-08-20",
    });

    // The lower block was placed first, so it can no longer be pulled out.
    await user.click(
      within(tower()).getByRole("button", { name: /Tuesday/ }),
    );

    const sheet = screen.getByRole("dialog");
    expect(
      within(sheet).queryByRole("button", { name: "Move Block" }),
    ).not.toBeInTheDocument();
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
