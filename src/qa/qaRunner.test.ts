import { describe, expect, it } from "vitest";
import { unifiedRunnerHistory } from "../history/runnerRun.js";
import { presentableRunnerSignals } from "../signals/runnerSignals.js";
import { autoPlaceOption, placementOptions } from "../domain/placement.js";
import { footprintFor } from "../domain/footprint.js";
import {
  createQaRunnerAppState,
  isQaPreviewHost,
  isQaRunnerEmail,
  isQaRunnerSession,
  qaPlanLifecycleFrom,
  qaRunnerHistoricalActivities,
  QA_RUNNER_EMAIL,
} from "./qaRunner.js";

describe("QA Runner isolation", () => {
  it("enables the harness only on localhost or Vercel branch previews", () => {
    expect(isQaPreviewHost({ hostname: "localhost" })).toBe(true);
    expect(isQaPreviewHost({ hostname: "127.0.0.1" })).toBe(true);
    expect(
      isQaPreviewHost({ hostname: "stack-run-git-feature-plan-next-verus-domus.vercel.app" }),
    ).toBe(true);
    expect(isQaPreviewHost({ hostname: "stack-run.vercel.app" })).toBe(false);
    expect(isQaPreviewHost({ hostname: "stack.example.com" })).toBe(false);
  });

  it("requires the exact synthetic account email", () => {
    expect(isQaRunnerEmail(QA_RUNNER_EMAIL)).toBe(true);
    expect(isQaRunnerEmail(QA_RUNNER_EMAIL.toUpperCase())).toBe(true);
    expect(isQaRunnerEmail("runner@example.com")).toBe(false);
    expect(isQaRunnerEmail(null)).toBe(false);
  });

  it("cannot activate the QA account on a production/custom hostname", () => {
    expect(
      isQaRunnerSession(QA_RUNNER_EMAIL, {
        hostname: "stack-run-git-feature-plan-next-verus-domus.vercel.app",
      }),
    ).toBe(true);
    expect(
      isQaRunnerSession(QA_RUNNER_EMAIL, { hostname: "stack.example.com" }),
    ).toBe(false);
  });
});

describe("QA Runner fixture", () => {
  const today = "2026-08-16";

  it("loads an active plan, completed runs, a built tower and one pending block", () => {
    const state = createQaRunnerAppState(today);
    expect(state.plan.startDate <= today).toBe(true);
    expect(state.plan.race.date > today).toBe(true);
    expect(state.runLogs.length).toBeGreaterThanOrEqual(6);
    expect(state.blockPlacements.length).toBe(state.runLogs.length - 1);

    const placed = new Set(state.blockPlacements.map((placement) => placement.runLogId));
    expect(state.runLogs.filter((run) => !placed.has(run.id))).toHaveLength(1);
  });

  it("produces valid gravity placements from real block footprints", () => {
    const state = createQaRunnerAppState(today);
    const placements = [] as typeof state.blockPlacements;
    const placedRuns = state.runLogs
      .filter((run) => state.blockPlacements.some((placement) => placement.runLogId === run.id))
      .sort((a, b) => a.completedDate.localeCompare(b.completedDate) || a.id.localeCompare(b.id));

    for (const run of placedRuns) {
      const expected = state.blockPlacements.find((placement) => placement.runLogId === run.id);
      expect(expected).toBeDefined();
      const footprint = footprintFor(run);
      const option = autoPlaceOption(
        placementOptions(footprint.width, footprint.height, placements),
      );
      expect(option).not.toBeNull();
      expect(expected?.row).toBe(option?.row);
      expect(expected?.columnStart).toBe(option?.columnStart);
      placements.push(expected!);
    }
  });

  it("loads about a year of normalized historical activity with optional metrics", () => {
    const activities = qaRunnerHistoricalActivities(today);
    expect(activities.length).toBeGreaterThan(150);
    expect(activities.every((run) => run.provider === "intervals")).toBe(true);
    expect(activities.every((run) => run.sourceType === "Run")).toBe(true);
    expect(activities.filter((run) => run.trainingLoad !== null).length).toBeGreaterThan(100);
    expect(activities.filter((run) => run.hrZoneSeconds !== null).length).toBeGreaterThan(100);
    expect(activities.filter((run) => run.elevationGainMeters !== null).length).toBeGreaterThan(100);
    expect(activities.some((run) => run.trainingLoad === null)).toBe(true);
    expect(activities.some((run) => run.hrZoneSeconds === null)).toBe(true);
    expect(activities.some((run) => run.elevationGainMeters === null)).toBe(true);
    expect(activities.filter((run) => run.averageHeartRate !== null).length).toBeGreaterThan(100);
  });

  it("reconciles accepted synced runs instead of duplicating the same source activity", () => {
    const state = createQaRunnerAppState(today);
    const activities = qaRunnerHistoricalActivities(today);
    const runs = unifiedRunnerHistory({
      activities,
      runLogs: state.runLogs,
      blockPlacements: state.blockPlacements,
    });
    const acceptedSourceIds = new Set(
      state.runLogs.flatMap((run) =>
        run.externalSource ? [run.externalSource.activityId] : [],
      ),
    );
    const reconciled = runs.filter((run) =>
      run.externalActivityId ? acceptedSourceIds.has(run.externalActivityId) : false,
    );
    expect(reconciled).toHaveLength(acceptedSourceIds.size);
    expect(reconciled.every((run) => run.stack !== null)).toBe(true);
  });

  it("drives several real NEXT-3 signal families without mocked signal cards", () => {
    const state = createQaRunnerAppState(today);
    const activities = qaRunnerHistoricalActivities(today);
    const runs = unifiedRunnerHistory({
      activities,
      runLogs: state.runLogs,
      blockPlacements: state.blockPlacements,
    });
    const signals = presentableRunnerSignals({
      runs,
      today,
      plan: state.plan,
      runLogs: state.runLogs,
    });
    const families = new Set(signals.map((signal) => signal.family));
    expect(families.has("volume")).toBe(true);
    expect(families.has("frequency")).toBe(true);
    expect(families.has("long-run")).toBe(true);
    expect(families.has("workload")).toBe(true);
    expect(families.has("zone-distribution")).toBe(true);
  });
});

