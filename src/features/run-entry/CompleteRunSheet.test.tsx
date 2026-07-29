import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { loadSeedPlan } from "../../seed/loadSeedPlan";
import { CompleteRunSheet } from "./CompleteRunSheet";

const workout = loadSeedPlan().weeks[0].workouts.find((item) => item.type !== "rest")!;
describe("CompleteRunSheet", () => {
  it("validates required fields then saves a valid entry", async () => {
    const user = userEvent.setup(); const onSave = vi.fn();
    render(<CompleteRunSheet isOpen workout={workout} onClose={vi.fn()} onSave={onSave} />);
    await user.click(screen.getByRole("button", { name: "Save Run" }));
    expect(screen.getByText("Enter your distance.")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Distance/), "3.2");
    await user.type(screen.getByLabelText("Duration"), "31:42");
    await user.click(screen.getByRole("button", { name: "Great" }));
    await user.type(screen.getByLabelText(/Notes/), "Felt good");
    expect(screen.getByText("9/120")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save Run" }));
    expect(onSave).toHaveBeenCalledWith(workout, expect.objectContaining({ distanceMiles: 3.2, durationSeconds: 1902, effort: "great" }));
  });
});
