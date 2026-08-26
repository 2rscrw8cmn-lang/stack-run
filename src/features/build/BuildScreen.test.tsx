import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { BlockPlacement, RunLog } from "../../domain/types.js";
import { loadSeedPlan } from "../../seed/loadSeedPlan.js";
import { BuildScreen, type PlacementRequest } from "./BuildScreen.js";

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
  const onSaveRun = vi.fn();
  const onDeleteRun = vi.fn();
  const utils = render(
    <BuildScreen
      plan={plan}
      runLogs={[]}
      blockPlacements={[]}
      onPlaceBlock={onPlaceBlock}
      onPlacingChange={onPlacingChange}
      onSaveRun={onSaveRun}
      onDeleteRun={onDeleteRun}
      today="2026-08-05"
      {...props}
    />,
  );
  return { onPlaceBlock, onPlacingChange, onSaveRun, onDeleteRun, ...utils };
}

function tower() {
  return screen.getByRole("list", { name: "Built blocks" });
}

/**
 * jsdom has no layout, so the drag has nothing to measure. Eight columns of
 * 40px starting at x = 0 gives it a tower to work against.
 */
function measureTower() {
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
}

function labels() {
  return [...document.querySelectorAll(".placed-block__label")].map(
    (node) => node.textContent,
  );
}

/**
 * Build with a parent that actually keeps the placement, so a committed block
 * really does appear in the tower and can be watched through its payoff.
 */
function BuildHarness({
  runLogs,
  placingRunLogId,
}: {
  runLogs: RunLog[];
  placingRunLogId: string;
}) {
  const [placements, setPlacements] = useState<BlockPlacement[]>([]);
  const [placing, setPlacing] = useState<string | null>(placingRunLogId);

  return (
    <BuildScreen
      plan={plan}
      runLogs={runLogs}
      blockPlacements={placements}
      onPlaceBlock={(request: PlacementRequest) =>
        setPlacements((current) => [
          ...current,
          { ...request, placedAt: "2026-08-10T12:00:00.000Z" },
        ])
      }
      placingRunLogId={placing}
      onPlacingChange={setPlacing}
      today="2026-08-10"
    />
  );
}

