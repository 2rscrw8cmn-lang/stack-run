/**
 * The drift guard for `api/_openapiSpec.ts`.
 *
 * Fixtures below are declared with explicit type annotations against the
 * real exported interfaces (`ExternalTrainingContext`, `TrainingSignal`,
 * `RaceGoal`, `PlanAdjustmentOperation`, …). None of those interfaces have
 * optional fields, so TypeScript's own excess/missing-property checking on
 * these literals already fails `npm run build` the moment a real interface
 * gains or loses a field and this file isn't updated to match — before the
 * runtime assertions below even run. Those runtime assertions then only
 * have to prove one remaining thing: that the *spec* declares the same
 * fields the *fixture* has. Together, that's the whole chain from "the
 * route's real TypeScript type" to "what ChatGPT is told to expect."
 */
import { describe, expect, it } from "vitest";
import { openApiSpec } from "./_openapiSpec.js";
import { createSeededAppState } from "../src/storage/migrations.js";
import {
  projectExternalTrainingContext,
  projectPlan,
  type ExternalCrewSummaryRow,
  type ExternalPlanAdjustmentRow,
  type ExternalPlacedBlock,
  type ExternalTrainingContext,
} from "../src/external/trainingContextProjection.js";
import { applyPlanAdjustments, type PlanAdjustmentOperation } from "../src/domain/planAdjustment.js";
import type { RaceGoal, RunLog } from "../src/domain/types.js";

type SchemaNode = {
  properties?: Record<string, unknown>;
  required?: string[];
  discriminator?: { mapping: Record<string, string> };
};

const schemas = openApiSpec.components.schemas as unknown as Record<string, SchemaNode>;

function refName(ref: string): string {
  return ref.replace("#/components/schemas/", "");
}

function schemaFor(name: string): SchemaNode {
  const schema = schemas[name];
  if (!schema) throw new Error(`No schema named "${name}" in the OpenAPI spec.`);
  return schema;
}

function schemaForVariant(unionSchemaName: string, discriminatorValue: string): SchemaNode {
  const union = schemaFor(unionSchemaName);
  const ref = union.discriminator?.mapping[discriminatorValue];
  if (!ref) throw new Error(`${unionSchemaName} has no discriminator mapping for "${discriminatorValue}".`);
  return schemaFor(refName(ref));
}

/** Exact key-set equality: correct for every schema in this document except the two noted below, since none of the real interfaces have optional fields. */
function assertExactKeysSchema(real: object, schema: SchemaNode, path: string) {
  const realKeys = Object.keys(real).sort();
  const specKeys = Object.keys(schema.properties ?? {}).sort();
  expect(realKeys, `${path}: real object's fields don't match the spec's declared properties`).toEqual(specKeys);
}

function assertExactKeys(real: object, schemaName: string, path: string) {
  assertExactKeysSchema(real, schemaFor(schemaName), path);
}

/** Real keys must be declared; declared `required` keys must be present. Used only where a schema has a genuinely optional field (Error.missing, PlanAdjustmentRequest.reason). */
function assertKeysSubset(real: object, schemaName: string, path: string) {
  const schema = schemaFor(schemaName);
  const specKeys = new Set(Object.keys(schema.properties ?? {}));
  const realKeys = Object.keys(real);
  for (const key of realKeys) {
    expect(specKeys.has(key), `${path}: "${key}" is not declared on ${schemaName}`).toBe(true);
  }
  for (const required of schema.required ?? []) {
    expect(realKeys.includes(required), `${path}: required "${required}" missing from the fixture`).toBe(true);
  }
}

/** Two-way check for the one deliberately-flattened union: every field any fixture produced is declared, and every declared field is produced by at least one fixture. */
function assertFlattenedUnion(reals: readonly object[], schemaName: string, path: string) {
  const produced = new Set(reals.flatMap((real) => Object.keys(real)));
  const declared = new Set(Object.keys(schemaFor(schemaName).properties ?? {}));
  expect([...produced].sort(), `${path}: fields produced but not declared in ${schemaName}`).toEqual(
    [...produced].filter((key) => declared.has(key)).sort(),
  );
  expect([...declared].sort(), `${path}: fields declared in ${schemaName} but never produced by any variant`).toEqual(
    [...declared].filter((key) => produced.has(key)).sort(),
  );
}

