import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { acceptedRun, historicalRun, stackRun } from "../../history/runnerFixtures";
import { unifiedRunnerHistory } from "../../history/runnerRun";
import { loadSeedPlan } from "../../seed/loadSeedPlan";
import type { RunLog } from "../../domain/types";
import {
  RECENT_EXPANDED_RUN_COUNT,
  RECENT_RUN_COUNT,
  RunsScreen,
} from "./RunsScreen";

/**
 * Runs, once it is a history of the runner rather than a log of the plan.
 *
 * The behaviours these cover are the ones the phase is actually for: a run
 * nobody reviewed still appears, an accepted run appears once, a snapshot states
 * its windows, and none of it turns a year of history into a review queue.
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
    activities?: Parameters<typeof unifiedRunnerHistory>[0]["activities"];
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

describe("Runs history", () => {
  it("shows a connected run the runner never reviewed, as history rather than a task", () => {
    renderRuns({
      activities: [historicalRun("a-1", "2026-08-12", { miles: 6.2, name: "Morning Run" })],
    });

    const [row] = rows();
    expect(row).toHaveAccessibleName(
      "Morning Run. Wednesday, August 12. 6.2 mi, 1:02:00, 10:00 /MI. Not logged in STACK",
    );
    // Nothing here asks the runner to do anything about it.
    expect(screen.queryByRole("button", { name: /import/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /accept/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/review/i)).not.toBeInTheDocument();
  });

  it("shows an accepted run once, under its STACK identity", () => {
    renderRuns({
      activities: [historicalRun("a-1", "2026-08-12", { miles: 6.2 })],
      runLogs: [
        acceptedRun("log-1", "2026-08-12", "a-1", { activityType: "long", distanceMiles: 6.2 }),
      ],
    });

    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveAccessibleName(expect.stringContaining("Long Run"));
    expect(screen.getByText("1 run")).toBeInTheDocument();
  });

  it("interleaves manual, extra and history rows in the recent chronology", () => {
    renderRuns({
      activities: [
        historicalRun("a-1", "2026-08-13", { name: "Evening Run" }),
        historicalRun("a-2", "2026-03-02", { name: "Old Run" }),
      ],
      runLogs: [
        stackRun("scheduled", "2026-08-11", { workoutId: "workout-002" }),
        stackRun("extra", "2026-08-14"),
      ],
    });

    expect(rows().map((row) => row.getAttribute("aria-label"))).toEqual([
      expect.stringContaining("Friday, August 14"),
      expect.stringContaining("Thursday, August 13"),
      expect.stringContaining("Tuesday, August 11"),
    ]);
    expect(within(rows()[0]).getByText("Extra")).toBeInTheDocument();
    expect(within(rows()[2]).queryByText("Extra")).not.toBeInTheDocument();
  });

  it("opens a factual, read-only detail for a run STACK does not own", async () => {
    const user = userEvent.setup();
    renderRuns({
      activities: [
        historicalRun("a-1", "2026-08-12", {
          miles: 6.2,
          name: "Morning Run",
          averageHeartRate: 148,
          maxHeartRate: 170,
        }),
      ],
    });

    await user.click(rows()[0]);

    const sheet = within(screen.getByRole("dialog"));
    expect(sheet.getByText("Wednesday, August 12, 2026")).toBeInTheDocument();
    expect(sheet.getByText("History")).toBeInTheDocument();
    expect(sheet.getByText("148 bpm")).toBeInTheDocument();
    expect(sheet.getByText(/not logged in STACK/i)).toBeInTheDocument();
    // No editing, no plan linking, no importing: nothing to decide here.
    expect(sheet.queryByRole("button", { name: "Edit Run" })).not.toBeInTheDocument();
    expect(sheet.queryByRole("button", { name: "Connect to Plan" })).not.toBeInTheDocument();
  });

  it("omits a metric the source never supplied rather than showing a zero", async () => {
    const user = userEvent.setup();
    renderRuns({
      activities: [historicalRun("a-1", "2026-08-12", { miles: 5, durationSeconds: 3_000 })],
    });

    await user.click(rows()[0]);

    const sheet = within(screen.getByRole("dialog"));
    expect(sheet.getByText("Distance")).toBeInTheDocument();
    expect(sheet.getByText("Duration")).toBeInTheDocument();
    // R3 shares one source-owned presentation with accepted runs, so the
    // label is the accepted run's "Avg pace" rather than a second wording.
    expect(sheet.getByText("Avg pace")).toBeInTheDocument();
    expect(sheet.queryByText("Avg HR")).not.toBeInTheDocument();
    expect(sheet.queryByText("Gain")).not.toBeInTheDocument();
    expect(sheet.queryByText(/0 bpm/)).not.toBeInTheDocument();
  });

  it("still opens the existing Run Detail for a STACK run", async () => {
    const user = userEvent.setup();
    renderRuns({
      activities: [historicalRun("a-1", "2026-08-12")],
      runLogs: [
        acceptedRun("log-1", "2026-08-12", "a-1", {
          workoutId: "workout-002",
          notes: "Legs good.",
        }),
      ],
    });

    await user.click(rows()[0]);

    const sheet = within(screen.getByRole("dialog"));
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Run Detail");
    expect(sheet.getByText("Plan")).toBeInTheDocument();
    expect(sheet.getByText("Legs good.")).toBeInTheDocument();
    expect(sheet.getByRole("button", { name: "Edit Run" })).toBeInTheDocument();
  });
});

describe("Runner snapshot", () => {
  it("states an explicit window beside every reading", () => {
    renderRuns({
      runLogs: [
        stackRun("a", "2026-08-14", { distanceMiles: 4 }),
        stackRun("b", "2026-08-01", { distanceMiles: 10 }),
      ],
    });

    expect(screen.getByRole("button", { name: /^Runner snapshot\./ })).toHaveAccessibleName(
      // Runs presents mileage at one decimal everywhere, summary and row alike.
      "Runner snapshot. 14.0 miles over the last 28 days. 4.0 miles over the last 7 days. 0.3 runs per week over the last 8 weeks. Longest run of the last 28 days, 10.0 miles. Open history detail.",
    );
    expect(screen.getByText("Last 7 days")).toBeInTheDocument();
    expect(screen.getByText("Last 28 days")).toBeInTheDocument();
    expect(screen.getByText("Last 8 wks")).toBeInTheDocument();
    expect(screen.getByText("Longest 28d")).toBeInTheDocument();
  });

  it("says how far back the history it is describing actually reaches", () => {
    renderRuns({
      activities: [historicalRun("a-1", "2026-02-04")],
      runLogs: [stackRun("a", "2026-08-14")],
    });

    expect(screen.getByText(/Since Feb 2026/)).toBeInTheDocument();
  });

  it("shows zero mileage but no invented longest run for an empty known window", () => {
    renderRuns({ runLogs: [stackRun("old", "2026-01-05", { distanceMiles: 8 })] });

    const snapshot = screen.getByRole("button", { name: /^Runner snapshot\./ });
    expect(snapshot).toHaveAccessibleName(expect.stringContaining("0 miles over the last 7 days"));
    expect(snapshot).toHaveAccessibleName(
      expect.stringContaining("No longest run in the last 28 days"),
    );
  });

  it("says nothing about connected history for a runner who has none", () => {
    renderRuns({ runLogs: [stackRun("a", "2026-08-14")], historyPhase: "no-connection" });

    expect(screen.queryByText(/History not loaded/)).not.toBeInTheDocument();
    expect(screen.queryByText(/could not be loaded/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Loading history/)).not.toBeInTheDocument();
  });

  it("says when connected history is loading, missing or incomplete", () => {
    const { rerender } = renderRuns({
      runLogs: [stackRun("a", "2026-08-14")],
      historyPhase: "syncing",
    });
    expect(screen.getByText(/Loading history…/)).toBeInTheDocument();

    const runLogs = [stackRun("a", "2026-08-14")];
    const runnerRuns = unifiedRunnerHistory({ runLogs });
    for (const [phase, text] of [
      ["never-synced", "History not loaded yet"],
      ["partial", "Some history could not be loaded"],
    ] as const) {
      rerender(
        <RunsScreen
          plan={plan}
          runLogs={runLogs}
          runnerRuns={runnerRuns}
          today={TODAY}
          historyPhase={phase}
        />,
      );
      expect(screen.getByText(new RegExp(text))).toBeInTheDocument();
    }
  });
});

describe("Runner profile detail", () => {
  const runLogs = [
    stackRun("a", "2026-08-14", { distanceMiles: 4 }),
    stackRun("b", "2026-08-10", { distanceMiles: 9 }),
    stackRun("c", "2026-08-03", { distanceMiles: 6 }),
  ];

  it("opens from the snapshot rather than sitting above the history", async () => {
    const user = userEvent.setup();
    renderRuns({ runLogs });

    await user.click(screen.getByRole("button", { name: /^Runner snapshot\./ }));

    expect(screen.getByRole("dialog")).toHaveAccessibleName("Your Running");
    const sheet = within(screen.getByRole("dialog"));
    expect(sheet.getByRole("heading", { name: "Volume" })).toBeInTheDocument();
    expect(sheet.getByRole("heading", { name: "Frequency" })).toBeInTheDocument();
    expect(sheet.getByRole("heading", { name: "Long runs" })).toBeInTheDocument();
    expect(sheet.getByRole("heading", { name: "What STACK has" })).toBeInTheDocument();
  });

  it("keeps source fact and STACK interpretation apart in the long-run view", async () => {
    const user = userEvent.setup();
    renderRuns({
      activities: [historicalRun("a-1", "2026-08-12", { miles: 13.1 })],
      runLogs,
    });

    await user.click(screen.getByRole("button", { name: /^Runner snapshot\./ }));

    const sheet = within(screen.getByRole("dialog"));
    expect(
      sheet.getByText(/STACK calls it a Long Run only when the run is connected to a planned/),
    ).toBeInTheDocument();
    expect(sheet.getAllByText("Connected history").length).toBeGreaterThan(0);
  });

  it("reports coverage for every optional metric, and defers what it cannot compare", async () => {
    const user = userEvent.setup();
    renderRuns({ runLogs });

    await user.click(screen.getByRole("button", { name: /^Runner snapshot\./ }));

    const sheet = within(screen.getByRole("dialog"));
    expect(sheet.getByText("Heart rate")).toBeInTheDocument();
    expect(sheet.getByText("HR zones")).toBeInTheDocument();
    expect(sheet.getAllByText("0 of 3 · 0%").length).toBeGreaterThan(0);
    expect(
      sheet.getByText(/STACK does not compare them across runs yet/),
    ).toBeInTheDocument();
  });

  it("reaches a run's own detail from the long-run list", async () => {
    const user = userEvent.setup();
    renderRuns({ runLogs });

    await user.click(screen.getByRole("button", { name: /^Runner snapshot\./ }));
    await user.click(screen.getByRole("button", { name: /Open the longest run of the week of August 10/ }));

    expect(screen.getByRole("dialog")).toHaveAccessibleName("Run Detail");
  });
});

describe("Runs Overview and History Explorer boundary", () => {
  const many = Array.from({ length: RECENT_EXPANDED_RUN_COUNT + 8 }, (_, index) =>
    historicalRun(`a-${index}`, `2026-0${index < 9 ? "8" : "7"}-${String((index % 28) + 1).padStart(2, "0")}`),
  );

  it("shows three recent runs, then continues to ten inline without opening a modal", async () => {
    const user = userEvent.setup();
    renderRuns({ activities: many });

    expect(rows()).toHaveLength(RECENT_RUN_COUNT);
    await user.click(screen.getByRole("button", { name: "Show more recent runs" }));
    expect(rows()).toHaveLength(RECENT_EXPANDED_RUN_COUNT);
    expect(screen.queryByRole("dialog", { name: "Full History" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show fewer recent runs" }));
    expect(rows()).toHaveLength(RECENT_RUN_COUNT);
  });

  it("keeps the preview newest-first and preserves run detail from the inline continuation", async () => {
    const user = userEvent.setup();
    renderRuns({ activities: many });

    const overviewDates = rows().map((row) => row.getAttribute("aria-label"));
    expect(overviewDates).toEqual([
      expect.stringContaining("August 9"),
      expect.stringContaining("August 8"),
      expect.stringContaining("August 7"),
    ]);

    await user.click(screen.getByRole("button", { name: "Show more recent runs" }));
    await user.click(
      screen
        .getAllByRole("button")
        .find((button) => button.className.includes("run-row"))!,
    );
    expect(screen.getByRole("dialog", { name: "Run Detail" })).toBeInTheDocument();
  });

  it("names the History destination by where it goes and how much is behind it", () => {
    renderRuns({ activities: many });

    const destination = screen.getByRole("button", { name: /^History\./ });
    expect(destination).toHaveAccessibleName(`History. ${many.length} runs since Jul 2026.`);
    expect(screen.queryByRole("button", { name: "Explore History" })).not.toBeInTheDocument();
  });

  it("opens History as a Runs child screen, preserves detail routing, and returns to Overview", async () => {
    const user = userEvent.setup();
    renderRuns({ activities: many });

    await user.click(screen.getByRole("button", { name: /^History\./ }));
    expect(screen.getByRole("heading", { name: "History", level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Full History" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Recent Activity" })).not.toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: /Not logged in STACK/ })[0]);
    expect(screen.getByRole("dialog", { name: "Run Detail" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByRole("heading", { name: "History", level: 1 })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back to Runs" }));
    expect(screen.getByRole("heading", { name: "Recent Activity" })).toBeInTheDocument();
  });

  /**
   * The iPhone bug this replaces: History inherited the Overview's scroll
   * offset, so a runner who scrolled down to reach the destination arrived on a
   * screen whose title was already off the top of the phone.
   */
  it("opens History at its own top and restores the Overview position on the way back", async () => {
    const user = userEvent.setup();
    const scrollTo = vi.fn();
    vi.stubGlobal("scrollTo", scrollTo);
    Object.defineProperty(window, "scrollY", { value: 0, writable: true, configurable: true });
    renderRuns({ activities: many });

    (window as unknown as { scrollY: number }).scrollY = 640;
    await user.click(screen.getByRole("button", { name: /^History\./ }));
    expect(scrollTo).toHaveBeenLastCalledWith(0, 0);

    await user.click(screen.getByRole("button", { name: "Back to Runs" }));
    expect(scrollTo).toHaveBeenLastCalledWith(0, 640);

    vi.unstubAllGlobals();
  });

  it("keeps browsing state out of the Overview it came back to", async () => {
    const user = userEvent.setup();
    renderRuns({ activities: many });

    await user.click(screen.getByRole("button", { name: "Show more recent runs" }));
    await user.click(screen.getByRole("button", { name: /^History\./ }));
    await user.click(screen.getByRole("button", { name: "Back to Runs" }));

    expect(rows()).toHaveLength(RECENT_EXPANDED_RUN_COUNT);
  });
});

