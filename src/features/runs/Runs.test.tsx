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
    expect(screen.getByRole("heading", { level: 1, name: "Runs" })).toHaveClass("visually-hidden");
    expect(screen.getByText("No runs yet")).toBeInTheDocument();
    expect(screen.getByText("Nothing recorded yet")).toBeInTheDocument();
    // No count of miles that do not exist, and no trends drawn from nothing.
    expect(screen.queryByText(/miles run/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Training Signals" }),
    ).not.toBeInTheDocument();
  });

  it("leads with compact facts and Log Run, without a visible Runs title", () => {
    renderRuns([
      run("a", "2026-08-04", { distanceMiles: 2.1 }),
      run("b", "2026-08-06", { distanceMiles: 3.4 }),
    ]);

    expect(screen.getByRole("heading", { level: 1, name: "Runs" })).toHaveClass("visually-hidden");
    expect(screen.getByText("2 runs")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log Run" })).toBeInTheDocument();
    // Four readings, each carrying the window it was measured over.
    expect(
      screen.getByRole("button", { name: /^Runner snapshot\./ }),
    ).toHaveAccessibleName(
      "Runner snapshot. 5.5 miles over the last 28 days. 5.5 miles over the last 7 days. 0.3 runs per week over the last 8 weeks. Longest run of the last 28 days, 3.4 miles. Open history detail.",
    );
    expect(screen.getByRole("heading", { name: "Recent Runs" })).toBeInTheDocument();
  });

  it("lists scheduled, extra, typed in and synced runs together, newest first", async () => {
    const user = userEvent.setup();
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
    ]);

    await user.click(screen.getByRole("button", { name: "Show more recent runs" }));
    const archiveRows = screen
      .getAllByRole("button")
      .filter((button) => button.className.includes("run-row"));
    expect(archiveRows.map((row) => row.getAttribute("aria-label"))).toEqual([
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
      "Easy. Tuesday, August 4. 6.2 mi, 52:21, 8:27 /MI",
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
    expect(sheet.getByText("Plan")).toBeInTheDocument();
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
    expect(sheet.getByText("Intervals.icu")).toBeInTheDocument();
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
    expect(sheet.getByText("Extra")).toBeInTheDocument();
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

  it("connects an extra run to a scheduled workout from a compact picker sheet", async () => {
    const onLinkRun = vi.fn();
    const user = userEvent.setup();
    renderRuns([run("extra", "2026-08-04")], { onLinkRun });

    await user.click(rows()[0]);
    const detail = within(screen.getByRole("dialog"));
    const connectButton = detail.getByRole("button", { name: "Connect to Plan" });
    expect(connectButton).toBeInTheDocument();

    await user.click(connectButton);
    const picker = within(screen.getByRole("dialog"));
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Connect to Plan");

    await user.selectOptions(picker.getByLabelText("Scheduled workout"), "workout-002");
    await user.click(picker.getByRole("button", { name: "Link Run" }));

    expect(onLinkRun).toHaveBeenCalledWith("extra", "workout-002");
    expect(screen.getByText("Run connected to the plan.")).toBeInTheDocument();
    // Comes back to the run's own detail rather than leaving the picker open.
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Run Detail");
  });

  it("does not offer linking without a handler for it", async () => {
    const user = userEvent.setup();
    renderRuns([run("extra", "2026-08-04")]);

    await user.click(rows()[0]);
    expect(screen.queryByRole("button", { name: "Connect to Plan" })).not.toBeInTheDocument();
  });

  it("does not offer a workout another run already claimed", async () => {
    const user = userEvent.setup();
    renderRuns(
      [
        run("extra", "2026-08-01"),
        run("scheduled", "2026-08-04", { workoutId: "workout-002" }),
      ],
      { onLinkRun: vi.fn() },
    );

    await user.click(screen.getByRole("button", { name: /August 1/ }));
    await user.click(screen.getByRole("button", { name: "Connect to Plan" }));
    const select = screen.getByLabelText("Scheduled workout") as HTMLSelectElement;
    const values = [...select.options].map((option) => option.value);

    expect(values).not.toContain("workout-002");
  });

  it("unlinks a scheduled run back to an extra one from its detail sheet", async () => {
    const onUnlinkRun = vi.fn();
    const user = userEvent.setup();
    renderRuns([run("scheduled", "2026-08-04", { workoutId: "workout-002" })], {
      onUnlinkRun,
    });

    await user.click(rows()[0]);
    await user.click(screen.getByRole("button", { name: "Unlink from Plan" }));

    expect(onUnlinkRun).toHaveBeenCalledWith("scheduled");
    expect(screen.getByText("Run unlinked from the plan.")).toBeInTheDocument();
  });

  it("keeps an archived plan relationship read-only in Run Detail", async () => {
    const onUnlinkRun = vi.fn();
    const archivedRun = run("archived", "2026-08-04");
    const user = userEvent.setup();
    renderRuns([archivedRun], {
      planHistory: [{
        id: "archive-1",
        plan,
        raceSetup: null,
        runLinks: { [archivedRun.id]: "workout-002" },
        archivedAt: "2026-12-06T12:00:00.000Z",
      }],
      onUnlinkRun,
    });

    await user.click(rows()[0]);

    expect(screen.getByText("Plan")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Unlink from Plan" }),
    ).not.toBeInTheDocument();
    expect(onUnlinkRun).not.toHaveBeenCalled();
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
