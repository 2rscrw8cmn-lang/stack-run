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

  it("switches to the Build structure and the Plan placeholder on tap", async () => {
    const user = setupUser();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Build" }));
    expect(screen.getByRole("heading", { name: "Build" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Build" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("list", { name: "Built courses" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Plan" }));
    expect(screen.getByRole("heading", { name: "Plan" })).toBeInTheDocument();
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
      within(screen.getByRole("list", { name: "Built courses" })).queryAllByRole(
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
    await user.click(screen.getByRole("button", { name: "Place Block" }));
    await user.click(screen.getByRole("button", { name: "Auto Place" }));

    // Placing from Today lands on Build so the payoff is visible.
    expect(screen.getByRole("button", { name: "Build" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const placed = within(
      screen.getByRole("list", { name: "Built courses" }),
    ).getAllByRole("button");
    expect(placed).toHaveLength(1);
    expect(placed[0]).toHaveAccessibleName(
      "Week 1 Tuesday, Easy, 2 miles, column 4",
    );
    expect(
      screen.queryByRole("list", { name: "Blocks ready to place" }),
    ).not.toBeInTheDocument();

    unmount();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Build" }));
    expect(
      within(screen.getByRole("list", { name: "Built courses" })).getAllByRole(
        "button",
      ),
    ).toHaveLength(1);
  });
});
