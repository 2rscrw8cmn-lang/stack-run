import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SourceDetailReaderProvider } from "../connected/sourceDetail.js";
import type { RunLog } from "../domain/types.js";
import { unifiedRunnerHistory, type RunnerRun } from "../history/runnerRun.js";
import { HistoricalRunSheet } from "../features/runs/HistoricalRunSheet.js";
import { RunResultDetail } from "../features/workout-detail/RunResultDetail.js";
import { createQaRunnerAppState, qaRunnerHistoricalActivities } from "./qaRunner.js";
import {
  QA_AGGREGATE_ONLY_ACTIVITY_ID,
  QA_HISTORICAL_AGGREGATE_ACTIVITY_ID,
  QA_HISTORICAL_RICH_ACTIVITY_ID,
  QA_RICH_PROFILE_ACTIVITY_ID,
  qaSourceDetailReaderFor,
} from "./qaSourceDetail.js";

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

    expect(await screen.findByText("Analysis")).toBeInTheDocument();
    expect(
      within(screen.getByRole("group", { name: "Run Profile metric" }))
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Pace", "Heart Rate", "Elevation", "Cadence"]);
    expect(document.querySelector(".activity-chart")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the result dominant and the source's own aggregates stated", async () => {
    renderInQa(<RunResultDetail run={qaRunLog(QA_RICH_PROFILE_ACTIVITY_ID)} />);
    await screen.findByText("Analysis");

    // 5.2 mi in 49:40 is 9:33 /mi. The synthetic velocity samples average
    // around that but are not what is stated.
    const hero = screen.getByLabelText("Primary activity results");
    expect(hero).toHaveTextContent("5.2 mi");
    // Twice: the moving time, and the end of the chart's own elapsed axis.
    expect(screen.getAllByText("49:40")).toHaveLength(2);
    expect(screen.getAllByText("9:33 /MI").length).toBeGreaterThan(0);

    // Max HR has a chart to support, so it leaves the strip for the heart-rate
    // analysis; the rest of the source's aggregates stay as compact facts.
    const grid = screen.getByLabelText("Imported run metrics");
    expect([...grid.querySelectorAll("dt")].map((label) => label.textContent))
      .toEqual(["Avg HR", "Gain", "Cadence", "Load"]);
    // 214 ft is the source's own climbing total; the synthetic altitude series
    // spans about 51–154 ft, so a recomputed gain could not produce it.
    expect(within(grid).getByText("214 ft")).toBeInTheDocument();
  });

  it("breaks each line where the synthetic stream stopped recording", async () => {
    renderInQa(<RunResultDetail run={qaRunLog(QA_RICH_PROFILE_ACTIVITY_ID)} />);
    await screen.findByText("Analysis");

    // Pace: the position dropout. Heart rate: the strap dropout. Both must be
    // gaps in the drawn line rather than a straight join across them.
    expect(document.querySelectorAll(".activity-chart path.activity-chart__line").length)
      .toBeGreaterThan(1);

    await userEvent.click(screen.getByRole("button", { name: "Heart Rate" }));
    expect(document.querySelectorAll(".activity-chart path.activity-chart__line").length)
      .toBeGreaterThan(1);
  });

  it("states synthetic cadence verbatim, exactly as the verified convention requires", async () => {
    renderInQa(<RunResultDetail run={qaRunLog(QA_RICH_PROFILE_ACTIVITY_ID)} />);
    await screen.findByText("Analysis");
    await userEvent.click(screen.getByRole("button", { name: "Cadence" }));

    const facts = document.querySelector(".run-analysis__facts")!;
    expect(facts).toHaveTextContent("79");
    expect(facts).not.toHaveTextContent("158");
  });

  it("shows the structured source groups and the zone composition too", async () => {
    renderInQa(<RunResultDetail run={qaRunLog(QA_RICH_PROFILE_ACTIVITY_ID)} />);

    const intervals = await screen.findByRole("list", { name: "Structured workout intervals" });
    expect(within(intervals).getByText("Warm Up")).toBeInTheDocument();
    expect(within(intervals).getByText("Rep 1")).toBeInTheDocument();
    // Zones are readable while Pace is the metric under investigation, in the
    // heart-rate summary; selecting Heart Rate moves them onto its chart.
    expect(screen.getByRole("list", { name: "Heart rate zone distribution" }).closest(".run-summary"))
      .not.toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Heart Rate" }));
    expect(screen.getByRole("list", { name: "Heart rate zone distribution" }).closest(".run-analysis"))
      .not.toBeNull();
  });
});

describe("QA aggregate-only run", () => {
  it("omits Analysis entirely rather than showing an empty frame", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    renderInQa(<RunResultDetail run={qaRunLog(QA_AGGREGATE_ONLY_ACTIVITY_ID)} />);

    // Wait for the reads to settle before claiming nothing appeared.
    expect(await screen.findByRole("region", { name: "Heart Rate" })).toBeInTheDocument();
    expect(screen.queryByText("Analysis")).not.toBeInTheDocument();
    expect(document.querySelector(".activity-chart")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Run Profile metric" })).not.toBeInTheDocument();
    // A missing profile is not an error, and nothing was asked of the network.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still feels complete: the result, every stated aggregate, and cadence in the grid", async () => {
    renderInQa(<RunResultDetail run={qaRunLog(QA_AGGREGATE_ONLY_ACTIVITY_ID)} />);
    await screen.findByRole("region", { name: "Heart Rate" });

    const hero = screen.getByLabelText("Primary activity results");
    expect(hero).toHaveTextContent("4.1 mi");
    expect(hero).toHaveTextContent("40:40");
    expect(hero).toHaveTextContent("9:55 /MI");
    // The strip is the same four facts whatever the run has; max HR is a
    // heart-rate fact and belongs to that module.
    const grid = screen.getByLabelText("Imported run metrics");
    expect([...grid.querySelectorAll("dt")].map((label) => label.textContent))
      .toEqual(["Avg HR", "Gain", "Cadence", "Load"]);
    expect(screen.getByRole("region", { name: "Heart Rate" })).toHaveTextContent("158");
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

    expect(await screen.findByText("Analysis")).toBeInTheDocument();
    const sheet = within(screen.getByRole("dialog"));
    expect(sheet.getByText("History")).toBeInTheDocument();
    expect(screen.getByLabelText("Primary activity results")).toHaveTextContent("7.4 mi");
    expect(sheet.getByRole("list", { name: "Heart rate zone distribution" })).toBeInTheDocument();

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
    const hero = screen.getByLabelText("Primary activity results");
    expect(hero).toHaveTextContent("3.4 mi");
    expect(hero).toHaveTextContent("34:37");
    expect(hero).toHaveTextContent("10:11 /MI");

    await vi.waitFor(() =>
      expect(sheet.queryByLabelText("Imported run metrics")).not.toBeInTheDocument());
    expect(sheet.queryByText("Analysis")).not.toBeInTheDocument();
    expect(sheet.queryByRole("region", { name: "Heart Rate" })).not.toBeInTheDocument();
    expect(sheet.queryByText(/0 bpm|0 ft/)).not.toBeInTheDocument();
    expect(sheet.queryByRole("alert")).not.toBeInTheDocument();
  });
});
