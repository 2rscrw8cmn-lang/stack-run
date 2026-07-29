import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { RunLog } from "../../domain/types";
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

function structure() {
  return screen.getByRole("list", { name: "Training weeks" });
}

function blocks() {
  return within(structure()).getAllByRole("button");
}

describe("BuildScreen", () => {
  it("renders one row per training week and one block per scheduled run", () => {
    render(<BuildScreen plan={plan} runLogs={[]} today="2026-08-05" />);

    expect(within(structure()).getAllByRole("listitem")).toHaveLength(18);
    expect(blocks()).toHaveLength(71);
  });

  it("builds upward, so race week is the first row and week 1 the last", () => {
    render(<BuildScreen plan={plan} runLogs={[]} today="2026-08-05" />);

    const rows = within(structure()).getAllByRole("listitem");
    expect(rows[0]).toHaveAccessibleName("Week 18");
    expect(rows[17]).toHaveAccessibleName("Week 1");
    expect(
      within(rows[0]).getByRole("button", { name: /Race/ }),
    ).toBeInTheDocument();
  });

  it("alternates the bond course so block seams do not line up", () => {
    render(<BuildScreen plan={plan} runLogs={[]} today="2026-08-05" />);

    const rows = within(structure()).getAllByRole("listitem");
    // Rows render newest first, so this reads week 18, 17, 16 …
    expect(rows.map((row) => row.getAttribute("data-bond")).slice(0, 4)).toEqual(
      ["b", "a", "b", "a"],
    );
  });

  it("creates no block for a rest day", () => {
    render(<BuildScreen plan={plan} runLogs={[]} today="2026-08-05" />);

    // Week 1 schedules four runs across seven days; the three rest days
    // contribute nothing.
    const weekOne = within(structure()).getByRole("listitem", {
      name: "Week 1",
    });
    expect(within(weekOne).getAllByRole("button")).toHaveLength(4);
    expect(
      within(weekOne).queryByRole("button", { name: /Rest/ }),
    ).not.toBeInTheDocument();
  });

  it("maps block width to the documented span for each workout type", () => {
    render(<BuildScreen plan={plan} runLogs={[]} today="2026-08-05" />);

    // Each block is named "Week N Weekday, Type, target, State".
    const spansByType = new Map<string, Set<string>>();
    for (const block of blocks()) {
      const type = (block.textContent ?? "").split(", ")[1];
      const spans = spansByType.get(type) ?? new Set<string>();
      spans.add(block.getAttribute("data-span") ?? "");
      spansByType.set(type, spans);
    }

    expect(
      Object.fromEntries(
        [...spansByType].map(([type, spans]) => [type, [...spans]]),
      ),
    ).toEqual({
      Easy: ["1"],
      Intervals: ["2"],
      Simulation: ["2"],
      "Long Run": ["3"],
      Race: ["4"],
    });
  });

  it("also exposes the span to CSS as a custom property", () => {
    render(<BuildScreen plan={plan} runLogs={[]} today="2026-08-05" />);

    const raceBlock = screen.getByRole("button", { name: /Race/ });
    expect(raceBlock.style.getPropertyValue("--piece-span")).toBe("4");
    expect(raceBlock.style.getPropertyValue("--piece-color")).toBe(
      "var(--race)",
    );
  });

  it("fills completed blocks, outlines future blocks, and marks past incomplete blocks", async () => {
    render(
      <BuildScreen
        plan={plan}
        runLogs={[runLogFor("workout-002")]}
        today="2026-08-07"
      />,
    );

    const stateOf = (name: RegExp) =>
      screen.getByRole("button", { name }).getAttribute("data-state");

    expect(stateOf(/Week 1 Tuesday/)).toBe("completed");
    expect(stateOf(/Week 1 Thursday/)).toBe("missed");
    expect(stateOf(/Week 1 Saturday/)).toBe("planned");

    // State is never colour-only: it is part of each block's accessible name.
    expect(
      screen.getByRole("button", { name: /Week 1 Tuesday, Easy, 2 miles, Completed/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Week 1 Thursday, Easy, 2 miles, Missed/ }),
    ).toBeInTheDocument();
  });

  it("glows only the most recently logged block", () => {
    render(
      <BuildScreen
        plan={plan}
        runLogs={[
          runLogFor("workout-002", { updatedAt: "2026-08-04T12:00:00.000Z" }),
          runLogFor("workout-004", { updatedAt: "2026-08-06T12:00:00.000Z" }),
        ]}
        today="2026-08-07"
      />,
    );

    const newest = blocks().filter(
      (block) => block.getAttribute("data-newest") === "true",
    );
    expect(newest).toHaveLength(1);
    expect(newest[0]).toHaveAccessibleName(/Week 1 Thursday/);
  });

  it("shows the summary metrics", () => {
    render(
      <BuildScreen
        plan={plan}
        runLogs={[
          runLogFor("workout-002", { distanceMiles: 2.1 }),
          runLogFor("workout-004", { distanceMiles: 2.4 }),
        ]}
        today="2026-08-06"
      />,
    );

    expect(screen.getByText("Runs Complete").parentElement).toHaveTextContent(
      "2 / 71",
    );
    expect(screen.getByText("Total Miles").parentElement).toHaveTextContent(
      "4.5",
    );
    expect(screen.getByText("Run Streak").parentElement).toHaveTextContent("2");
  });

  it("shows a compact legend of block types and states without Rest", () => {
    render(<BuildScreen plan={plan} runLogs={[]} today="2026-08-05" />);

    const types = screen.getByRole("list", { name: "Workout types" });
    expect(
      within(types)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Easy", "Intervals", "Simulation", "Long Run", "Race"]);

    const states = screen.getByRole("list", { name: "Block states" });
    expect(
      within(states)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Completed", "Planned", "Missed"]);
  });

  it("opens the workout detail sheet on click", async () => {
    const user = userEvent.setup();
    render(<BuildScreen plan={plan} runLogs={[]} today="2026-08-05" />);

    await user.click(screen.getByRole("button", { name: /Week 1 Sunday/ }));

    const sheet = screen.getByRole("dialog");
    expect(
      within(sheet).getByRole("heading", { name: "Long Run: 4 Miles" }),
    ).toBeInTheDocument();
    expect(within(sheet).getByText("Planned")).toBeInTheDocument();
    expect(within(sheet).getByText(/Sunday, August 9, 2026/)).toBeInTheDocument();
    expect(within(sheet).getByText("4 miles")).toBeInTheDocument();
    expect(
      within(sheet).getByText("Easy effort. Finish feeling controlled."),
    ).toBeInTheDocument();
  });

  it("opens the workout detail sheet from the keyboard", async () => {
    const user = userEvent.setup();
    render(<BuildScreen plan={plan} runLogs={[]} today="2026-08-05" />);

    const block = screen.getByRole("button", { name: /Week 1 Tuesday/ });
    block.focus();
    expect(block).toHaveFocus();

    await user.keyboard("{Enter}");

    expect(
      within(screen.getByRole("dialog")).getByRole("heading", {
        name: "2 Miles",
      }),
    ).toBeInTheDocument();
  });

  it("shows the actual result for a completed workout and closes again", async () => {
    const user = userEvent.setup();
    render(
      <BuildScreen
        plan={plan}
        runLogs={[
          runLogFor("workout-002", {
            distanceMiles: 2.1,
            durationSeconds: 1230,
            effort: "great",
            notes: "Felt easy.",
          }),
        ]}
        today="2026-08-05"
      />,
    );

    await user.click(screen.getByRole("button", { name: /Week 1 Tuesday/ }));

    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByText("Actual result")).toBeInTheDocument();
    expect(within(sheet).getByText("2.1 mi")).toBeInTheDocument();
    expect(within(sheet).getByText("20:30")).toBeInTheDocument();
    expect(within(sheet).getByText("Great")).toBeInTheDocument();
    expect(within(sheet).getByText("Felt easy.")).toBeInTheDocument();

    await user.click(within(sheet).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
