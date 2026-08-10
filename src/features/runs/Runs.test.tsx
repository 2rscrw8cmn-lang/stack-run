import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadSeedPlan } from "../../seed/loadSeedPlan";
import type { RunLog } from "../../domain/types";
import { RunsScreen } from "./RunsScreen";

const plan = loadSeedPlan();
const TODAY = "2026-08-09";

function run(id: string, completedDate: string, options: Partial<RunLog> = {}): RunLog {
  return {
    id,
    workoutId: null,
    completedDate,
    activityType: "easy",
    distanceMiles: 3,
    durationSeconds: 1800,
    effort: "solid",
    notes: "",
    createdAt: `${completedDate}T12:00:00Z`,
    updatedAt: `${completedDate}T12:00:00Z`,
    source: "manual",
    externalSource: null,
    importedMetrics: null,
    ...options,
  };
}

const synced = (id: string, date: string, options: Partial<RunLog> = {}) =>
  run(id, date, {
    source: "intervals",
    externalSource: { provider: "intervals", activityId: `${id}-external`, sourceUpdatedAt: null, importedAt: "now" },
    ...options,
  });

function renderRuns(runLogs: RunLog[], props: Partial<Parameters<typeof RunsScreen>[0]> = {}) {
  return render(
    <RunsScreen plan={plan} runLogs={runLogs} today={TODAY} {...props} />,
  );
}

function rows() {
  return screen
    .getAllByRole("button")
    .filter((button) => button.className.includes("run-row"));
}

afterEach(() => vi.restoreAllMocks());

