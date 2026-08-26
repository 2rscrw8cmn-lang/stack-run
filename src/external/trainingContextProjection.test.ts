import { describe, expect, it } from "vitest";
import { createInitialAppState, createSeededAppState } from "../storage/migrations";
import type { RunLog } from "../domain/types";
import {
  projectExternalTrainingContext,
  type ExternalCrewSummaryRow,
} from "./trainingContextProjection";
import { presentableRunnerSignals } from "../signals/runnerSignals";
import { unifiedRunnerHistory } from "../history/runnerRun";

const privateRun: RunLog = {
  id: "run-1",
  workoutId: null,
  completedDate: "2026-08-10",
  activityType: "long",
  distanceMiles: 8,
  durationSeconds: 4200,
  effort: "great",
  notes: "private reflections nobody outside STACK should see",
  createdAt: "2026-08-10T12:00:00Z",
  updatedAt: "2026-08-10T12:00:00Z",
  source: "intervals",
  externalSource: {
    provider: "intervals",
    activityId: "external-activity-id",
    sourceUpdatedAt: null,
    importedAt: "2026-08-10T12:00:00Z",
  },
  importedMetrics: {
    averageHeartRate: 155,
    maxHeartRate: 176,
    averageCadence: 172,
    elevationGainFeet: 210,
    trainingLoad: 88,
    hrZoneSeconds: [100, 200],
  },
};

describe("projectExternalTrainingContext", () => {
  it("is honest about having no active plan", () => {
    const context = projectExternalTrainingContext(createInitialAppState(), "2026-08-10");
    expect(context.plan).toBeNull();
    expect(context.raceGoal).toBeNull();
    expect(context.build.pendingBlockCount).toBe(0);
    expect(context.build.placedBlockCount).toBe(0);
  });

  it("projects the active plan's week and race goal from a real seeded plan", () => {
    const state = createSeededAppState();
    const firstWorkout = state.plan.weeks[0]!.workouts.find((w) => w.type !== "rest")!;
    const context = projectExternalTrainingContext(state, firstWorkout.date);

    expect(context.plan).not.toBeNull();
    expect(context.plan!.name).toBe(state.plan.name);
    expect(context.plan!.currentWeekNumber).toBe(state.plan.weeks[0]!.weekNumber);
    expect(context.plan!.totalWeeks).toBe(state.plan.weeks.length);
    expect(context.raceGoal).toEqual({
      name: state.plan.race.name,
      date: state.plan.race.date,
      distanceMiles: state.plan.race.distanceMiles,
      goal: state.plan.race.goal,
    });
    // Every upcoming workout within the window is a real scheduled run, not a rest day.
    for (const workout of context.plan!.upcomingWorkouts) {
      expect(workout.type).not.toBe("rest");
    }
  });

  it("projects a stated structured race goal, still read-only", () => {
    const state = createSeededAppState();
    const withGoal = {
      ...state,
      plan: {
        ...state.plan,
        race: { ...state.plan.race, goal: { type: "time" as const, targetFinishSeconds: 6300 } },
      },
    };
    const context = projectExternalTrainingContext(withGoal, "2026-08-10");
    expect(context.raceGoal?.goal).toEqual({ type: "time", targetFinishSeconds: 6300 });
  });

  it("never leaks a run's notes or external provider identity, but keeps training-relevant facts", () => {
    const context = projectExternalTrainingContext(
      { ...createInitialAppState(), runLogs: [privateRun] },
      "2026-08-15",
    );

    expect(context.recentRuns).toHaveLength(1);
    const run = context.recentRuns[0]!;
    expect(run).toMatchObject({
      distanceMiles: 8,
      averageHeartRate: 155,
      maxHeartRate: 176,
      averageCadence: 172,
      elevationGainFeet: 210,
      trainingLoad: 88,
      activityType: "long",
      effort: "great",
      source: "intervals",
    });
    expect(Object.keys(run).sort()).toEqual(
      [
        "id",
        "date",
        "startTimeLocal",
        "distanceMiles",
        "durationSeconds",
        "paceSecondsPerMile",
        "averageHeartRate",
        "maxHeartRate",
        "elevationGainFeet",
        "averageCadence",
        "trainingLoad",
        "activityType",
        "effort",
        "source",
        "isExtra",
        "hasPlacedBlock",
      ].sort(),
    );
    expect(JSON.stringify(context)).not.toMatch(
      /private reflections|external-activity-id|hrZoneSeconds/i,
    );
  });

  it("only surfaces runs inside the recent window, not the runner's full history", () => {
    const old = { ...privateRun, id: "run-old", completedDate: "2020-01-01" };
    const context = projectExternalTrainingContext(
      { ...createInitialAppState(), runLogs: [old] },
      "2026-08-15",
    );
    expect(context.recentRuns).toHaveLength(0);
  });

  it("passes Training Signals through unmodified rather than recomputing them", () => {
    const state = { ...createInitialAppState(), runLogs: [privateRun] };
    const today = "2026-08-15";
    const context = projectExternalTrainingContext(state, today);

    const expectedSignals = presentableRunnerSignals({
      runs: unifiedRunnerHistory({ runLogs: state.runLogs, blockPlacements: state.blockPlacements }),
      today,
      plan: state.plan,
      runLogs: state.runLogs,
    });
    expect(context.signals).toEqual(expectedSignals);
  });

  it("projects only the viewer's own crew membership rows, never another member's", () => {
    const rows: ExternalCrewSummaryRow[] = [
      {
        crewName: "Night Shift",
        role: "member",
        weeklyMiles: 12,
        longestRun28dMiles: 9,
        consistencyCompleted: 3,
        consistencyDue: 4,
        milesBuilt: 40,
      },
    ];
    const context = projectExternalTrainingContext(
      createInitialAppState(),
      "2026-08-15",
      rows,
    );
    expect(context.crew).toEqual(rows);
  });

  it("never fabricates plan-adjustment history — always the explicit empty array", () => {
    const context = projectExternalTrainingContext(createInitialAppState(), "2026-08-15");
    expect(context.planAdjustments).toEqual([]);
  });
});