describe("BuildScreen", () => {
  it("leads with the miles built and nothing else", () => {
    renderBuild({
      runLogs: [
        runLogFor("workout-002", { distanceMiles: 2.1 }),
        runLogFor("workout-004", { distanceMiles: 2.4 }),
      ],
      today: "2026-08-06",
    });

    // The miles the tower is made of are the only accumulated fact here.
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "4.5 miles built",
    );
    expect(screen.queryByText("Runs Complete")).not.toBeInTheDocument();
    expect(screen.queryByText("Run Streak")).not.toBeInTheDocument();
  });

  it("puts nothing in the place of the stats it dropped", () => {
    renderBuild({
      runLogs: [runLogFor("workout-002")],
      blockPlacements: [placementFor("run-workout-002", 3, 1)],
      today: "2026-08-06",
    });

    // One h1, and no second band of figures standing in for the old two.
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(document.querySelectorAll(".build-heading dl")).toHaveLength(0);
  });

  it("shows the tower before the blocks waiting to go in it", () => {
    renderBuild({
      runLogs: [
        runLogFor("workout-002"),
        runLogFor("workout-007", { completedDate: "2026-08-09" }),
      ],
      blockPlacements: [placementFor("run-workout-002", 3, 1)],
      today: "2026-08-10",
    });

    const structure = screen.getByRole("list", { name: "Built blocks" });
    const tray = screen.getByRole("list", { name: "Blocks ready to place" });
    expect(
      structure.compareDocumentPosition(tray) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("does not render a full 18-week blueprint of future workouts", () => {
    renderBuild();

    // Nothing is built until a block is placed, and an empty grid with a
    // ground line under it reads as a fault, so the first run gets words.
    expect(screen.queryByRole("list", { name: "Built blocks" })).toBeNull();
    expect(screen.getByText("Nothing built yet")).toBeInTheDocument();
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
      "Tuesday, August 4, Easy, 2.1 miles, manual entry, week 1, course 0, column 3",
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
    const slots = within(tower()).getAllByRole("button", { name: /^Place Easy/ });
    // One slot per column, and each says where gravity would put the block:
    // columns 3 and 4 are built on, so a block dropped there lands higher.
    expect(slots).toHaveLength(8);
    expect(slots[0]).toHaveAccessibleName(
      "Place Easy block in column 1",
    );
    expect(slots[2]).toHaveAccessibleName(
      "Place Easy block in column 3",
    );

    await user.click(
      screen.getByRole("button", {
        name: "Place Easy block in column 5",
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
    expect(screen.getByText("Column 1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Move block right" }));
    expect(screen.getByText("Column 2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Move block right" }));
    await user.click(screen.getByRole("button", { name: "Move block left" }));
    expect(screen.getByText("Column 2")).toBeInTheDocument();

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
      name: "Place Easy block in column 2",
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
        "Long Run block over columns 1 to 4.",
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
      name: "Place Easy block in column 1",
    });
    fireEvent.pointerDown(chosen, { pointerId: 1, buttons: 1 });
    // Drag right into the middle of column 5.
    fireEvent.pointerMove(chosen, { pointerId: 1, buttons: 1, clientX: 180 });

    expect(screen.getByText("Column 5")).toBeInTheDocument();

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
      name: "Place Easy block in column 1",
    });
    // No button down: a hovering mouse must not move the block.
    fireEvent.pointerMove(chosen, { pointerId: 1, buttons: 0, clientX: 180 });

    expect(screen.getByText("Column 1")).toBeInTheDocument();
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
        name: "Place Easy block in column 7",
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

  it("has no legend taking room from the tower", () => {
    renderBuild();

    expect(
      screen.queryByRole("list", { name: "Workout types" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Legend")).not.toBeInTheDocument();
  });

  it("edits the run behind a placed block, including an extra one", async () => {
    const user = userEvent.setup();
    const { onSaveRun } = renderBuild({
      runLogs: [extraRun("run-extra-1", { completedDate: "2026-08-05" })],
      blockPlacements: [placementFor("run-extra-1", 1, 1)],
      today: "2026-08-10",
    });

    await user.click(within(tower()).getByRole("button"));
    await user.click(screen.getByRole("button", { name: "Edit Run" }));

    expect(screen.getByRole("heading", { name: "Edit Run" })).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/Distance/));
    await user.type(screen.getByLabelText(/Distance/), "4.4");
    await user.click(screen.getByRole("button", { name: "Save Run" }));

    expect(onSaveRun).toHaveBeenCalledTimes(1);
    expect(onSaveRun.mock.calls[0][1]).toMatchObject({ distanceMiles: 4.4 });
    expect(onSaveRun.mock.calls[0][2]).toBe("run-extra-1");
  });

  it("deletes the run behind a waiting block from the tray", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { onDeleteRun } = renderBuild({
      runLogs: [extraRun("run-extra-1", { completedDate: "2026-08-05" })],
      today: "2026-08-10",
    });

    await user.click(screen.getByRole("button", { name: /Edit Easy run/ }));
    await user.click(screen.getByRole("button", { name: "Delete Run" }));

    expect(onDeleteRun).toHaveBeenCalledWith("run-extra-1");
    confirm.mockRestore();
  });
});

describe("mileage on the blocks", () => {
  it("writes the distance on a block wide enough to hold it", () => {
    renderBuild({
      runLogs: [
        // 2.1 mi earns a width-1 block, 4.2 a width-2, 6.4 a width-3.
        runLogFor("workout-002", { distanceMiles: 2.1 }),
        runLogFor("workout-004", { distanceMiles: 4.2 }),
        runLogFor("workout-007", { distanceMiles: 6.4 }),
      ],
      blockPlacements: [
        placementFor("run-workout-002", 1, 1),
        placementFor("run-workout-004", 2, 2),
        placementFor("run-workout-007", 4, 3),
      ],
      today: "2026-08-10",
    });

    // Width 1 and 2 take the compact number; width 3 has room for the unit.
    // These fixture runs carry no source, which is a hand-logged run, so each
    // face also wears issue #129's asterisk.
    expect(labels()).toEqual(["2.1*", "4.2*", "6.4*MI"]);
  });

  it("rounds a converted distance to something a brick can hold", () => {
    renderBuild({
      runLogs: [runLogFor("workout-004", { distanceMiles: 4.163456 })],
      blockPlacements: [placementFor("run-workout-004", 2, 2)],
      today: "2026-08-10",
    });

    expect(labels()).toEqual(["4.2*"]);
  });

  it("keeps the full run facts in the block's accessible name", () => {
    renderBuild({
      runLogs: [runLogFor("workout-002", { distanceMiles: 2.14 })],
      blockPlacements: [placementFor("run-workout-002", 1, 1)],
      today: "2026-08-10",
    });

    // The compact face rounds, while the name keeps the exact distance.
    expect(labels()).toEqual(["2.1*"]);
    expect(within(tower()).getByRole("button")).toHaveAccessibleName(
      "Tuesday, August 4, Easy, 2.14 miles, manual entry, week 1, course 0, column 1",
    );
  });

  /*
   * Issue #129: manual entry is the exception, so it is the only one that
   * gets a mark — one asterisk after the mileage, and nothing else anywhere
   * on the brick. A synced block is byte-for-byte what it always was.
   */
  it("marks a hand-logged block's mileage and leaves a synced one alone", () => {
    renderBuild({
      runLogs: [
        runLogFor("workout-002", { distanceMiles: 2.1, source: "manual" }),
        runLogFor("workout-004", { distanceMiles: 4.2, source: "intervals" }),
      ],
      blockPlacements: [
        placementFor("run-workout-002", 1, 1),
        placementFor("run-workout-004", 2, 2),
      ],
      today: "2026-08-10",
    });

    expect(labels()).toEqual(["2.1*", "4.2"]);
    const [manual, synced] = within(tower()).getAllByRole("button");
    expect(manual).toHaveAccessibleName(/manual entry/);
    expect(synced).not.toHaveAccessibleName(/manual entry/);
    // The asterisk is the whole treatment: no badge, no icon, no legend.
    expect(tower().querySelectorAll("svg")).toHaveLength(0);
  });

  it("does not persist the label it derives", () => {
    const { onPlaceBlock } = renderBuild({
      runLogs: [runLogFor("workout-004", { distanceMiles: 4.2 })],
      placingRunLogId: "run-workout-004",
      today: "2026-08-10",
    });

    fireEvent.click(screen.getByRole("button", { name: "Drop" }));

    // Exact equality: the placement carries geometry and nothing else, so a
    // label or a payoff can never have found its way into stored state.
    expect(onPlaceBlock).toHaveBeenCalledWith({
      runLogId: "run-workout-004",
      row: 0,
      columnStart: 1,
      width: 2,
      height: 1,
    });
  });
});

describe("the race capstone", () => {
  const raceRun = runLogFor("workout-002", {
    id: "run-race",
    activityType: "race",
    distanceMiles: 26.2,
    completedDate: "2026-12-06",
  });

  it("crowns the tower once the race has been run and placed", () => {
    renderBuild({
      runLogs: [raceRun],
      blockPlacements: [placementFor("run-race", 1, 4, 0, 3)],
      today: "2026-12-07",
    });

    expect(document.querySelectorAll('[data-capstone="true"]')).toHaveLength(1);
    // The one block whose distance the runner already knows says what it is.
    expect(labels()).toEqual(["RACE"]);
  });

  it("shows nothing at all before the race is earned", () => {
    // The plan has a race in it; no race has been run.
    renderBuild({
      runLogs: [runLogFor("workout-002")],
      blockPlacements: [placementFor("run-workout-002", 3, 1)],
      today: "2026-08-10",
    });

    expect(document.querySelector("[data-capstone]")).toBeNull();
    expect(screen.queryByText("RACE")).not.toBeInTheDocument();
  });

  it("wears a dumbbell on Cross Training instead of a bare 0", () => {
    renderBuild({
      runLogs: [
        runLogFor("workout-002", {
          id: "run-cross",
          activityType: "cross",
          distanceMiles: 0,
        }),
      ],
      blockPlacements: [placementFor("run-cross", 3, 1)],
      today: "2026-08-06",
    });

    // The face carries an icon, not text: no "0" or "0MI" anywhere on it.
    expect(labels()).toEqual([""]);
    expect(document.querySelector(".placed-block__icon")).not.toBeNull();
  });

  it("leaves the race block on the existing geometry", () => {
    const { onPlaceBlock } = renderBuild({
      runLogs: [raceRun],
      placingRunLogId: "run-race",
      today: "2026-12-07",
    });

    fireEvent.click(screen.getByRole("button", { name: "Drop" }));

    // Width 4 from the distance band, height 3 from the activity type — the
    // capstone is styling, not a new footprint.
    expect(onPlaceBlock).toHaveBeenCalledWith({
      runLogId: "run-race",
      row: 0,
      columnStart: 1,
      width: 4,
      height: 3,
    });
  });
});

describe("placing by pointer", () => {
  it("commits where the drag ended when the finger lifts", () => {
    const { onPlaceBlock } = renderBuild({
      runLogs: [runLogFor("workout-002")],
      placingRunLogId: "run-workout-002",
      today: "2026-08-10",
    });
    measureTower();

    const chosen = screen.getByRole("button", {
      name: "Place Easy block in column 1",
    });
    fireEvent.pointerDown(chosen, { pointerId: 1, buttons: 1, clientX: 20 });
    fireEvent.pointerMove(chosen, { pointerId: 1, buttons: 1, clientX: 180 });
    fireEvent.pointerUp(chosen, { pointerId: 1, clientX: 180 });

    // No separate Drop press: letting go after a real drag is the placement.
    expect(onPlaceBlock).toHaveBeenCalledWith({
      runLogId: "run-workout-002",
      row: 0,
      columnStart: 5,
      width: 1,
      height: 1,
    });
  });

  it("keeps following the finger past the first column it snaps to", () => {
    const { onPlaceBlock } = renderBuild({
      runLogs: [runLogFor("workout-002")],
      placingRunLogId: "run-workout-002",
      today: "2026-08-10",
    });
    measureTower();

    const chosen = screen.getByRole("button", {
      name: "Place Easy block in column 1",
    });
    fireEvent.pointerDown(chosen, { pointerId: 1, buttons: 1, clientX: 20 });
    // The slot that was grabbed stops being the chosen one here, and the drag
    // has to survive that.
    fireEvent.pointerMove(chosen, { pointerId: 1, buttons: 1, clientX: 180 });
    fireEvent.pointerMove(chosen, { pointerId: 1, buttons: 1, clientX: 300 });
    fireEvent.pointerUp(chosen, { pointerId: 1, clientX: 300 });

    expect(onPlaceBlock).toHaveBeenCalledWith({
      runLogId: "run-workout-002",
      row: 0,
      columnStart: 8,
      width: 1,
      height: 1,
    });
  });

  it("brings the block to wherever the finger goes down", () => {
    const { onPlaceBlock } = renderBuild({
      runLogs: [runLogFor("workout-007", { distanceMiles: 6.2 })],
      placingRunLogId: "run-workout-007",
      today: "2026-08-10",
    });
    measureTower();

    // A 3-wide block has six landings and they overlap, so the slot under a
    // finger is usually not the one the block is sitting in. Pressing it has
    // to pick the block up all the same.
    const elsewhere = screen.getByRole("button", {
      name: "Place Long Run block in columns 4 through 6",
    });
    fireEvent.pointerDown(elsewhere, { pointerId: 1, buttons: 1, clientX: 190 });
    expect(screen.getByText("Column 4")).toBeInTheDocument();

    fireEvent.pointerMove(elsewhere, { pointerId: 1, buttons: 1, clientX: 250 });
    fireEvent.pointerUp(elsewhere, { pointerId: 1, clientX: 250 });

    expect(onPlaceBlock).toHaveBeenCalledWith({
      runLogId: "run-workout-007",
      row: 0,
      columnStart: 6,
      width: 3,
      height: 1,
    });
  });

  it("treats a tap as a choice, not a placement", () => {
    const { onPlaceBlock } = renderBuild({
      runLogs: [runLogFor("workout-002")],
      placingRunLogId: "run-workout-002",
      today: "2026-08-10",
    });
    measureTower();

    const chosen = screen.getByRole("button", {
      name: "Place Easy block in column 1",
    });
    // Down and up in the same place, with the wobble a finger really makes.
    fireEvent.pointerDown(chosen, { pointerId: 1, buttons: 1, clientX: 20 });
    fireEvent.pointerMove(chosen, { pointerId: 1, buttons: 1, clientX: 23 });
    fireEvent.pointerUp(chosen, { pointerId: 1, clientX: 23 });
    fireEvent.click(chosen);

    expect(onPlaceBlock).not.toHaveBeenCalled();
    // Still in hand, still on the column that was tapped.
    expect(screen.getByText("Column 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Drop" })).toBeInTheDocument();
  });

  it("can only ever land on a column the placement domain offered", () => {
    const { onPlaceBlock } = renderBuild({
      runLogs: [runLogFor("workout-007", { distanceMiles: 9 })],
      placingRunLogId: "run-workout-007",
      today: "2026-08-10",
    });
    measureTower();

    const chosen = screen.getByRole("button", {
      name: "Place Long Run block in columns 1 through 4",
    });
    fireEvent.pointerDown(chosen, { pointerId: 1, buttons: 1, clientX: 20 });
    // Drag hard past the right wall. A 4-wide block cannot start past column
    // 5, and the snap has nowhere invalid to go.
    fireEvent.pointerMove(chosen, { pointerId: 1, buttons: 1, clientX: 900 });
    fireEvent.pointerUp(chosen, { pointerId: 1, clientX: 900 });

    expect(onPlaceBlock).toHaveBeenCalledWith({
      runLogId: "run-workout-007",
      row: 0,
      columnStart: 5,
      width: 4,
      height: 1,
    });
  });

  it("abandons a drag the browser cancels", () => {
    const { onPlaceBlock } = renderBuild({
      runLogs: [runLogFor("workout-002")],
      placingRunLogId: "run-workout-002",
      today: "2026-08-10",
    });
    measureTower();

    const chosen = screen.getByRole("button", {
      name: "Place Easy block in column 1",
    });
    fireEvent.pointerDown(chosen, { pointerId: 1, buttons: 1, clientX: 20 });
    fireEvent.pointerMove(chosen, { pointerId: 1, buttons: 1, clientX: 180 });
    fireEvent.pointerCancel(chosen, { pointerId: 1 });
    fireEvent.pointerUp(chosen, { pointerId: 1, clientX: 180 });

    expect(onPlaceBlock).not.toHaveBeenCalled();
  });
});

