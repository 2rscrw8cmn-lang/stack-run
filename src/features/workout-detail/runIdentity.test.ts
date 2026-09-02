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
  it("does not promote the source's own activity name over what STACK holds", () => {
    // `Winter Park - W1 Run 1 — Easy 3mi` is how a watch files a run. It is
    // kept, and it is kept out of the heading.
    const identity = runIdentityFromRunLog(
      accepted,
      workout,
      mirrorFor(accepted, { name: "Winter Park - W1 Run 1 — Easy 3mi" }),
    );

    expect(identity.title).toBe("Easy Run");
    expect(identity.titleSource).toBe("classification");
    expect(identity.sourceName).toBe("Winter Park - W1 Run 1 — Easy 3mi");
    // The plan context stays, in full, because the heading did not say it.
    expect(identity.planLine).toBe("Week 3 · Easy 3 mi");
  });

  it("leads with the linked workout only when its title is a name rather than a restatement", () => {
    // `Easy 3 mi` says the type and the distance, both of which the chip, the
    // classification and the plan line below already say.
    expect(runIdentityFromRunLog(accepted, workout, null).title).toBe("Easy Run");

    const named = { ...workout, title: "Yasso 800s" };
    const identity = runIdentityFromRunLog(accepted, named, null);
    expect(identity.title).toBe("Yasso 800s");
    expect(identity.titleSource).toBe("planned-workout");
    // And the line underneath stops repeating what the heading just said.
    expect(identity.planLine).toBe("Week 3");
  });

  it("falls back to what STACK holds the run to have been, and never invents a name", () => {
    const extra = stackRun("run-2", "2026-08-04", { activityType: "long" });
    const identity = runIdentityFromRunLog(extra, null, null);

    expect(identity.title).toBe("Long Run");
    expect(identity.titleSource).toBe("classification");
    expect(identity.planLine).toBeNull();
    expect(identity.sourceName).toBeNull();
  });

  it("states the plan relationship and nothing that repeats the title", () => {
    const identity = runIdentityFromRunLog(accepted, workout, mirrorFor(accepted, { name: "Sunrise 5k" }));
    expect(identity.status).toEqual({ label: "Plan", tone: "plan" });

    /*
     * There is no activity-type chip any more. A run headed `Easy Run` with an
     * `EASY` chip immediately beneath it said the same thing twice; the kind of
     * running is now carried by the colour of the run's own mark, which is in
     * the same place on every run and costs no line of the screen.
     */
    expect(identity.activityType).toBe("easy");
    expect(Object.keys(identity)).not.toContain("chips");
  });

  it("states the kind of running only where the title does not", () => {
    /*
     * `Easy Run` over an `EASY` chip is what this pass removed. But a run headed
     * with its workout's own name states no type at all, and there the mark's
     * colour is the only thing carrying it — too little for `Race`, whose colour
     * is very nearly the plain text colour. So the type appears exactly where
     * the title dropped it.
     */
    expect(runIdentityFromRunLog(accepted, null, null).typeLabel).toBeNull();
    expect(runIdentityFromRunLog(accepted, workout, null).typeLabel).toBeNull();

    const named = runIdentityFromRunLog(
      accepted,
      { ...workout, title: "Yasso 800s" },
      null,
    );
    expect(named.title).toBe("Yasso 800s");
    expect(named.typeLabel).toBe("Easy");
  });

  it("does not restate the type when the title already is the type", () => {
    // `Easy Run` over an `EASY` chip is what this pass removed.
    const identity = runIdentityFromRunLog(accepted, null, null);
    expect(identity.title).toBe("Easy Run");
    expect(identity.typeLabel).toBeNull();
  });

  it("marks a run with no scheduled workout as extra rather than as plan", () => {
    expect(runIdentityFromRunLog(accepted, null, null).status)
      .toEqual({ label: "Extra", tone: "extra" });
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

  it("still leads a historical-only run with its source's name, which is all it has", () => {
    const [row] = unifiedRunnerHistory({
      activities: [historicalRun("h-1", "2026-08-12", { name: "Evening Loop" })],
    });
    const identity = runIdentityFromRunnerRun(row);

    expect(identity.title).toBe("Evening Loop");
    expect(identity.planLine).toBeNull();
    expect(identity.status).toEqual({ label: "History", tone: "history" });
    // Nobody has classified it, so it has no type to colour its mark with.
    expect(identity.activityType).toBeNull();
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
