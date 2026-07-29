import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RunLog } from "../../domain/types";
import { loadSeedPlan } from "../../seed/loadSeedPlan";
import { CompleteRunSheet } from "./CompleteRunSheet";

const workout = loadSeedPlan().weeks[0].workouts.find(
  (item) => item.type !== "rest",
)!;

const runLog: RunLog = {
  id: "log-1",
  workoutId: workout.id,
  completedDate: "2026-08-04",
  distanceMiles: 2.1,
  durationSeconds: 1230,
  effort: "solid",
  notes: "Legs felt heavy",
  createdAt: "2026-08-04T12:00:00.000Z",
  updatedAt: "2026-08-04T12:00:00.000Z",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CompleteRunSheet", () => {
  it("validates required fields then saves a valid entry", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <CompleteRunSheet
        isOpen
        workout={workout}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Save Run" }));
    expect(screen.getByText("Enter your distance.")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/Distance/), "3.2");
    await user.type(screen.getByLabelText(/Duration/), "31:42");
    await user.click(screen.getByRole("button", { name: "Great" }));
    await user.type(screen.getByLabelText(/Notes/), "Felt good");
    expect(screen.getByText("9/120")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save Run" }));
    expect(onSave).toHaveBeenCalledWith(workout, {
      distanceMiles: 3.2,
      durationSeconds: 1902,
      effort: "great",
      notes: "Felt good",
    });
  });

  it("prefills the existing log when editing a run", () => {
    render(
      <CompleteRunSheet
        isOpen
        workout={workout}
        runLog={runLog}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Edit Run" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Distance/)).toHaveValue("2.1");
    expect(screen.getByLabelText(/Duration/)).toHaveValue("20:30");
    expect(screen.getByRole("button", { name: "Solid" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText(/Notes/)).toHaveValue("Legs felt heavy");
  });

  it("confirms before discarding an edited entry", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <CompleteRunSheet
        isOpen
        workout={workout}
        onClose={onClose}
        onSave={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText(/Distance/), "3.2");
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes an untouched sheet without confirming", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <CompleteRunSheet
        isOpen
        workout={workout}
        onClose={onClose}
        onSave={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(confirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