/**
 * NEXT-5 made Plan's lifecycle a product behavior, and two of its three states
 * sit outside the plan window. The harness can now stand on either side of that
 * window so both are reviewable on a device rather than only in a test.
 */
describe("QA Runner plan lifecycle states", () => {
  const today = "2026-08-16";

  it("defaults to the active plan, and ignores an unknown request", () => {
    expect(qaPlanLifecycleFrom(null)).toBe("active");
    expect(qaPlanLifecycleFrom("")).toBe("active");
    expect(qaPlanLifecycleFrom("?qa=after-race")).toBe("after-race");
    expect(qaPlanLifecycleFrom("?qa=before-plan")).toBe("before-plan");
    expect(qaPlanLifecycleFrom("?qa=nonsense")).toBe("active");
  });

  it("places the whole plan window ahead of today for the before-plan review", () => {
    const state = createQaRunnerAppState(today, "before-plan");

    expect(state.plan.startDate > today).toBe(true);
    // Nothing scheduled has happened, so nothing is linked and no plan run can
    // read as missed. The runner still has real running behind them.
    expect(state.runLogs.every((run) => run.workoutId === null)).toBe(true);
    expect(state.runLogs.length).toBeGreaterThan(0);
    expect(
      qaRunnerHistoricalActivities(today, "before-plan").length,
    ).toBeGreaterThan(20);
  });

  it("places the whole plan window behind today for the after-race review", () => {
    const state = createQaRunnerAppState(today, "after-race");

    expect(state.plan.race.date < today).toBe(true);
    const scheduled = state.plan.weeks
      .flatMap((week) => week.workouts)
      .filter((workout) => workout.type !== "rest");
    expect(scheduled.every((workout) => workout.date < today)).toBe(true);

    // A finished plan worth reviewing has both relationships in it: linked
    // days, and days nothing was ever linked to.
    const linked = new Set(
      state.runLogs.flatMap((run) => (run.workoutId ? [run.workoutId] : [])),
    );
    expect(linked.size).toBeGreaterThan(0);
    expect(scheduled.some((workout) => !linked.has(workout.id))).toBe(true);
  });

  it("leaves the active fixture exactly as it was", () => {
    expect(createQaRunnerAppState(today)).toEqual(
      createQaRunnerAppState(today, "active"),
    );
    expect(qaRunnerHistoricalActivities(today)).toEqual(
      qaRunnerHistoricalActivities(today, "active"),
    );
  });
});
