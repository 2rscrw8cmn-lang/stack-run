import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { BlockPlacement, RunLog } from "../../domain/types";
import { loadSeedPlan } from "../../seed/loadSeedPlan";
import { BuildScreen } from "./BuildScreen";

const plan = loadSeedPlan();

const typeByWorkoutId = new Map(
  plan.weeks
    .flatMap((week) => week.workouts)
    .map((workout) => [workout.id, workout.type]),
);

function runLogFor(workoutId: string, overrides: Partial<RunLog> = {}): RunLog {
  const type = typeByWorkoutId.get(workoutId);
  return {
    id: `run-${workoutId}`,
    workoutId,
    completedDate: "2026-08-04",
    activityType: type && type !== "rest" ? type : "easy",
    distanceMiles: 2.1,
    durationSeconds: 1230,
    effort: "solid",
    notes: "",
    createdAt: "2026-08-04T12:00:00.000Z",
    updatedAt: "2026-08-04T12:00:00.000Z",
    ...overrides,
  };
}

function extraRun(id: string, overrides: Partial<RunLog> = {}): RunLog {
  return { ...runLogFor("workout-002"), id, workoutId: null, ...overrides };
}

function placementFor(
  runLogId: string,
  columnStart: number,
  width: 1 | 2 | 3 | 4,
  row = 0,
  height: 1 | 2 | 3 = 1,
  placedAt = "2026-08-04T13:00:00.000Z",
): BlockPlacement {
  return { runLogId, row, columnStart, width, height, placedAt };
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
      screen.getByText("Nothing built yet. Log a run to earn your first block."),
    ).toBeInTheDocument();
  });

  it("counts what has been built without a packing readout", () => {
    renderBuild({
      runLogs: [runLogFor("workout-002")],
      blockPlacements: [placementFor("run-workout-002", 3, 1)],
      today: "2026-08-10",
    });

    expect(screen.getByText("1 block")).toBeInTheDocument();
    expect(within(tower()).getAllByRole("button")).toHaveLength(1);
  });

  it("drops the projected height, phase gauge, and week mortar lines", () => {
    renderBuild({
      runLogs: [runLogFor("workout-002")],
      blockPlacements: [placementFor("run-workout-002", 3, 1)],
      today: "2026-08-10",
    });

    expect(
      screen.queryByRole("list", { name: "Training phases" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/courses to the race/)).not.toBeInTheDocument();
    expect(screen.queryByText(/of about/)).not.toBeInTheDocument();
    expect(screen.queryByText(/tops out at course/)).not.toBeInTheDocument();
  });

  it("stacks blocks continuously, whatever week earned them", () => {
    renderBuild({
      runLogs: [runLogFor("workout-002"), runLogFor("workout-007")],
      blockPlacements: [
        placementFor("run-workout-002", 3, 1),
        placementFor("run-workout-007", 3, 1, 1),
      ],
      today: "2026-08-10",
    });

    expect(within(tower()).getAllByRole("button")).toHaveLength(2);
  });

  it("shows only placed blocks in the structure", () => {
    renderBuild({
      runLogs: [runLogFor("workout-002"), runLogFor("workout-004")],
      blockPlacements: [placementFor("run-workout-002", 3, 1)],
      today: "2026-08-07",
    });

    const blocks = within(tower()).getAllByRole("button");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toHaveAccessibleName(
      "Tuesday, August 4, Easy, week 1, course 0, column 3",
    );
  });

  it("lists earned but unplaced blocks in the staging tray", () => {
    renderBuild({
      runLogs: [
        runLogFor("workout-002"),
        runLogFor("workout-007", { completedDate: "2026-08-09" }),
      ],
      blockPlacements: [placementFor("run-workout-002", 3, 1)],
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
      blockPlacements: [placementFor("run-workout-002", 3, 1)],
    });

    expect(
      screen.queryByRole("list", { name: "Blocks ready to place" }),
    ).not.toBeInTheDocument();
  });

  it("hovers the block over the tower and drops it where you choose", async () => {
    const user = userEvent.setup();
    const { onPlaceBlock } = renderBuild({
      runLogs: [runLogFor("workout-002"), runLogFor("workout-004")],
      blockPlacements: [placementFor("run-workout-004", 3, 2)],
      placingRunLogId: "run-workout-002",
      today: "2026-08-10",
    });

    // No sheet covers the tower: the landing slots are on the structure.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const slots = within(tower()).getAllByRole("button", { name: /^Drop Easy/ });
    // One slot per column, and each says where gravity would put the block:
    // columns 3 and 4 are built on, so a block dropped there lands higher.
    expect(slots).toHaveLength(8);
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
      runLogId: "run-workout-002",
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
      placingRunLogId: "run-workout-002",
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
      runLogId: "run-workout-002",
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
      placingRunLogId: "run-workout-002",
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
      runLogId: "run-workout-002",
      row: 0,
      columnStart: 2,
      width: 1,
      height: 1,
    });
  });

  it("announces where the hovering block would land", () => {
    renderBuild({
      runLogs: [runLogFor("workout-007", { distanceMiles: 9 })],
      placingRunLogId: "run-workout-007",
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
      placingRunLogId: "run-workout-007",
      today: "2026-08-10",
    });

    await user.click(screen.getByRole("button", { name: "Auto Place" }));
    await user.click(screen.getByRole("button", { name: "Drop" }));

    // Empty ground is level everywhere and seals nothing, so the tie falls to
    // the flush edge: hard against the left wall.
    expect(onPlaceBlock).toHaveBeenCalledWith({
      runLogId: "run-workout-007",
      row: 0,
      columnStart: 1,
      width: 4,
      height: 1,
    });
  });

  it("drags the hovering block, snapping it between the same valid columns", async () => {
    const user = userEvent.setup();
    const { onPlaceBlock } = renderBuild({
      runLogs: [runLogFor("workout-002")],
      placingRunLogId: "run-workout-002",
      today: "2026-08-10",
    });

    // jsdom has no layout, so give the tower a width the drag can measure:
    // 8 columns of 40px starting at x = 0.
    vi.spyOn(tower(), "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 320,
      bottom: 200,
      width: 320,
      height: 200,
      toJSON: () => ({}),
    });

    const chosen = screen.getByRole("button", {
      name: "Drop Easy block down column 1, landing on course 0",
    });
    fireEvent.pointerDown(chosen, { pointerId: 1, buttons: 1 });
    // Drag right into the middle of column 5.
    fireEvent.pointerMove(chosen, { pointerId: 1, buttons: 1, clientX: 180 });

    expect(screen.getByText("Column 5 · lands on course 0")).toBeInTheDocument();

    // Drop commits what the drag chose, and nothing was placed until then.
    expect(onPlaceBlock).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Drop" }));
    expect(onPlaceBlock).toHaveBeenCalledWith({
      runLogId: "run-workout-002",
      row: 0,
      columnStart: 5,
      width: 1,
      height: 1,
    });
  });

  it("ignores pointer movement that is not a drag", () => {
    renderBuild({
      runLogs: [runLogFor("workout-002")],
      placingRunLogId: "run-workout-002",
      today: "2026-08-10",
    });

    vi.spyOn(tower(), "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 320,
      bottom: 200,
      width: 320,
      height: 200,
      toJSON: () => ({}),
    });

    const chosen = screen.getByRole("button", {
      name: "Drop Easy block down column 1, landing on course 0",
    });
    // No button down: a hovering mouse must not move the block.
    fireEvent.pointerMove(chosen, { pointerId: 1, buttons: 0, clientX: 180 });

    expect(screen.getByText("Column 1 · lands on course 0")).toBeInTheDocument();
  });

  it("keeps tap and keyboard placement working alongside the drag layer", async () => {
    const user = userEvent.setup();
    const { onPlaceBlock } = renderBuild({
      runLogs: [runLogFor("workout-002")],
      placingRunLogId: "run-workout-002",
      today: "2026-08-10",
    });

    // Tap a slot the drag never touched, then commit from the keyboard.
    await user.click(
      screen.getByRole("button", {
        name: "Drop Easy block down column 7, landing on course 0",
      }),
    );
    screen.getByRole("button", { name: "Drop" }).focus();
    await user.keyboard("{Enter}");

    expect(onPlaceBlock).toHaveBeenCalledWith({
      runLogId: "run-workout-002",
      row: 0,
      columnStart: 7,
      width: 1,
      height: 1,
    });
  });

  it("cancels placing without building anything", async () => {
    const user = userEvent.setup();
    const { onPlaceBlock, onPlacingChange } = renderBuild({
      runLogs: [runLogFor("workout-002")],
      placingRunLogId: "run-workout-002",
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
    expect(onPlacingChange).toHaveBeenCalledWith("run-workout-007");
  });

  it("opens the run behind a placed block", async () => {
    const user = userEvent.setup();
    renderBuild({
      runLogs: [
        runLogFor("workout-007", {
          distanceMiles: 4.2,
          completedDate: "2026-08-09",
          notes: "Steady",
        }),
      ],
      blockPlacements: [placementFor("run-workout-007", 2, 2)],
      today: "2026-08-10",
    });

    await user.click(within(tower()).getByRole("button"));

    const sheet = screen.getByRole("dialog");
    expect(
      within(sheet).getByRole("heading", { name: "Long Run" }),
    ).toBeInTheDocument();
    expect(within(sheet).getByText("Sunday, August 9")).toBeInTheDocument();
    expect(within(sheet).getByText("4.2 mi")).toBeInTheDocument();
    expect(within(sheet).getByText("Steady")).toBeInTheDocument();
    // The schedule is context here, not the subject.
    expect(
      within(sheet).getByText(/Week 1 · Long Run: 4 Miles/),
    ).toBeInTheDocument();
  });

  it("says an extra run was not on the plan", async () => {
    const user = userEvent.setup();
    renderBuild({
      runLogs: [extraRun("run-extra-1", { completedDate: "2026-08-05" })],
      blockPlacements: [placementFor("run-extra-1", 1, 1)],
      today: "2026-08-10",
    });

    await user.click(within(tower()).getByRole("button"));

    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByText("Extra run")).toBeInTheDocument();
    expect(
      within(sheet).getByText(/not on the plan/),
    ).toBeInTheDocument();
  });

  it("earns an extra run a place in the staging tray", () => {
    renderBuild({
      runLogs: [extraRun("run-extra-1", { completedDate: "2026-08-05" })],
      today: "2026-08-10",
    });

    const tray = screen.getByRole("list", { name: "Blocks ready to place" });
    expect(within(tray).getByText("Extra")).toBeInTheDocument();
  });

  it("offers Move Block on the most recently placed block", async () => {
    const user = userEvent.setup();
    const { onPlacingChange } = renderBuild({
      runLogs: [runLogFor("workout-002")],
      blockPlacements: [placementFor("run-workout-002", 3, 1)],
      today: "2026-08-07",
    });

    await user.click(within(tower()).getByRole("button"));
    await user.click(screen.getByRole("button", { name: "Move Block" }));

    expect(onPlacingChange).toHaveBeenCalledWith("run-workout-002");
  });

  it("locks a block that has another resting on it", async () => {
    const user = userEvent.setup();
    renderBuild({
      runLogs: [
        runLogFor("workout-002"),
        runLogFor("workout-004", { completedDate: "2026-08-06" }),
      ],
      blockPlacements: [
        placementFor("run-workout-002", 3, 1, 0, 1, "2026-08-04T13:00:00.000Z"),
        placementFor("run-workout-004", 3, 1, 1, 1, "2026-08-06T13:00:00.000Z"),
      ],
      today: "2026-08-20",
    });

    // The lower block was placed first, so it can no longer be pulled out.
    await user.click(
      within(tower()).getByRole("button", { name: /Tuesday, August 4/ }),
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