describe("the placement payoff", () => {
  it("says what the block added, then takes it back", () => {
    vi.useFakeTimers();
    try {
      render(
        <BuildHarness
          runLogs={[runLogFor("workout-002", { distanceMiles: 2.1 })]}
          placingRunLogId="run-workout-002"
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Drop" }));

      // Once on screen and once in the live region: the same sentence, said
      // to whoever is in a position to receive it.
      const said = "2.1 miles added · 2.1 miles built";
      expect(screen.getAllByText(said)).toHaveLength(2);

      act(() => void vi.advanceTimersByTime(3000));
      // The visible half takes itself away. The live region keeps its last
      // message, as a live region does — it is not read again.
      expect(document.querySelector(".build-payoff")).toBeNull();
      expect(screen.getAllByText(said)).toHaveLength(1);
      // The tower it leaves behind is unchanged.
      expect(within(tower()).getAllByRole("button")).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("marks the new brick only while the payoff lasts", () => {
    vi.useFakeTimers();
    try {
      render(
        <BuildHarness
          runLogs={[runLogFor("workout-002")]}
          placingRunLogId="run-workout-002"
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Drop" }));
      expect(
        document.querySelectorAll('[data-just-placed="true"]'),
      ).toHaveLength(1);

      act(() => void vi.advanceTimersByTime(3000));
      expect(document.querySelector("[data-just-placed]")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("leaves the motion entirely to the stylesheet", () => {
    vi.useFakeTimers();
    try {
      render(
        <BuildHarness
          runLogs={[runLogFor("workout-002")]}
          placingRunLogId="run-workout-002"
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Drop" }));

      // Nothing animates from JavaScript, which is what lets the reduced-motion
      // media query switch the whole payoff off.
      const brick = document.querySelector<HTMLElement>(
        '[data-just-placed="true"] .placed-block__brick',
      );
      expect(brick).not.toBeNull();
      expect(brick!.style.animation).toBe("");
      expect(brick!.style.transform).toBe("");
    } finally {
      vi.useRealTimers();
    }
  });

  it("says nothing about miles added when a block only moved", () => {
    vi.useFakeTimers();
    try {
      render(
        <BuildHarness
          runLogs={[runLogFor("workout-002", { distanceMiles: 2.1 })]}
          placingRunLogId="run-workout-002"
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Drop" }));
      act(() => void vi.advanceTimersByTime(3000));

      fireEvent.click(within(tower()).getByRole("button"));
      fireEvent.click(screen.getByRole("button", { name: "Move Block" }));
      fireEvent.click(screen.getByRole("button", { name: "Move block right" }));
      fireEvent.click(screen.getByRole("button", { name: "Drop" }));

      expect(screen.queryByText(/miles added/)).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  /**
   * The landing, per issue #76. The motion itself is the stylesheet's; what
   * the screen owes it is an honest description of which block is arriving
   * and how big it is.
   */
  it("weighs the landing by the block's own footprint, ground included", () => {
    vi.useFakeTimers();
    try {
      render(
        <BuildHarness
          // Three columns wide and two courses tall: one of the largest
          // objects a training block can be.
          runLogs={[
            extraRun("extra-sim", {
              activityType: "simulation",
              distanceMiles: 6,
            }),
          ]}
          placingRunLogId="extra-sim"
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Drop" }));
      expect(
        document.querySelector('[data-just-placed="true"]'),
      ).toHaveAttribute("data-impact", "heavy");
      // The site answers with the same weight, so the block and the ground
      // can never disagree about what just landed.
      expect(document.querySelector(".build-site__ground")).toHaveAttribute(
        "data-impact",
        "heavy",
      );

      act(() => void vi.advanceTimersByTime(3000));
      expect(
        document.querySelector(".build-site__ground"),
      ).not.toHaveAttribute("data-impact");
    } finally {
      vi.useRealTimers();
    }
  });

  it("lands a short run more lightly than a large one", () => {
    vi.useFakeTimers();
    try {
      render(
        <BuildHarness
          runLogs={[runLogFor("workout-002", { distanceMiles: 2.1 })]}
          placingRunLogId="run-workout-002"
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Drop" }));
      expect(
        document.querySelector('[data-just-placed="true"]'),
      ).toHaveAttribute("data-impact", "light");
    } finally {
      vi.useRealTimers();
    }
  });

  it("never lands a block that was already standing there", () => {
    // A tower that arrives with the page — hydration, a reload, a restored
    // backup — is a tower that has already been built. Nothing falls.
    renderBuild({
      runLogs: [
        runLogFor("workout-002", { distanceMiles: 2.1 }),
        extraRun("extra-001", { distanceMiles: 5.5 }),
      ],
      blockPlacements: [
        placementFor("run-workout-002", 1, 1),
        placementFor("extra-001", 3, 3),
      ],
    });

    expect(document.querySelector("[data-just-placed]")).toBeNull();
    expect(document.querySelector("[data-impact]")).toBeNull();
  });
});