// --- Fixtures -----------------------------------------------------------

const state = createSeededAppState();
const today = state.plan.startDate;
const targetWorkout = state.plan.weeks
  .flatMap((week) => week.workouts)
  .find((workout) => workout.type !== "rest" && workout.type !== "race" && workout.date.localeCompare(today) > 0);
if (!targetWorkout) throw new Error("Seed plan has no future non-race workout to build write fixtures from.");

const runLogFixture: RunLog = {
  id: "run-fixture-1",
  workoutId: null,
  completedDate: today,
  activityType: "long",
  distanceMiles: 8,
  durationSeconds: 4200,
  effort: "great",
  notes: "private reflections, never projected",
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

const crewRowFixture: ExternalCrewSummaryRow = {
  crewName: "Night Shift",
  role: "member",
  weeklyMiles: 12,
  longestRun28dMiles: 9,
  consistencyCompleted: 3,
  consistencyDue: 4,
  milesBuilt: 40,
};

const planAdjustmentRowFixture: ExternalPlanAdjustmentRow = {
  appliedAt: "2026-08-10T12:00:00Z",
  kind: "apply",
  operations: [{ op: "skip", workoutId: targetWorkout.id }],
  reason: "fixture",
  reverted: false,
};

const context: ExternalTrainingContext = {
  ...projectExternalTrainingContext(
    { ...state, runLogs: [runLogFixture] },
    today,
    [crewRowFixture],
    [planAdjustmentRowFixture],
  ),
  // Real signal computation over a fresh seeded plan won't reliably produce
  // all 6 families at once; these fixtures are hand-built and explicitly
  // typed instead, so they still carry the compile-time drift guard.
  signals: [
    {
      id: "volume-trend",
      family: "volume",
      title: "Volume",
      priority: 1,
      isPresentable: true,
      unavailableReason: null,
      direction: "rising",
      headline: "Your weekly mileage is up.",
      support: "32 miles over the last 28 days vs. 24 the 28 before.",
      windowLabel: "Last 28d vs prior 28d",
      current: { startDate: "2026-07-30", endDate: "2026-08-26", days: 28, runCount: 8 },
      baseline: { startDate: "2026-07-02", endDate: "2026-07-29", days: 28, runCount: 6 },
      coverage: {
        currentPresent: 8,
        currentTotal: 8,
        currentRatio: 1,
        baselinePresent: 6,
        baselineTotal: 6,
        baselineRatio: 1,
      },
      supportingRunIds: ["run-fixture-1"],
      facts: { currentMiles: 32, baselineMiles: 24, differenceMiles: 8, changeRatio: 0.33 },
    },
    {
      id: "run-frequency",
      family: "frequency",
      title: "Frequency",
      priority: 2,
      isPresentable: true,
      unavailableReason: null,
      direction: "steady",
      headline: "You're running about as often as before.",
      support: "4 runs a week vs. 4 before.",
      windowLabel: "Last 28d vs prior 28d",
      current: { startDate: "2026-07-30", endDate: "2026-08-26", days: 28, runCount: 8 },
      baseline: null,
      coverage: null,
      supportingRunIds: [],
      facts: {
        currentRunsPerWeek: 4,
        baselineRunsPerWeek: 4,
        differenceRunsPerWeek: 0,
        currentRunCount: 8,
        baselineRunCount: 8,
      },
    },
    {
      id: "long-run-progression",
      family: "long-run",
      title: "Long runs",
      priority: 3,
      isPresentable: true,
      unavailableReason: null,
      direction: "rising",
      headline: "Your long run is getting longer.",
      support: "10 miles vs. 8 before.",
      windowLabel: "Last 28d vs prior 28d",
      current: { startDate: "2026-07-30", endDate: "2026-08-26", days: 28, runCount: 8 },
      baseline: null,
      coverage: null,
      supportingRunIds: ["run-fixture-1"],
      facts: {
        currentMiles: 10,
        baselineMiles: 8,
        differenceMiles: 2,
        changeRatio: 0.25,
        currentRunId: "run-fixture-1",
        baselineRunId: null,
      },
    },
    {
      id: "workload-trend",
      family: "workload",
      title: "Workload",
      priority: 4,
      isPresentable: true,
      unavailableReason: null,
      direction: "falling",
      headline: "Training load is down.",
      support: "220 vs. 260 before.",
      windowLabel: "Last 28d vs prior 28d",
      current: { startDate: "2026-07-30", endDate: "2026-08-26", days: 28, runCount: 8 },
      baseline: null,
      coverage: null,
      supportingRunIds: [],
      facts: { currentLoad: 220, baselineLoad: 260, differenceLoad: -40, changeRatio: -0.15 },
    },
    {
      id: "zone-distribution",
      family: "zone-distribution",
      title: "Zone mix",
      priority: 5,
      isPresentable: true,
      unavailableReason: null,
      direction: "steady",
      headline: "Your easy/hard mix hasn't changed much.",
      support: "68% low-zone vs. 66% before.",
      windowLabel: "Last 28d vs prior 28d",
      current: { startDate: "2026-07-30", endDate: "2026-08-26", days: 28, runCount: 8 },
      baseline: null,
      coverage: null,
      supportingRunIds: [],
      facts: {
        currentLowerShare: 0.68,
        baselineLowerShare: 0.66,
        differenceShare: 0.02,
        zoneCount: 5,
        lowerZoneCount: 2,
        currentZoneSeconds: [1000, 2000, 500, 200, 100],
        baselineZoneSeconds: [900, 1800, 600, 250, 150],
      },
    },
    {
      id: "plan-completion",
      family: "plan-context",
      title: "Plan context",
      priority: 6,
      isPresentable: true,
      unavailableReason: null,
      direction: "steady",
      headline: "You're keeping up with the plan.",
      support: "7 of 8 scheduled runs completed.",
      windowLabel: null,
      current: { startDate: "2026-07-30", endDate: "2026-08-26", days: 28, runCount: 8 },
      baseline: null,
      coverage: null,
      supportingRunIds: [],
      facts: { completed: 7, due: 8, percentage: 88, weekCount: 4, extraRuns: 1 },
    },
  ],
};

const placedBlockFixture: ExternalPlacedBlock = {
  row: 1,
  columnStart: 1,
  width: 1,
  height: 1,
  activityType: "easy",
  distanceMiles: 3,
};

const raceGoalFixtures: RaceGoal[] = [
  { type: "none" },
  { type: "finish" },
  { type: "time", targetFinishSeconds: 3600 },
  { type: "pace", targetPaceSecondsPerMile: 480 },
];

const operationFixtures: PlanAdjustmentOperation[] = [
  { op: "move", workoutId: targetWorkout.id, toDate: "2026-09-01" },
  {
    op: "editRun",
    workoutId: targetWorkout.id,
    values: { type: "easy", title: "Easy run", targetDistanceMiles: "4", details: "" },
  },
  {
    op: "addRun",
    workoutId: targetWorkout.id,
    values: { type: "cross", title: "Cross training", targetDistanceMiles: null, details: "" },
  },
  { op: "skip", workoutId: targetWorkout.id },
];

const patchedPlan = applyPlanAdjustments(state.plan, today, [{ op: "skip", workoutId: targetWorkout.id }]);
const applyResponseFixture = {
  adjustmentId: "fixture-adjustment-id",
  plan: projectPlan(patchedPlan, [], today),
  revision: patchedPlan.revision,
};
const undoResponseFixture = { plan: projectPlan(patchedPlan, [], today), revision: patchedPlan.revision };

// --- Assertions -----------------------------------------------------------

describe("openapi spec matches the real response/request shapes", () => {
  it("ExternalTrainingContext, top-level and every nested object", () => {
    assertExactKeys(context, "ExternalTrainingContext", "training-context response");
    expect(context.plan, "seed plan should project to a non-null plan").not.toBeNull();
    assertExactKeys(context.plan!, "ExternalPlanContext", "response.plan");
    expect(context.plan!.nextScheduledWorkout, "seed plan should have a next scheduled workout").not.toBeNull();
    assertExactKeys(context.plan!.nextScheduledWorkout!, "ExternalUpcomingWorkout", "response.plan.nextScheduledWorkout");
    context.plan!.upcomingWorkouts.forEach((workout, i) =>
      assertExactKeys(workout, "ExternalUpcomingWorkout", `response.plan.upcomingWorkouts[${i}]`),
    );
    expect(context.raceGoal, "seed plan should have a race goal").not.toBeNull();
    assertExactKeys(context.raceGoal!, "ExternalRaceGoal", "response.raceGoal");
    expect(context.recentRuns.length, "expected the fixture run to land in the recent-runs window").toBeGreaterThan(0);
    context.recentRuns.forEach((run, i) => assertExactKeys(run, "ExternalRun", `response.recentRuns[${i}]`));
    assertExactKeys(context.build, "ExternalBuildContext", "response.build");
    assertExactKeys(placedBlockFixture, "ExternalPlacedBlock", "ExternalPlacedBlock fixture");
    context.crew.forEach((crew, i) => assertExactKeys(crew, "ExternalCrewSummary", `response.crew[${i}]`));
    context.planAdjustments.forEach((adjustment, i) =>
      assertExactKeys(adjustment, "ExternalPlanAdjustment", `response.planAdjustments[${i}]`),
    );
  });

  it("TrainingSignal: base shape, nested windows, and the flattened facts union", () => {
    context.signals.forEach((signal, i) => {
      assertExactKeys(signal, "TrainingSignal", `response.signals[${i}]`);
      assertExactKeys(signal.current, "SignalWindow", `response.signals[${i}].current`);
      if (signal.baseline) assertExactKeys(signal.baseline, "SignalWindow", `response.signals[${i}].baseline`);
      if (signal.coverage) assertExactKeys(signal.coverage, "SignalWindowCoverage", `response.signals[${i}].coverage`);
    });
    const allFacts = context.signals.map((signal) => signal.facts).filter((facts): facts is NonNullable<typeof facts> => facts !== null);
    expect(allFacts).toHaveLength(context.signals.length);
    assertFlattenedUnion(allFacts, "TrainingSignalFacts", "signals[].facts");
  });

  it("RaceGoal: every variant matches its discriminated branch", () => {
    raceGoalFixtures.forEach((goal) => {
      assertExactKeysSchema(goal, schemaForVariant("RaceGoal", goal.type), `RaceGoal(${goal.type})`);
    });
  });

  it("PlanAdjustmentOperation: every op kind matches its discriminated branch", () => {
    operationFixtures.forEach((operation) => {
      assertExactKeysSchema(operation, schemaForVariant("PlanAdjustmentOperation", operation.op), `PlanAdjustmentOperation(${operation.op})`);
      if (operation.op === "editRun" || operation.op === "addRun") {
        assertExactKeys(operation.values, "PlannedRunValues", `PlanAdjustmentOperation(${operation.op}).values`);
      }
    });
  });

  it("POST/DELETE /api/plan-adjustments request and response shapes", () => {
    assertKeysSubset(
      { operations: operationFixtures, expectedPlanRevision: state.plan.revision, reason: "fixture" },
      "PlanAdjustmentRequest",
      "POST request body",
    );
    assertExactKeys(applyResponseFixture, "PlanAdjustmentApplyResponse", "POST response");
    assertExactKeys(applyResponseFixture.plan, "ExternalPlanContext", "POST response.plan");
    assertExactKeys(undoResponseFixture, "PlanAdjustmentUndoResponse", "DELETE response");
  });

  it("Error envelope covers both the plain and the not_configured shape", () => {
    assertKeysSubset({ error: "unauthorized", message: "That token is not valid." }, "Error", "plain error");
    assertKeysSubset(
      { error: "not_configured", message: "Not configured.", missing: "SUPABASE_URL" },
      "Error",
      "error with missing field",
    );
  });
});
