import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

// App reads the real local date, and the plan only offers a run to log on days
// that schedule one. Pin the clock to a week 1 run day so these tests do not
// depend on when they happen to run.
beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-08-04T09:00:00"));
});

afterEach(() => {
  vi.useRealTimers();
});

function setupUser() {
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

async function logTodaysRun(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Mark Complete" }));
  await user.type(screen.getByLabelText(/Distance/), "2.1");
  await user.type(screen.getByLabelText(/Duration/), "2030");
  await user.click(screen.getByRole("button", { name: "Solid" }));
  await user.click(screen.getByRole("button", { name: "Save Run" }));
}

describe("App", () => {
  it("shows the real Today screen, seeded from the training plan, by default", () => {
    render(<App />);
    expect(screen.getByText("OUC Half Marathon")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Today" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("switches to the Build structure and the Plan schedule on tap", async () => {
    const user = setupUser();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Build" }));
    expect(screen.getByRole("heading", { name: "Build" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Build" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("list", { name: "Built blocks" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Plan" }));
    expect(screen.getByRole("heading", { name: "Plan" })).toBeInTheDocument();
    // Plan opens on the week containing the pinned date.
    expect(screen.getByText("Week 1 of 18")).toBeInTheDocument();
    expect(
      within(screen.getByRole("list", { name: "Week 1 workouts" })).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(7);
  });

  it("logs a past run from Plan, dates it by the workout, and keeps it after a reload", async () => {
    const user = setupUser();
    // Wednesday of week 2, so every week 1 run is genuinely in the past.
    vi.setSystemTime(new Date("2026-08-12T09:00:00"));
    const { unmount } = render(<App />);

    await user.click(screen.getByRole("button", { name: "Plan" }));
    expect(screen.getByText("Week 2 of 18")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Previous week" }));
    await user.click(
      screen.getByRole("button", {
        name: "Tuesday, August 4, 2 Miles, Easy, 2 mi, Missed",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Log Run" }));
    await user.type(screen.getByLabelText(/Distance/), "2.1");
    await user.type(screen.getByLabelText(/Duration/), "2030");
    await user.click(screen.getByRole("button", { name: "Solid" }));
    await user.click(screen.getByRole("button", { name: "Save Run" }));

    expect(
      screen.getByRole("button", {
        name: "Tuesday, August 4, 2 Miles, Easy, 2 mi, Completed",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("1 of 4 runs complete")).toBeInTheDocument();

    // The log is dated by the workout it belongs to, not by the entry time.
    const stored = JSON.parse(localStorage.getItem("stack.app-state.v1") ?? "{}");
    expect(stored.runLogs).toHaveLength(1);
    expect(stored.runLogs[0].completedDate).toBe("2026-08-04");

    unmount();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Plan" }));
    await user.click(screen.getByRole("button", { name: "Previous week" }));
    expect(screen.getByText("1 of 4 runs complete")).toBeInTheDocument();
  });

  it("earns a block on save and keeps it pending until it is placed", async () => {
    const user = setupUser();
    const { unmount } = render(<App />);

    await logTodaysRun(user);
    expect(screen.getByText("You earned an Easy block.")).toBeInTheDocument();

    // The block is waiting in Build's staging tray, not in the structure.
    await user.click(screen.getByRole("button", { name: "Build" }));
    expect(
      within(screen.getByRole("list", { name: "Blocks ready to place" })).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(1);
    expect(
      within(screen.getByRole("list", { name: "Built blocks" })).queryAllByRole(
        "button",
      ),
    ).toHaveLength(0);

    // A pending block survives a reload.
    unmount();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Build" }));
    expect(
      screen.getByRole("list", { name: "Blocks ready to place" }),
    ).toBeInTheDocument();
  });

  it("places an earned block, shows it in the structure, and keeps it after a reload", async () => {
    const user = setupUser();
    const { unmount } = render(<App />);

    await logTodaysRun(user);
    // Place Block hands off to Build, where the block hovers over the tower.
    await user.click(screen.getByRole("button", { name: "Place Block" }));
    expect(screen.getByRole("button", { name: "Build" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Drop" }));
    const placed = within(
      screen.getByRole("list", { name: "Built blocks" }),
    ).getAllByRole("button");
    expect(placed).toHaveLength(1);
    expect(placed[0]).toHaveAccessibleName(
      "Week 1 Tuesday, Easy, course 0, column 1",
    );
    expect(
      screen.queryByRole("list", { name: "Blocks ready to place" }),
    ).not.toBeInTheDocument();

    unmount();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Build" }));
    expect(
      within(screen.getByRole("list", { name: "Built blocks" })).getAllByRole(
        "button",
      ),
    ).toHaveLength(1);
  });
});
