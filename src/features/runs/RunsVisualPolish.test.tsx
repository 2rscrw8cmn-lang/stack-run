import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { addDaysToLocalDate } from "../../domain/dates";
import type { RunLog } from "../../domain/types";
import type { HistoricalActivity } from "../../history/historicalActivity";
import { historicalRun, stackRun } from "../../history/runnerFixtures";
import { unifiedRunnerHistory } from "../../history/runnerRun";
import { runnerSnapshot } from "../../history/runnerSnapshot";
import { loadSeedPlan } from "../../seed/loadSeedPlan";
import { presentableRunnerSignals } from "../../signals/runnerSignals";
import { RunsScreen } from "./RunsScreen";

/**
 * The Runs visual pass.
 *
 * This pass changed hierarchy, rhythm and geometry and was not allowed to
 * change a single fact. These tests are written from that boundary: every one
 * either pins a piece of information that has to survive a recomposition, or
 * pins the recomposition itself where it is a product decision rather than
 * taste. Nothing here asserts a colour or a pixel — `runsInstrumentStyling`
 * covers the stylesheet decisions, and the domain suites still own the
 * arithmetic.
 */

const plan = loadSeedPlan();
const TODAY = "2026-08-15";

function renderRuns(
  {
    runLogs = [],
    activities = [],
    ...props
  }: {
    runLogs?: RunLog[];
    activities?: HistoricalActivity[];
  } & Partial<Parameters<typeof RunsScreen>[0]> = {},
) {
  return render(
    <RunsScreen
      plan={plan}
      runLogs={runLogs}
      runnerRuns={unifiedRunnerHistory({ activities, runLogs })}
      today={TODAY}
      {...props}
    />,
  );
}

function rows() {
  return screen
    .getAllByRole("button")
    .filter((button) => button.className.includes("run-row"));
}

/** Enough 28-day-versus-28-day history for the signal domain to speak. */
function comparableHistory(): HistoricalActivity[] {
  const spread = (prefix: string, startDate: string, miles: number) =>
    Array.from({ length: 8 }, (_, index) =>
      historicalRun(`${prefix}-${index}`, addDaysToLocalDate(startDate, Math.round((index * 27) / 8)), {
        miles,
      }),
    );
  return [
    ...spread("cur", "2026-07-19", 3.1),
    ...spread("base", "2026-06-21", 2),
    historicalRun("anchor", "2026-06-20", { miles: 3 }),
  ];
}

