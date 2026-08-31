import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CrewRunDetailSheet } from "./CrewRunDetailSheet.js";
import type { CrewSharedRun } from "../../crew/types.js";

function sharedRun(overrides: Partial<CrewSharedRun> = {}): CrewSharedRun {
  return {
    id: "run-1",
    localRunId: "local-run-1",
    userId: "runner-2",
    displayName: "Runner 2",
    accentColor: null,
    runnerIcon: { head: 0, face: 0, body: 0, flair: 0, background: 0 },
    localDate: "2026-08-10",
    activityType: "easy",
    distanceMiles: 4,
    durationSeconds: 2400,
    createdAt: "2026-08-10T12:00:00Z",
    updatedAt: "2026-08-10T12:00:00Z",
    buildRow: 0,
    buildColumnStart: 1,
    crewBuildRow: null,
    crewBuildColumnStart: null,
    crewBuildRotated: false,
    crewBuildPlacedAt: null,
    propsCount: 0,
    viewerHasPropped: false,
    ...overrides,
  };
}

function renderSheet(run: CrewSharedRun) {
  render(
    <CrewRunDetailSheet
      run={run}
      isOpen
      onClose={vi.fn()}
      currentUserId="runner-1"
      propsPending={false}
      propsError={null}
      propsAvailable
      onToggleProps={vi.fn()}
    />,
  );
}

describe("CrewRunDetailSheet heart rate", () => {
  it("shows an imported average and max heart rate", () => {
    renderSheet(sharedRun({ averageHeartRate: 148, maxHeartRate: 171 }));
    expect(screen.getByText("148 BPM")).toBeInTheDocument();
    expect(screen.getByText("171 BPM")).toBeInTheDocument();
    expect(screen.getAllByText("Avg HR")).toHaveLength(1);
    expect(screen.getByText("Max HR")).toBeInTheDocument();
  });

  it("falls back to a manually entered heart rate only when no imported average exists", () => {
    renderSheet(sharedRun({ averageHeartRate: null, manualHeartRate: 152 }));
    expect(screen.getByText("152 BPM")).toBeInTheDocument();
    expect(screen.getAllByText("Avg HR")).toHaveLength(1);
  });

  it("never shows the manual fallback alongside a real imported average", () => {
    renderSheet(sharedRun({ averageHeartRate: 148, manualHeartRate: 152 }));
    expect(screen.getByText("148 BPM")).toBeInTheDocument();
    expect(screen.queryByText("152 BPM")).not.toBeInTheDocument();
    expect(screen.getAllByText("Avg HR")).toHaveLength(1);
  });

  it("renders no heart rate section at all when none is present", () => {
    renderSheet(sharedRun({ averageHeartRate: null, maxHeartRate: null, manualHeartRate: null }));
    expect(screen.queryByText("Avg HR")).not.toBeInTheDocument();
    expect(screen.queryByText("Max HR")).not.toBeInTheDocument();
  });
});