describe("Runs hierarchy", () => {
  it("puts visual signals before the three-run preview, and says so when it cannot say more", () => {
    renderRuns({
      runLogs: [
        stackRun("a", "2026-08-11", { workoutId: "workout-002", distanceMiles: 2 }),
        stackRun("b", "2026-08-13", { distanceMiles: 4 }),
      ],
    });

    const sections = [...document.querySelectorAll(".section__title")].map(
      (title) => title.textContent,
    );
    expect(sections).toEqual(["Recent Training", "Training Signals", "Recent Activity"]);
    // Two runs in one week is not a 28-day comparison, so the history signals
    // are absent rather than guessed at; plan context still has something.
    expect(document.querySelectorAll(".signal-cards.section .signal-card")).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: /^Plan context\. Plan to date/ }),
    ).toBeInTheDocument();
  });

  it("draws the recent-volume strip from actual miles with no plan column", () => {
    renderRuns({ runLogs: [stackRun("a", "2026-08-11", { distanceMiles: 7 })] });

    expect(
      screen.getByRole("slider", { name: "Select a week" }),
    ).toHaveAttribute(
      "aria-valuetext",
      "Week of August 10, 7.0 miles, 1 run, still in progress",
    );
    // Nothing planned is drawn beside it: this is what happened, full stop.
    expect(document.querySelector(".plan-actual-chart__planned")).toBeNull();
  });

  it("still says what would put something here when there is nothing", () => {
    renderRuns({});

    expect(screen.getByText("No runs yet")).toBeInTheDocument();
    expect(screen.getByText("Nothing recorded yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Runner snapshot/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Recent Training" })).not.toBeInTheDocument();
  });
});