describe("Runs lead", () => {
  const runLogs = [
    stackRun("a", "2026-08-14", { distanceMiles: 4 }),
    stackRun("b", "2026-08-01", { distanceMiles: 10 }),
  ];

  it("still states all four readings and all four windows", () => {
    renderRuns({ runLogs });

    for (const label of ["Last 28 days", "Last 7 days", "Last 8 wks", "Longest 28d"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    const snapshot = screen.getByRole("button", { name: /^Runner snapshot\./ });
    for (const spoken of [
      "14 miles over the last 28 days",
      "4 miles over the last 7 days",
      "0.3 runs per week over the last 8 weeks",
      "Longest run of the last 28 days, 10 miles",
    ]) {
      expect(snapshot).toHaveAccessibleName(expect.stringContaining(spoken));
    }
  });

  it("gives exactly one reading the lead, and leaves the other three peers", () => {
    renderRuns({ runLogs });

    const readings = [...document.querySelectorAll<HTMLElement>(".runner-snapshot__reading")];
    expect(readings).toHaveLength(4);
    const lead = readings.filter((reading) => reading.dataset.lead === "true");
    expect(lead).toHaveLength(1);
    expect(lead[0].dataset.reading).toBe("last-28");
    // The lead is a reading the snapshot already produced, not a new figure.
    expect(lead[0]).toHaveTextContent("14");
    expect(lead[0]).toHaveTextContent("Last 28 days");
  });

  it("keeps the whole lead one target into the runner profile", async () => {
    const user = userEvent.setup();
    renderRuns({ runLogs });

    // Four readings with four hit areas would be four ways to the same place.
    expect(document.querySelectorAll(".runner-snapshot button")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: /^Runner snapshot\./ }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Your Running");
  });

  it("still leaves an unknown reading unknown rather than drawing a zero", () => {
    renderRuns({ runLogs: [stackRun("old", "2026-01-05", { distanceMiles: 8 })] });

    const snapshot = screen.getByRole("button", { name: /^Runner snapshot\./ });
    expect(snapshot).toHaveAccessibleName(
      expect.stringContaining("No longest run in the last 28 days"),
    );
    expect(snapshot).toHaveAccessibleName(expect.stringContaining("0 miles over the last 7 days"));
    expect(
      document.querySelector('[data-reading="longest"] .runner-snapshot__value'),
    ).toHaveTextContent("—");
  });

  it("keeps the history range and the sync state as the block's last line", () => {
    renderRuns({
      activities: [historicalRun("a-1", "2026-02-04")],
      runLogs,
      historyPhase: "partial",
    });

    const range = document.querySelector(".runner-snapshot__range");
    expect(range).toHaveTextContent("Since Feb 2026");
    expect(range).toHaveTextContent("Some history could not be loaded");
  });

  it("keeps Log Run available beside the lead, and unchanged", async () => {
    const onSaveRun = vi.fn();
    const user = userEvent.setup();
    renderRuns({ runLogs, onSaveRun });

    await user.click(screen.getByRole("button", { name: "Log Run" }));
    expect(screen.getByRole("heading", { name: "Log Run" })).toBeInTheDocument();
  });
});

describe("Recent Volume", () => {
  const runLogs = [
    stackRun("a", "2026-08-11", { distanceMiles: 7 }),
    stackRun("b", "2026-08-04", { distanceMiles: 5 }),
  ];

  it("reads out the selected week's miles, dates and run count", () => {
    renderRuns({ runLogs });

    const volume = document.querySelector(".runner-volume");
    expect(volume).toHaveTextContent("7");
    expect(volume).toHaveTextContent(/Aug 10 – Aug 16/);
    expect(volume).toHaveTextContent(/1 run/);
    // The current week is still marked as incomplete rather than as a low week.
    expect(volume).toHaveTextContent(/so far/);
  });

  it("still selects a week from the chart, and moves the readout with it", async () => {
    const user = userEvent.setup();
    renderRuns({ runLogs });

    await user.click(
      screen.getByRole("button", { name: /^Week of August 3, 5 miles, 1 run$/ }),
    );

    const volume = document.querySelector(".runner-volume");
    expect(volume).toHaveTextContent("5");
    expect(volume).toHaveTextContent(/Aug 3 – Aug 9/);
    expect(volume).not.toHaveTextContent(/so far/);
  });

  it("draws actual miles only, with no key for a series that is not there", () => {
    renderRuns({ runLogs });

    expect(document.querySelector(".plan-actual-chart__planned")).toBeNull();
    expect(document.querySelector(".plan-actual-chart__key")).toBeNull();
  });
});

describe("Run History rhythm", () => {
  it("groups by month without changing which runs are listed or their order", () => {
    renderRuns({
      runLogs: [
        stackRun("aug-late", "2026-08-14"),
        stackRun("aug-early", "2026-08-02"),
        stackRun("jul", "2026-07-28"),
      ],
    });

    expect(
      [...document.querySelectorAll(".run-month__label")].map((label) => label.textContent),
    ).toEqual(["August", "July"]);
    expect(rows().map((row) => row.getAttribute("aria-label"))).toEqual([
      expect.stringContaining("Friday, August 14"),
      expect.stringContaining("Sunday, August 2"),
      expect.stringContaining("Tuesday, July 28"),
    ]);
  });

  it("keeps every fact a row carried, with distance leading", () => {
    renderRuns({
      runLogs: [
        stackRun("scheduled", "2026-08-11", {
          workoutId: "workout-002",
          activityType: "long",
          distanceMiles: 6.2,
          durationSeconds: 3141,
        }),
      ],
    });

    const [row] = rows();
    expect(row).toHaveAccessibleName("Long Run. Tuesday, August 11. 6.2 mi, 52:21, 8:27 /MI");
    expect(within(row).getByText("Long Run")).toBeInTheDocument();
    expect(row.querySelector(".run-row__distance")).toHaveTextContent("6.2");
    expect(row.querySelector(".run-row__facts")).toHaveTextContent("52:21 · 8:27 /MI");
  });

  it("omits a measure the run does not have rather than printing a placeholder", () => {
    renderRuns({
      activities: [historicalRun("a-1", "2026-08-12", { miles: 5, durationSeconds: 3_000 })],
    });

    const [row] = rows();
    expect(row.querySelector(".run-row__distance")).toHaveTextContent("5");
    expect(row.querySelector(".run-row__facts")).toHaveTextContent("50:00 · 10:00 /MI");
    expect(row).not.toHaveTextContent("—");
  });

  it("still marks only an unscheduled run extra", () => {
    renderRuns({
      runLogs: [
        stackRun("extra", "2026-08-14"),
        stackRun("scheduled", "2026-08-11", { workoutId: "workout-002" }),
      ],
    });

    expect(within(rows()[0]).getByText("Extra")).toBeInTheDocument();
    expect(within(rows()[1]).queryByText("Extra")).not.toBeInTheDocument();
  });

  it("keeps a connected-history run a fact rather than an import chore", async () => {
    const user = userEvent.setup();
    renderRuns({
      activities: [historicalRun("a-1", "2026-08-12", { miles: 6.2, name: "Morning Run" })],
    });

    const [row] = rows();
    expect(row.dataset.origin).toBe("historical-activity");
    // The same measures, in the same places, as a run STACK owns.
    expect(row.querySelector(".run-row__distance")).toHaveTextContent("6.2");
    expect(screen.queryByRole("button", { name: /import/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /accept/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/review/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/unreviewed/i)).not.toBeInTheDocument();

    await user.click(row);
    const sheet = within(screen.getByRole("dialog"));
    expect(sheet.getByText("History")).toBeInTheDocument();
    expect(sheet.queryByRole("button", { name: "Edit Run" })).not.toBeInTheDocument();
  });

  it("still opens the STACK Run Detail for a run STACK owns", async () => {
    const user = userEvent.setup();
    renderRuns({ runLogs: [stackRun("a", "2026-08-11", { workoutId: "workout-002" })] });

    await user.click(rows()[0]);
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Run Detail");
  });

  it("carries no metric that belongs in the detail sheet", () => {
    renderRuns({
      activities: [
        historicalRun("a-1", "2026-08-12", {
          averageHeartRate: 148,
          elevationGainMeters: 210,
          averageCadence: 172,
          trainingLoad: 84,
        }),
      ],
    });

    const [row] = rows();
    expect(row).not.toHaveTextContent(/bpm/i);
    expect(row).not.toHaveTextContent(/ft/i);
    expect(row).not.toHaveTextContent(/spm/i);
    expect(row).not.toHaveTextContent(/load/i);
  });
});

describe("Training Signals on the polished screen", () => {
  it("renders the domain's signals in the domain's order", () => {
    const activities = comparableHistory();
    renderRuns({ activities });

    const expected = presentableRunnerSignals({
      runs: unifiedRunnerHistory({ activities, runLogs: [] }),
      today: TODAY,
      plan,
      runLogs: [],
    }).map((signal) => signal.id);

    expect(
      [...document.querySelectorAll<HTMLElement>(".signal-card")].map(
        (card) => card.dataset.signal,
      ),
    ).toEqual(expected);
    expect(expected.length).toBeGreaterThan(1);
  });

  it("keeps the shared comparison context, and the plan exception to it", () => {
    renderRuns({ activities: comparableHistory() });

    expect(screen.getByText("Last 28 days vs prior 28 days")).toBeInTheDocument();
    expect(document.querySelectorAll(".signal-card__window")).toHaveLength(1);
  });

  it("still opens the signal's own detail from the row", async () => {
    const user = userEvent.setup();
    renderRuns({ activities: comparableHistory() });

    await user.click(screen.getByRole("button", { name: /^Volume is building/ }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Volume");
  });

  it("stays below the history, in the same four zones", () => {
    renderRuns({ activities: comparableHistory() });

    expect(
      [...document.querySelectorAll(".section__title")].map((title) => title.textContent),
    ).toEqual(["Recent Volume", "Run History", "Training Signals"]);
  });
});

describe("Sparse and empty runners", () => {
  it("asks for nothing a new runner does not have", () => {
    renderRuns({});

    expect(screen.getByText("No runs yet")).toBeInTheDocument();
    expect(screen.getByText("Nothing recorded yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Runner snapshot/ })).not.toBeInTheDocument();
    expect(document.querySelectorAll(".run-month")).toHaveLength(0);
    expect(document.querySelector(".plan-actual-chart")).toBeNull();
  });

  it("composes the same way for a runner with one manual run", () => {
    renderRuns({ runLogs: [stackRun("only", "2026-08-14")] });

    expect(document.querySelectorAll(".runner-snapshot__reading")).toHaveLength(4);
    expect(document.querySelector('[data-lead="true"]')).toBeInTheDocument();
    expect(document.querySelectorAll(".run-month")).toHaveLength(1);
    expect(rows()).toHaveLength(1);
    // No empty decorative zone: the history signals cannot be computed from one
    // run and are absent rather than guessed at.
    expect(document.querySelectorAll(".signal-card[data-signal='volume-trend']")).toHaveLength(0);
  });
});

describe("The pass changed no fact", () => {
  const runLogs = [
    stackRun("a", "2026-08-14", { distanceMiles: 4 }),
    stackRun("b", "2026-08-10", { distanceMiles: 9, workoutId: "workout-002" }),
  ];
  const activities = comparableHistory();

  it("leaves the unified history, the snapshot and the weekly volume identical", () => {
    const before = unifiedRunnerHistory({ activities, runLogs });
    const snapshotBefore = runnerSnapshot(before, TODAY);

    renderRuns({ activities, runLogs });

    const after = unifiedRunnerHistory({ activities, runLogs });
    expect(after).toEqual(before);
    expect(runnerSnapshot(after, TODAY)).toEqual(snapshotBefore);
    // Every row the screen can reach is a row the history contains.
    expect(before).toHaveLength(activities.length + runLogs.length);
  });

  it("leaves the Training Signal set and order identical", () => {
    const runs = unifiedRunnerHistory({ activities, runLogs });
    const before = presentableRunnerSignals({ runs, today: TODAY, plan, runLogs });

    renderRuns({ activities, runLogs });

    expect(presentableRunnerSignals({ runs, today: TODAY, plan, runLogs })).toEqual(before);
  });

  it("does not write to the plan, the run logs or the history it renders", () => {
    const runs = unifiedRunnerHistory({ activities, runLogs });
    const planBefore = structuredClone(plan);
    const runLogsBefore = structuredClone(runLogs);
    const runsBefore = structuredClone(runs);

    renderRuns({ activities, runLogs, runnerRuns: runs });

    expect(plan).toEqual(planBefore);
    expect(runLogs).toEqual(runLogsBefore);
    expect(runs).toEqual(runsBefore);
  });
});
