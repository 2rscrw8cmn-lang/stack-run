import { describe, expect, it } from "vitest";
import { loadSeedPlan } from "../seed/loadSeedPlan";
import type { RunLog } from "./types";
import { formatPace, runHistory } from "./runs";

const plan = loadSeedPlan();

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

describe("run history", () => {
  it("puts the most recent actual date first, whatever order it was recorded in", () => {
    const history = runHistory(plan, [
      run("b", "2026-08-06"),
      run("c", "2026-08-09"),
      run("a", "2026-08-04"),
    ]);

    expect(history.map((entry) => entry.runLog.id)).toEqual(["c", "b", "a"]);
  });

  it("carries scheduled and extra, typed in and synced, in one list", () => {
    const history = runHistory(plan, [
      run("scheduled", "2026-08-04", { workoutId: "workout-002" }),
      run("extra", "2026-08-05"),
      run("synced", "2026-08-06", {
        source: "intervals",
        externalSource: { provider: "intervals", activityId: "i1", sourceUpdatedAt: null, importedAt: "now" },
      }),
    ]);

    expect(history).toHaveLength(3);
    expect(history.map((entry) => entry.isExtra)).toEqual([true, true, false]);
    // The workout behind a scheduled run comes with it, so the row and the
    // edit sheet never have to go looking for it.
    expect(history[2].workout?.id).toBe("workout-002");
    expect(history[0].workout).toBeNull();
  });

  it("orders two runs on one day by when they were recorded, then by id", () => {
    const morning = run("run-extra-2026-08-04", "2026-08-04", {
      createdAt: "2026-08-04T08:00:00Z",
    });
    const evening = run("run-extra-2026-08-04-2", "2026-08-04", {
      createdAt: "2026-08-04T19:00:00Z",
    });

    expect(runHistory(plan, [morning, evening]).map((entry) => entry.runLog.id)).toEqual([
      evening.id,
      morning.id,
    ]);

    // Same clock reading — routine under a fake timer — still has one answer,
    // and it is the same answer whichever way the log happens to be stored.
    const tied = [
      run("run-b", "2026-08-04", { createdAt: "2026-08-04T08:00:00Z" }),
      run("run-a", "2026-08-04", { createdAt: "2026-08-04T08:00:00Z" }),
    ];
    expect(runHistory(plan, tied).map((entry) => entry.runLog.id)).toEqual(["run-b", "run-a"]);
    expect(runHistory(plan, [...tied].reverse()).map((entry) => entry.runLog.id)).toEqual([
      "run-b",
      "run-a",
    ]);
  });

  it("leaves the stored log alone", () => {
    const runLogs = [run("a", "2026-08-04"), run("b", "2026-08-09")];
    runHistory(plan, runLogs);
    expect(runLogs.map((runLog) => runLog.id)).toEqual(["a", "b"]);
  });
});

describe("derived pace", () => {
  it("reads as minutes and seconds a mile", () => {
    expect(formatPace(5, 2400)).toBe("8:00 /mi");
    expect(formatPace(6.2, 3141)).toBe("8:27 /mi");
  });

  it("is nothing at all rather than a guess when there is no distance", () => {
    expect(formatPace(0, 1800)).toBeNull();
  });
});
