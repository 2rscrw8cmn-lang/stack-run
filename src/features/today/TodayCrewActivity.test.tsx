import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CrewDashboardData, CrewSharedRun } from "../../crew/types.js";
import type { RaceCrewController } from "../../crew/useRaceCrew.js";
import { TodayCrewActivity } from "./TodayCrewActivity.js";

function run(
  id: string,
  userId: string,
  localDate: string,
  overrides: Partial<CrewSharedRun> = {},
): CrewSharedRun {
  return {
    id,
    localRunId: `local-${id}`,
    userId,
    displayName: userId === "zack" ? "Zack" : "Drew",
    accentColor: null,
    runnerIcon: { head: 0, face: 0, body: 0, flair: 0, background: 0 },
    localDate,
    activityType: "easy",
    distanceMiles: 3.2,
    durationSeconds: 1800,
    createdAt: `${localDate}T12:00:00Z`,
    updatedAt: `${localDate}T12:00:00Z`,
    buildRow: null,
    buildColumnStart: null,
    crewBuildRow: null,
    crewBuildColumnStart: null,
    crewBuildPlacedAt: null,
    propsCount: 0,
    viewerHasPropped: false,
    ...overrides,
  };
}

function controller(runs: CrewSharedRun[], toggleProps = vi.fn(async () => undefined)) {
  const dashboard: CrewDashboardData = {
    members: [],
    summaries: [],
    runs,
    miniBuildRuns: [],
    crewBuildRuns: [],
    sharedRunsAvailable: true,
    sharedRunsTruncated: false,
    propsAvailable: true,
    propNotifications: [],
    loadedAt: "2026-08-12T12:00:00Z",
  };
  return {
    status: "signed-in",
    account: {
      profile: { id: "zack", displayName: "Zack" },
      crew: { id: "crew-1" },
    },
    crewData: dashboard,
    propsPendingRunIds: [],
    propsErrors: {},
    refreshCrewData: vi.fn(async () => undefined),
    toggleProps,
  } as unknown as RaceCrewController;
}

describe("Today Crew Activity", () => {
  it("shows at most two recent teammate runs and reuses the Crew Props action", async () => {
    const toggleProps = vi.fn(async () => undefined);
    const crew = controller([
      run("self", "zack", "2026-08-12"),
      run("today", "drew", "2026-08-12", { propsCount: 2 }),
      run("yesterday", "drew", "2026-08-11"),
      run("old", "drew", "2026-08-09"),
    ], toggleProps);
    const user = userEvent.setup();
    render(<TodayCrewActivity crew={crew} today="2026-08-12" onViewCrew={vi.fn()} />);

    const activity = screen.getByRole("heading", { name: "Crew Activity" }).closest("section")!;
    expect(within(activity).getAllByRole("listitem")).toHaveLength(2);
    expect(within(activity).queryByText("Zack")).not.toBeInTheDocument();
    expect(within(activity).queryByText(/Aug 9/)).not.toBeInTheDocument();

    await user.click(within(activity).getAllByRole("button", { name: "Give Props to Drew" })[0]);
    expect(toggleProps).toHaveBeenCalledWith("today");
  });

  it("renders no empty Crew section when no teammate run qualifies", () => {
    render(
      <TodayCrewActivity
        crew={controller([run("self", "zack", "2026-08-12")])}
        today="2026-08-12"
        onViewCrew={vi.fn()}
      />,
    );
    expect(screen.queryByRole("heading", { name: "Crew Activity" })).not.toBeInTheDocument();
  });
});