describe("Runs", () => {
  it("says what would put something here before there is anything", () => {
    renderRuns([]);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "No runs yet",
    );
    expect(screen.getByText("Nothing recorded yet")).toBeInTheDocument();
    // No count of miles that do not exist, and no trends drawn from nothing.
    expect(screen.queryByText(/miles run/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Training Signals" }),
    ).not.toBeInTheDocument();
  });

  it("leads with the count and the miles, not with the word Runs", () => {
    renderRuns([
      run("a", "2026-08-04", { distanceMiles: 2.1 }),
      run("b", "2026-08-06", { distanceMiles: 3.4 }),
    ]);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("2 runs");
    expect(screen.getByText("5.5 miles run")).toBeInTheDocument();
  });

  it("lists scheduled, extra, typed in and synced runs together, newest first", () => {
    renderRuns([
      run("scheduled", "2026-08-04", { workoutId: "workout-002", distanceMiles: 2 }),
      run("extra", "2026-08-05", { activityType: "intervals" }),
      synced("imported", "2026-08-08", { activityType: "long", distanceMiles: 6.2 }),
      run("newest", "2026-08-09", { workoutId: "workout-007", activityType: "long" }),
    ]);

    expect(rows().map((row) => row.getAttribute("aria-label"))).toEqual([
      expect.stringContaining("Sunday, August 9"),
      expect.stringContaining("Saturday, August 8"),
      expect.stringContaining("Wednesday, August 5"),
      expect.stringContaining("Tuesday, August 4"),
    ]);
  });

  it("gives a row the facts it is about, and marks only the unscheduled ones extra", () => {
    renderRuns([
      run("scheduled", "2026-08-04", {
        workoutId: "workout-002",
        distanceMiles: 6.2,
        durationSeconds: 3141,
      }),
      run("extra", "2026-08-05"),
    ]);

    const [, scheduled] = rows();
    expect(scheduled).toHaveAccessibleName(
      "Easy. Tuesday, August 4. 6.2 mi, 52:21, 8:27 /mi",
    );
    expect(within(scheduled).queryByText("Extra")).not.toBeInTheDocument();
    expect(rows()[0]).toHaveAccessibleName(expect.stringContaining("Extra run"));
    expect(within(rows()[0]).getByText("Extra")).toBeInTheDocument();
  });

  it("does not badge a row with where the run came from", () => {
    renderRuns([synced("imported", "2026-08-08")]);
    expect(screen.queryByText(/Intervals/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^manual$/i)).not.toBeInTheDocument();
  });

  it("opens one detail sheet for a scheduled run, with its planned workout", async () => {
    const user = userEvent.setup();
    renderRuns([run("scheduled", "2026-08-04", { workoutId: "workout-002", notes: "Legs good." })]);

    await user.click(rows()[0]);

    const sheet = within(screen.getByRole("dialog"));
    expect(sheet.getByText("Tuesday, August 4, 2026")).toBeInTheDocument();
    expect(sheet.getByText("Scheduled workout")).toBeInTheDocument();
    expect(sheet.getByText(/Week 1 · 2 Miles/)).toBeInTheDocument();
    expect(sheet.getByText("Legs good.")).toBeInTheDocument();
  });

  it("reuses the imported detail rather than rendering metrics a second way", async () => {
    const user = userEvent.setup();
    renderRuns([
      synced("imported", "2026-08-08", {
        distanceMiles: 6,
        durationSeconds: 3000,
        importedMetrics: {
          averageHeartRate: 151,
          elapsedTimeSeconds: 3240,
          hrZoneSeconds: [600, 1800, 600],
        },
      }),
    ]);

    await user.click(rows()[0]);

    const sheet = within(screen.getByRole("dialog"));
    expect(sheet.getByText("Synced via Intervals.icu")).toBeInTheDocument();
    expect(sheet.getByText("151 bpm")).toBeInTheDocument();
    expect(
      sheet.getByRole("list", { name: "Heart rate zone distribution" }),
    ).toBeInTheDocument();
    // Moving and elapsed are both real, and both said, once each.
    expect(sheet.getByText("Moving")).toBeInTheDocument();
    expect(sheet.getByText("50:00")).toBeInTheDocument();
    expect(sheet.getByText("Elapsed")).toBeInTheDocument();
    expect(sheet.getByText("54:00")).toBeInTheDocument();
    expect(sheet.queryByText("Duration")).not.toBeInTheDocument();
    expect(sheet.getByText("Extra run")).toBeInTheDocument();
  });

  it("keeps one duration when elapsed time says nothing new", async () => {
    const user = userEvent.setup();
    renderRuns([
      synced("imported", "2026-08-08", {
        durationSeconds: 3000,
        importedMetrics: { elapsedTimeSeconds: 3012 },
      }),
    ]);

    await user.click(rows()[0]);

    const sheet = within(screen.getByRole("dialog"));
    expect(sheet.getByText("Duration")).toBeInTheDocument();
    expect(sheet.queryByText("Elapsed")).not.toBeInTheDocument();
  });

  it("edits a scheduled run without handing it back as an extra one", async () => {
    const onSaveRun = vi.fn();
    const user = userEvent.setup();
    renderRuns(
      [run("scheduled", "2026-08-04", { workoutId: "workout-002" })],
      { onSaveRun },
    );

    await user.click(rows()[0]);
    await user.click(screen.getByRole("button", { name: "Edit Run" }));
    await user.clear(screen.getByLabelText(/Distance/));
    await user.type(screen.getByLabelText(/Distance/), "2.6");
    await user.click(screen.getByRole("button", { name: "Save Run" }));

    // The workout the run satisfied goes back with it. Handing back null here
    // is what used to unlink a scheduled run from its day.
    const [workout, values, runLogId] = onSaveRun.mock.calls[0];
    expect(workout?.id).toBe("workout-002");
    expect(values.distanceMiles).toBe(2.6);
    expect(runLogId).toBe("scheduled");
  });

  it("deletes through the existing entry sheet and puts focus back on the list", async () => {
    const onDeleteRun = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    const { rerender } = renderRuns([run("only", "2026-08-04")], { onDeleteRun });

    await user.click(rows()[0]);
    await user.click(screen.getByRole("button", { name: "Edit Run" }));
    await user.click(screen.getByRole("button", { name: "Delete Run" }));

    expect(onDeleteRun).toHaveBeenCalledWith("only");

    // The row the browser would have returned focus to has gone with the run.
    rerender(<RunsScreen plan={plan} runLogs={[]} today={TODAY} onDeleteRun={onDeleteRun} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
    expect(screen.getByText(/Run deleted/)).toBeInTheDocument();
  });

  it("logs an extra run from here as well as from Today", async () => {
    const onSaveRun = vi.fn();
    const user = userEvent.setup();
    renderRuns([], { onSaveRun });

    await user.click(screen.getByRole("button", { name: "Log Run" }));
    await user.type(screen.getByLabelText(/Distance/), "4");
    await user.type(screen.getByLabelText(/Duration/), "3200");
    await user.click(screen.getByRole("button", { name: "Solid" }));
    await user.click(screen.getByRole("button", { name: "Save Run" }));

    const [workout, values, runLogId] = onSaveRun.mock.calls[0];
    expect(workout).toBeNull();
    expect(values.distanceMiles).toBe(4);
    // No id: this is a new activity, not an edit of one.
    expect(runLogId).toBeUndefined();
  });

  it("comes back to the run when the entry sheet is dismissed rather than saved", async () => {
    const user = userEvent.setup();
    renderRuns([run("scheduled", "2026-08-04", { workoutId: "workout-002" })]);

    await user.click(rows()[0]);
    await user.click(screen.getByRole("button", { name: "Edit Run" }));
    expect(screen.getByRole("heading", { name: "Edit Run" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByRole("heading", { name: "Run Detail" })).toBeInTheDocument();
  });
});

describe("Runs Training Signals", () => {
  const week1 = [
    run("a", "2026-08-04", { workoutId: "workout-002", distanceMiles: 2 }),
    run("b", "2026-08-06", { workoutId: "workout-004", distanceMiles: 2 }),
    run("c", "2026-08-09", { activityType: "long", distanceMiles: 4.2 }),
  ];

  it("puts factual Training Signals on Runs, one measure to a card", () => {
    renderRuns(week1);

    expect(
      screen.getByRole("heading", { name: "Training Signals" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Weekly Mileage, 8.2 mi/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Long Run, 4.2 mi/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Consistency, 50%/ }),
    ).toBeInTheDocument();
  });

  it("names the value and the specific destination on every card", () => {
    renderRuns(week1);
    const card = screen.getByRole("button", { name: /^Consistency/ });
    expect(card).toHaveAccessibleName(
      "Consistency, 50%, 2 of 4 completed. Open Consistency detail.",
    );
  });

  it("supports keyboard activation for a signal and its selected week", async () => {
    const user = userEvent.setup();
    renderRuns([
      run("w1", "2026-08-04", { distanceMiles: 3 }),
      run("w2", "2026-08-11", { distanceMiles: 4 }),
    ], { today: "2026-08-16" });

    const card = screen.getByRole("button", { name: /^Weekly Mileage,/ });
    card.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Weekly Mileage");

    const week = screen.getByRole("button", { name: /^Week 1, 3 actual miles/ });
    week.focus();
    await user.keyboard("{Enter}");
    expect(week).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Week 1 runs")).toBeInTheDocument();
  });

  it("leaves out a measure nothing has been recorded for", () => {
    renderRuns([run("a", "2026-08-04", { distanceMiles: 2 })]);
    expect(
      screen.queryByRole("button", { name: /^Long Run/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^HR Zones/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Training Load/ })).not.toBeInTheDocument();
  });

  it("opens a dedicated detail for every available signal", async () => {
    const user = userEvent.setup();
    const richRuns = [
      run("e1", "2026-08-03", { durationSeconds: 1860, importedMetrics: { averageHeartRate: 150, trainingLoad: 30, hrZoneSeconds: [0, 600, 300, 0, 0, 0, 0] } }),
      run("e2", "2026-08-04", { durationSeconds: 1830 }),
      run("e3", "2026-08-05", { durationSeconds: 1800 }),
      run("e4", "2026-08-06", { durationSeconds: 1770 }),
      run("l1", "2026-08-09", { activityType: "long", distanceMiles: 5 }),
      run("e5", "2026-08-10", { durationSeconds: 1740, importedMetrics: { averageHeartRate: 149, trainingLoad: 35, hrZoneSeconds: [0, 300, 600, 0, 0, 0, 0] } }),
      run("e6", "2026-08-11", { durationSeconds: 1710 }),
      run("e7", "2026-08-12", { durationSeconds: 1680 }),
      run("e8", "2026-08-13", { durationSeconds: 1650 }),
      run("l2", "2026-08-16", { activityType: "long", distanceMiles: 6 }),
    ];
    renderRuns(richRuns, { today: "2026-08-16" });

    const details = [
      ["Weekly Mileage", /^Weekly Mileage,/],
      ["Long Run", /^Long Run,/],
      ["Easy Pace", /^Easy Pace,/],
      ["Heart Rate Zones", /^HR Zones,/],
      ["Training Load", /^Training Load,/],
      ["Consistency", /^Consistency,/],
      ["Run Mix", /^Run Mix,/],
    ] as const;

    for (const [title, cardName] of details) {
      await user.click(screen.getByRole("button", { name: cardName }));
      expect(screen.getByRole("dialog")).toHaveAccessibleName(title);
      await user.click(screen.getByRole("button", { name: "Close" }));
    }
  });

  it("selects a mileage week and reaches the underlying existing run detail", async () => {
    const user = userEvent.setup();
    renderRuns([
      run("w1", "2026-08-04", { distanceMiles: 3 }),
      run("w2", "2026-08-11", { distanceMiles: 4 }),
    ], { today: "2026-08-16" });

    await user.click(screen.getByRole("button", { name: /^Weekly Mileage,/ }));
    await user.click(screen.getByRole("button", { name: /^Week 1, 3 actual miles/ }));
    expect(screen.getByText("Week 1 runs")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Open Easy on .*Aug 4/ }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Run Detail");
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Weekly Mileage");
  });
});
