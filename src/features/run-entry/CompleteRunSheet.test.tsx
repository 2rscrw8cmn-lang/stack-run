import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RunLog } from "../../domain/types";
import { loadSeedPlan } from "../../seed/loadSeedPlan";
import { CompleteRunSheet } from "./CompleteRunSheet";

const workout = loadSeedPlan().weeks[0].workouts.find(
  (item) => item.type !== "rest",
)!;

const TODAY = "2026-08-06";

const runLog: RunLog = {
  id: "log-1",
  workoutId: workout.id,
  completedDate: "2026-08-04",
  activityType: "easy",
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
        today={TODAY}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Save Run" }));
    expect(screen.getByText("Enter your distance.")).toBeInTheDocument();
    expect(screen.getByText("Enter your duration.")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/Distance/), "3.2");
    // Digits only: the on-screen numeric keypad has no colon key.
    await user.type(screen.getByLabelText(/Duration/), "3142");
    expect(screen.getByLabelText(/Duration/)).toHaveValue("31:42");
    await user.click(screen.getByRole("button", { name: "Great" }));
    await user.type(screen.getByLabelText(/Notes/), "Felt good");
    expect(screen.getByText("9/120")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save Run" }));
    expect(onSave).toHaveBeenCalledWith(workout, {
      completedDate: workout.date,
      activityType: workout.type,
      distanceMiles: 3.2,
      durationSeconds: 1902,
      effort: "great",
      notes: "Felt good",
    });
  });

  it("clears a field error as soon as that field is edited", async () => {
    const user = userEvent.setup();
    render(
      <CompleteRunSheet
        isOpen
        workout={workout}
        today={TODAY}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Save Run" }));
    expect(screen.getByText("Enter your duration.")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Duration/), "3");
    expect(screen.queryByText("Enter your duration.")).not.toBeInTheDocument();
    expect(screen.getByText("Enter your distance.")).toBeInTheDocument();
  });

  it("prefills the existing log when editing a run", () => {
    render(
      <CompleteRunSheet
        isOpen
        workout={workout}
        today={TODAY}
        runLog={runLog}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Edit Run" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Date/)).toHaveValue("2026-08-04");
    expect(screen.getByLabelText(/Distance/)).toHaveValue("2.1");
    expect(screen.getByLabelText(/Duration/)).toHaveValue("20:30");
    expect(screen.getByRole("button", { name: "Solid" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText(/Notes/)).toHaveValue("Legs felt heavy");
  });

  it("dates a scheduled run by its workout and an extra run by today", () => {
    const { unmount } = render(
      <CompleteRunSheet
        isOpen
        workout={workout}
        today={TODAY}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/Date/)).toHaveValue(workout.date);
    expect(screen.getByRole("radio", { name: "Easy" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    unmount();

    render(
      <CompleteRunSheet
        isOpen
        workout={null}
        today={TODAY}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading", { name: "Log Run" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Date/)).toHaveValue(TODAY);
    expect(screen.getByRole("radio", { name: "Easy" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("saves an extra run with its own date and activity type", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <CompleteRunSheet
        isOpen
        workout={null}
        today={TODAY}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    await user.clear(screen.getByLabelText(/Date/));
    await user.type(screen.getByLabelText(/Date/), "2026-08-05");
    await user.click(screen.getByRole("radio", { name: "Intervals" }));
    await user.type(screen.getByLabelText(/Distance/), "5");
    await user.type(screen.getByLabelText(/Duration/), "4000");
    await user.click(screen.getByRole("button", { name: "Solid" }));
    await user.click(screen.getByRole("button", { name: "Save Run" }));

    expect(onSave).toHaveBeenCalledWith(null, {
      completedDate: "2026-08-05",
      activityType: "intervals",
      distanceMiles: 5,
      durationSeconds: 2400,
      effort: "solid",
      notes: "",
    });
  });

  it("supports arrow-key activity selection and keeps one selected option", async () => {
    const user = userEvent.setup();
    render(
      <CompleteRunSheet
        isOpen
        workout={null}
        today={TODAY}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    const easy = screen.getByRole("radio", { name: "Easy" });
    easy.focus();
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("radio", { name: "Intervals" })).toHaveFocus();
    expect(screen.getByRole("radio", { name: "Intervals" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    expect(screen.queryByRole("combobox", { name: "Activity" })).not.toBeInTheDocument();
  });

  it("refuses a run dated after today", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <CompleteRunSheet
        isOpen
        workout={null}
        today={TODAY}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    await user.clear(screen.getByLabelText(/Date/));
    await user.type(screen.getByLabelText(/Date/), "2026-08-09");
    await user.type(screen.getByLabelText(/Distance/), "3");
    await user.type(screen.getByLabelText(/Duration/), "3000");
    await user.click(screen.getByRole("button", { name: "Solid" }));
    await user.click(screen.getByRole("button", { name: "Save Run" }));

    expect(
      screen.getByText("A run cannot be logged in the future."),
    ).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("confirms before discarding an edited entry", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <CompleteRunSheet
        isOpen
        workout={workout}
        today={TODAY}
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
        today={TODAY}
        onClose={onClose}
        onSave={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(confirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
