import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { IntervalsCandidate } from "../../connected/intervals";
import { createInitialAppState } from "../../storage/migrations";
import { RunDataSheet } from "./RunDataSheet";

const state = createInitialAppState();
const firstRun = state.plan.weeks.flatMap((week) => week.workouts).find((workout) => workout.type !== "rest")!;

const candidate: IntervalsCandidate = {
  externalId: "i1",
  sourceType: "Run",
  completedDate: firstRun.date,
  distanceMiles: 3.11,
  durationSeconds: 1500,
  sourceUpdatedAt: null,
  metrics: { averageHeartRate: 152 },
};

function renderSheet(props: Partial<Parameters<typeof RunDataSheet>[0]> = {}) {
  const onImport = vi.fn();
  const onSettle = vi.fn();
  const onIgnore = vi.fn();
  const onSync = vi.fn();
  const user = userEvent.setup();
  render(
    <RunDataSheet
      isOpen
      onClose={vi.fn()}
      state={state}
      initialToken="token"
      candidates={[candidate]}
      isSyncing={false}
      syncError={null}
      onSync={onSync}
      onSettle={onSettle}
      onConnect={vi.fn()}
      onForget={vi.fn()}
      onImport={onImport}
      onAttach={vi.fn()}
      onIgnore={onIgnore}
      onClearIgnored={vi.fn()}
      {...props}
    />,
  );
  return { user, onImport, onSettle, onIgnore, onSync };
}

describe("RunDataSheet", () => {
  it("opens on the run Today handed it, already matched to its workout", () => {
    renderSheet({ initialReview: { candidate, asExtra: false } });

    expect(screen.getByText("Review synced run")).toBeInTheDocument();
    expect(screen.getByLabelText("Match")).toHaveValue(firstRun.id);
    expect(screen.getByRole("button", { name: "Confirm Match" })).toBeInTheDocument();
  });

  it("respects a run Today sent through as an extra", () => {
    renderSheet({ initialReview: { candidate, asExtra: true } });

    expect(screen.getByLabelText("Match")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Add as Extra Run" })).toBeInTheDocument();
  });

  it("imports the run and says what it earned", async () => {
    const { user, onImport, onSettle } = renderSheet({ initialReview: { candidate, asExtra: false } });

    await user.click(screen.getByRole("button", { name: "Confirm Match" }));

    expect(onImport).toHaveBeenCalledWith(candidate, firstRun.id, firstRun.type, "solid", "");
    // The candidate leaves the shared list, so Today stops offering it too.
    expect(onSettle).toHaveBeenCalledWith("i1");
    expect(screen.getByRole("status")).toHaveTextContent(/You earned/);
  });

  it("shows a sync failure where the user asked for the sync", () => {
    renderSheet({ syncError: "Intervals.icu could not be reached." });
    expect(screen.getByRole("alert")).toHaveTextContent("Intervals.icu could not be reached.");
  });

  it("says so plainly when a sync found nothing", () => {
    renderSheet({ candidates: [] });
    expect(screen.getByText("No runs are waiting to be reviewed.")).toBeInTheDocument();
  });
});
