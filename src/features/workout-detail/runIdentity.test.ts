import { describe, expect, it } from "vitest";
import type { RunLog, Workout } from "../../domain/types.js";
import { historicalRun, stackRun } from "../../history/runnerFixtures.js";
import { unifiedRunnerHistory, type RunnerRun } from "../../history/runnerRun.js";
import {
  formatStartTime,
  runIdentityFromRunLog,
  runIdentityFromRunnerRun,
} from "./runIdentity.js";

const workout: Workout = {
  id: "workout-002",
  date: "2026-08-04",
  weekNumber: 3,
  phase: "Foundation",
  type: "easy",
  title: "Easy 3 mi",
  targetDistanceMiles: "3",
  details: "",
  build: { renders: true, weekRow: 0, orderInWeek: 0, span: 1, colorKey: "easy" },
};

/** The same physical run as the connected history knows it. */
function mirrorFor(runLog: RunLog, options: Parameters<typeof historicalRun>[2] = {}): RunnerRun {
  const [row] = unifiedRunnerHistory({
    activities: [historicalRun("a-1", runLog.completedDate, options)],
    runLogs: [runLog],
  });
  return row;
}

const accepted = stackRun("run-1", "2026-08-04", {
  source: "intervals",
  externalSource: { provider: "intervals", activityId: "a-1", sourceUpdatedAt: null, importedAt: "now" },
});

/**
 * Issue #214: Run Detail opens on the activity, not on the words "Run Detail".
 *
 * The rule under every case here is that a title is a claim. STACK may state
 * the source's own name for a run, the workout a run is linked to, or what it
 * holds the run to have been — and nothing else. There is no fourth option that
 * makes a run sound named when it is not.
 */
describe("run identity", () => {
  it("leads with the source's own activity name when the history mirror has one", () => {
    const identity = runIdentityFromRunLog(accepted, workout, mirrorFor(accepted, { name: "Sunrise 5k" }));

    expect(identity.title).toBe("Sunrise 5k");
    expect(identity.titleSource).toBe("source-activity");
    // The plan context stays, in full, because the heading did not say it.
    expect(identity.planLine).toBe("Week 3 · Easy 3 mi");
  });

  it("falls back to the workout a run is linked to, and stops repeating it underneath", () => {
    const identity = runIdentityFromRunLog(accepted, workout, mirrorFor(accepted));

    expect(identity.title).toBe("Easy 3 mi");
    expect(identity.titleSource).toBe("planned-workout");
    expect(identity.planLine).toBe("Week 3");
  });

  it("falls back to what STACK holds the run to have been, and never invents a name", () => {
    const extra = stackRun("run-2", "2026-08-04", { activityType: "long" });
    const identity = runIdentityFromRunLog(extra, null, null);

    expect(identity.title).toBe("Long Run");
    expect(identity.titleSource).toBe("classification");
    expect(identity.planLine).toBeNull();
    // The heading already says "Long Run", so no chip repeats the word.
    expect(identity.chips.map((chip) => chip.label)).toEqual(["Extra"]);
  });

  it("keeps the activity type as a chip whenever the heading is not already it", () => {
    const identity = runIdentityFromRunLog(accepted, workout, mirrorFor(accepted, { name: "Sunrise 5k" }));
    expect(identity.chips.map((chip) => chip.label)).toEqual(["Easy", "Plan"]);
    expect(identity.chips.map((chip) => chip.tone)).toEqual(["easy", "plan"]);
  });

  it("marks a run with no scheduled workout as extra rather than as plan", () => {
    expect(runIdentityFromRunLog(accepted, null, null).chips.map((chip) => chip.label))
      .toContain("Extra");
  });

  it("reads the local start time off the mirror, which is the only record that has one", () => {
    const identity = runIdentityFromRunLog(
      accepted,
      workout,
      mirrorFor(accepted, { startTimeLocal: "2026-08-04T06:12:00" }),
    );

    expect(identity.startTimeLabel).toBe("6:12 AM");
    // A run STACK has no mirror for simply has no start time.
    expect(runIdentityFromRunLog(accepted, workout, null).startTimeLabel).toBeNull();
  });

  it("gives a historical-only run its source's name, its date and nothing STACK-owned", () => {
    const [row] = unifiedRunnerHistory({
      activities: [historicalRun("h-1", "2026-08-12", { name: "Evening Loop" })],
    });
    const identity = runIdentityFromRunnerRun(row);

    expect(identity.title).toBe("Evening Loop");
    expect(identity.planLine).toBeNull();
    expect(identity.chips).toEqual([{ id: "status", label: "History", tone: "history" }]);
  });

  it("says only what a nameless historical activity verifiably is", () => {
    const [row] = unifiedRunnerHistory({ activities: [historicalRun("h-2", "2026-08-12")] });
    expect(runIdentityFromRunnerRun(row).title).toBe("Run");
  });
});

describe("start time", () => {
  it("reads the stored local wall clock rather than re-interpreting it in this device's zone", () => {
    expect(formatStartTime("2026-08-12T06:00:00")).toBe("6:00 AM");
    expect(formatStartTime("2026-08-12T12:05:00")).toBe("12:05 PM");
    expect(formatStartTime("2026-08-12T00:30:00")).toBe("12:30 AM");
    expect(formatStartTime("2026-08-12T18:45:00")).toBe("6:45 PM");
  });

  it("says nothing when the source stated nothing usable", () => {
    expect(formatStartTime(null)).toBeNull();
    expect(formatStartTime("2026-08-12")).toBeNull();
    expect(formatStartTime("2026-08-12T99:00:00")).toBeNull();
  });
});
