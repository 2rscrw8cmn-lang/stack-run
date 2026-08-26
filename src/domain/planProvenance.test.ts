import { describe, expect, it } from "vitest";
import {
  canUndoProvenance,
  deriveWorkoutProvenance,
  describeProvenanceChange,
  type PlanAdjustmentRecord,
} from "./planProvenance.js";
import type { Workout } from "./types.js";

function workout(overrides: Partial<Workout> = {}): Workout {
  return {
    id: "w-1",
    date: "2026-09-10",
    weekNumber: 2,
    phase: "build",
    type: "easy",
    title: "Easy run",
    targetDistanceMiles: "4",
    details: "",
    build: { renders: true, weekRow: 2, orderInWeek: 1, span: 1, colorKey: "easy" },
    ...overrides,
  };
}

function record(overrides: Partial<PlanAdjustmentRecord> = {}): PlanAdjustmentRecord {
  return {
    id: "adj-1",
    operations: [],
    reason: null,
    beforeWorkouts: [],
    resultingPlanRevision: 2,
    createdAt: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

describe("deriveWorkoutProvenance", () => {
  it("reports provenance when the current workout matches a recorded editRun exactly", () => {
    const before = workout({ title: "Old title", targetDistanceMiles: "3" });
    const current = workout({ title: "New title", targetDistanceMiles: "5" });
    const adjustment = record({
      operations: [{ op: "editRun", workoutId: "w-1", values: { type: "easy", title: "New title", targetDistanceMiles: "5", details: "" } }],
      beforeWorkouts: [before],
    });

    const provenance = deriveWorkoutProvenance(current, [adjustment]);

    expect(provenance).not.toBeNull();
    expect(provenance!.adjustmentId).toBe("adj-1");
    expect(provenance!.before).toEqual(before);
  });

  it("reports provenance for a move, matching on the current date", () => {
    const before = workout({ date: "2026-09-08" });
    const current = workout({ date: "2026-09-12" });
    const adjustment = record({
      operations: [{ op: "move", workoutId: "w-1", toDate: "2026-09-12" }],
      beforeWorkouts: [before],
    });
    expect(deriveWorkoutProvenance(current, [adjustment])).not.toBeNull();
  });

  it("reports provenance for a skip, matching on the current type being rest", () => {
    const before = workout({ type: "easy" });
    const current = workout({ type: "rest", title: "Rest", targetDistanceMiles: null, details: "No scheduled run." });
    const adjustment = record({
      operations: [{ op: "skip", workoutId: "w-1" }],
      beforeWorkouts: [before],
    });
    expect(deriveWorkoutProvenance(current, [adjustment])).not.toBeNull();
  });

  it("disappears once a manual edit changes the workout away from what the operation set", () => {
    const before = workout({ title: "Old title" });
    // The assistant set "New title"; the runner then manually changed it again.
    const current = workout({ title: "Manually changed title" });
    const adjustment = record({
      operations: [{ op: "editRun", workoutId: "w-1", values: { type: "easy", title: "New title", targetDistanceMiles: "4", details: "" } }],
      beforeWorkouts: [before],
    });
    expect(deriveWorkoutProvenance(current, [adjustment])).toBeNull();
  });

  it("disappears after an in-app undo restores the pre-adjustment fields", () => {
    const before = workout({ title: "Old title", targetDistanceMiles: "3" });
    const adjustment = record({
      operations: [{ op: "editRun", workoutId: "w-1", values: { type: "easy", title: "New title", targetDistanceMiles: "5", details: "" } }],
      beforeWorkouts: [before],
    });
    // Undo restores the workout to `before` — which no longer matches the operation.
    expect(deriveWorkoutProvenance(before, [adjustment])).toBeNull();
  });

  it("within one batch touching a workout twice, the last operation wins", () => {
    const before = workout({ title: "Old title", date: "2026-09-08" });
    const current = workout({ title: "Old title", date: "2026-09-15" });
    const adjustment = record({
      operations: [
        { op: "editRun", workoutId: "w-1", values: { type: "easy", title: "First edit", targetDistanceMiles: "4", details: "" } },
        { op: "move", workoutId: "w-1", toDate: "2026-09-15" },
      ],
      beforeWorkouts: [before],
    });
    // Only the move (the last op) is checked; the first edit's title is not required to match.
    expect(deriveWorkoutProvenance(current, [adjustment])).not.toBeNull();
  });

  it("ignores an adjustment that never named this workout", () => {
    const current = workout();
    const adjustment = record({
      operations: [{ op: "skip", workoutId: "some-other-workout" }],
      beforeWorkouts: [workout({ id: "some-other-workout" })],
    });
    expect(deriveWorkoutProvenance(current, [adjustment])).toBeNull();
  });

  it("picks the most recent matching adjustment when more than one exists", () => {
    const current = workout({ title: "Second edit" });
    const older = record({
      id: "adj-old",
      createdAt: "2026-08-01T00:00:00Z",
      operations: [{ op: "editRun", workoutId: "w-1", values: { type: "easy", title: "First edit", targetDistanceMiles: "4", details: "" } }],
      beforeWorkouts: [workout({ title: "Original" })],
    });
    const newer = record({
      id: "adj-new",
      createdAt: "2026-09-01T00:00:00Z",
      operations: [{ op: "editRun", workoutId: "w-1", values: { type: "easy", title: "Second edit", targetDistanceMiles: "4", details: "" } }],
      beforeWorkouts: [workout({ title: "First edit" })],
    });
    const provenance = deriveWorkoutProvenance(current, [older, newer]);
    expect(provenance!.adjustmentId).toBe("adj-new");
  });
});

describe("describeProvenanceChange", () => {
  it("describes a move by date", () => {
    const before = workout({ date: "2026-09-08" });
    const current = workout({ date: "2026-09-12" });
    const provenance = deriveWorkoutProvenance(current, [record({
      operations: [{ op: "move", workoutId: "w-1", toDate: "2026-09-12" }],
      beforeWorkouts: [before],
    })])!;
    expect(describeProvenanceChange(provenance, current)).toEqual(["Moved from Sep 8 to Sep 12"]);
  });

  it("only mentions the fields that actually changed on an editRun", () => {
    const before = workout({ title: "Easy run", targetDistanceMiles: "4", type: "easy" });
    const current = workout({ title: "Easy run", targetDistanceMiles: "6", type: "easy" });
    const provenance = deriveWorkoutProvenance(current, [record({
      operations: [{ op: "editRun", workoutId: "w-1", values: { type: "easy", title: "Easy run", targetDistanceMiles: "6", details: "" } }],
      beforeWorkouts: [before],
    })])!;
    expect(describeProvenanceChange(provenance, current)).toEqual(["Distance: 4 mi → 6 mi"]);
  });

  it("describes a skip in terms of what it used to be", () => {
    const before = workout({ type: "intervals" });
    const current = workout({ type: "rest", title: "Rest", targetDistanceMiles: null, details: "No scheduled run." });
    const provenance = deriveWorkoutProvenance(current, [record({
      operations: [{ op: "skip", workoutId: "w-1" }],
      beforeWorkouts: [before],
    })])!;
    expect(describeProvenanceChange(provenance, current)).toEqual(["Changed from Intervals to a rest day"]);
  });
});

describe("canUndoProvenance", () => {
  it("is true only when nothing has changed the plan since this adjustment landed", () => {
    const provenance = deriveWorkoutProvenance(
      workout({ title: "New title" }),
      [record({ resultingPlanRevision: 3, operations: [{ op: "editRun", workoutId: "w-1", values: { type: "easy", title: "New title", targetDistanceMiles: "4", details: "" } }], beforeWorkouts: [workout({ title: "Old title" })] })],
    )!;
    expect(canUndoProvenance(provenance, 3)).toBe(true);
    expect(canUndoProvenance(provenance, 4)).toBe(false);
  });
});
