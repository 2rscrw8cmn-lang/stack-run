import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SourceDetailReaderProvider } from "../connected/sourceDetail";
import type { RunLog } from "../domain/types";
import { unifiedRunnerHistory, type RunnerRun } from "../history/runnerRun";
import { HistoricalRunSheet } from "../features/runs/HistoricalRunSheet";
import { RunResultDetail } from "../features/workout-detail/RunResultDetail";
import { createQaRunnerAppState, qaRunnerHistoricalActivities } from "./qaRunner";
import {
  QA_AGGREGATE_ONLY_ACTIVITY_ID,
  QA_HISTORICAL_AGGREGATE_ACTIVITY_ID,
  QA_HISTORICAL_RICH_ACTIVITY_ID,
  QA_RICH_PROFILE_ACTIVITY_ID,
  qaSourceDetailReaderFor,
} from "./qaSourceDetail";

/**
 * The review R3A exists to make possible: both Run Detail states, rendered by
 * the production components, from the QA Runner's own fixture, with no
 * credential and no network.
 *
 * Everything below goes through `RunResultDetail` and `HistoricalRunSheet`
 * themselves. If these pass while the real screens are broken, the fixture is
 * lying — which is precisely the failure the previous QA gap produced.
 */

const TODAY = "2026-08-16";

function qaRunLog(activityId: string): RunLog {
  const run = createQaRunnerAppState(TODAY).runLogs.find(
    (candidate) => candidate.externalSource?.activityId === activityId,
  );
  if (!run) throw new Error(`No QA run log for ${activityId}`);
  return run;
}

function qaHistoricalRun(activityId: string): RunnerRun {
  const state = createQaRunnerAppState(TODAY);
  const run = unifiedRunnerHistory({
    activities: qaRunnerHistoricalActivities(TODAY),
    runLogs: state.runLogs,
    blockPlacements: state.blockPlacements,
  }).find((candidate) => candidate.externalActivityId === activityId);
  if (!run) throw new Error(`No QA history row for ${activityId}`);
  return run;
}

function renderInQa(children: React.ReactNode) {
  return render(
    <SourceDetailReaderProvider value={qaSourceDetailReaderFor}>
      {children}
    </SourceDetailReaderProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe("QA rich-profile run", () => {
  it("renders the real Run Profile, every recognized metric, and no network request", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    renderInQa(<RunResultDetail run={qaRunLog(QA_RICH_PROFILE_ACTIVITY_ID)} />);

    expect(await screen.findByText("Run Profile")).toBeInTheDocument();
    expect(
      within(screen.getByRole("group", { name: "Run Profile metric" }))
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Pace", "Heart Rate", "Elevation", "Cadence"]);
    expect(document.querySelector(".run-profile-chart")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the result dominant and the source's own aggregates stated", async () => {
    renderInQa(<RunResultDetail run={qaRunLog(QA_RICH_PROFILE_ACTIVITY_ID)} />);
    await screen.findByText("Run Profile");

    // 5.2 mi in 49:40 is 9:33 /mi. The synthetic velocity samples average
    // around that but are not what is stated.
    expect(screen.getByText("5.2 mi")).toBeInTheDocument();
    // Twice: the moving time, and the end of the profile's own elapsed axis.
    expect(screen.getAllByText("49:40")).toHaveLength(2);
    expect(screen.getAllByText("9:33 /MI").length).toBeGreaterThan(0);

    // Cadence has a stream, so it belongs to the profile and leaves the grid.
    const grid = screen.getByLabelText("Imported run metrics");
    expect([...grid.querySelectorAll("dt")].map((label) => label.textContent))
      .toEqual(["Avg HR", "Max HR", "Gain", "Load"]);
    // 214 ft is the source's own climbing total; the synthetic altitude series
    // spans about 51–154 ft, so a recomputed gain could not produce it.
    expect(within(grid).getByText("214 ft")).toBeInTheDocument();
  });

  it("breaks each line where the synthetic stream stopped recording", async () => {
    renderInQa(<RunResultDetail run={qaRunLog(QA_RICH_PROFILE_ACTIVITY_ID)} />);
    await screen.findByText("Run Profile");

    // Pace: the position dropout. Heart rate: the strap dropout. Both must be
    // gaps in the drawn line rather than a straight join across them.
    expect(document.querySelectorAll(".run-profile-chart polyline.chart__line").length)
      .toBeGreaterThan(1);

    await userEvent.click(screen.getByRole("button", { name: "Heart Rate" }));
    expect(document.querySelectorAll(".run-profile-chart polyline.chart__line").length)
      .toBeGreaterThan(1);
  });

  it("states synthetic cadence verbatim, exactly as the verified convention requires", async () => {
    renderInQa(<RunResultDetail run={qaRunLog(QA_RICH_PROFILE_ACTIVITY_ID)} />);
    await screen.findByText("Run Profile");
    await userEvent.click(screen.getByRole("button", { name: "Cadence" }));

    const facts = document.querySelector(".run-profile-chart__facts")!;
    expect(facts).toHaveTextContent("79");
    expect(facts).not.toHaveTextContent("158");
  });

  it("shows the structured source groups and the zone composition too", async () => {
    renderInQa(<RunResultDetail run={qaRunLog(QA_RICH_PROFILE_ACTIVITY_ID)} />);

    const intervals = await screen.findByRole("list", { name: "Structured workout intervals" });
    expect(within(intervals).getByText("Warm Up")).toBeInTheDocument();
    expect(within(intervals).getByText("Rep 1")).toBeInTheDocument();
    expect(screen.getByText("Heart rate zones")).toBeInTheDocument();
  });
});

describe("QA aggregate-only run", () => {
  it("omits the Run Profile entirely rather than showing an empty frame", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    renderInQa(<RunResultDetail run={qaRunLog(QA_AGGREGATE_ONLY_ACTIVITY_ID)} />);

    // Wait for the reads to settle before claiming nothing appeared.
    expect(await screen.findByText("Heart rate zones")).toBeInTheDocument();
    expect(screen.queryByText("Run Profile")).not.toBeInTheDocument();
    expect(document.querySelector(".run-profile-chart")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Run Profile metric" })).not.toBeInTheDocument();
    // A missing profile is not an error, and nothing was asked of the network.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still feels complete: the result, every stated aggregate, and cadence in the grid", async () => {
    renderInQa(<RunResultDetail run={qaRunLog(QA_AGGREGATE_ONLY_ACTIVITY_ID)} />);
    await screen.findByText("Heart rate zones");

    expect(screen.getByText("4.1 mi")).toBeInTheDocument();
    expect(screen.getByText("40:40")).toBeInTheDocument();
    expect(screen.getByText("9:55 /MI")).toBeInTheDocument();
    // No stream to carry it, so the verified cadence joins the summary grid.
    const grid = screen.getByLabelText("Imported run metrics");
    expect([...grid.querySelectorAll("dt")].map((label) => label.textContent))
      .toEqual(["Avg HR", "Max HR", "Gain", "Load", "Cadence"]);
    expect(within(grid).getByText("80")).toBeInTheDocument();
  });
});

describe("QA historical-only runs", () => {
  it("reaches the same shared Run Profile without gaining a single STACK fact", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    renderInQa(
      <HistoricalRunSheet
        run={qaHistoricalRun(QA_HISTORICAL_RICH_ACTIVITY_ID)}
        isOpen
        onClose={() => undefined}
      />,
    );

    expect(await screen.findByText("Run Profile")).toBeInTheDocument();
    const sheet = within(screen.getByRole("dialog"));
    expect(sheet.getByText("History")).toBeInTheDocument();
    expect(sheet.getByText("7.4 mi")).toBeInTheDocument();
    expect(sheet.getByText("Heart rate zones")).toBeInTheDocument();

    expect(sheet.queryByText(/Effort/)).not.toBeInTheDocument();
    expect(sheet.queryByRole("button", { name: /edit|connect to plan|import|accept/i }))
      .not.toBeInTheDocument();
    // An unstructured long run has no named groups, and none are invented.
    expect(sheet.queryByRole("list", { name: "Structured workout intervals" }))
      .not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the data-poor historical run honestly: three facts and no filler", async () => {
    renderInQa(
      <HistoricalRunSheet
        run={qaHistoricalRun(QA_HISTORICAL_AGGREGATE_ACTIVITY_ID)}
        isOpen
        onClose={() => undefined}
      />,
    );

    const sheet = within(screen.getByRole("dialog"));
    expect(sheet.getByText("3.4 mi")).toBeInTheDocument();
    expect(sheet.getByText("34:37")).toBeInTheDocument();
    expect(sheet.getByText("10:11 /MI")).toBeInTheDocument();

    await vi.waitFor(() =>
      expect(sheet.queryByLabelText("Imported run metrics")).not.toBeInTheDocument());
    expect(sheet.queryByText("Run Profile")).not.toBeInTheDocument();
    expect(sheet.queryByText("Heart rate zones")).not.toBeInTheDocument();
    expect(sheet.queryByText(/0 bpm|0 ft/)).not.toBeInTheDocument();
    expect(sheet.queryByRole("alert")).not.toBeInTheDocument();
  });
});
