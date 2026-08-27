/**
 * The OpenAPI 3.0.3 document describing STACK's external-assistant surface
 * (#178/#180/#181, Evolution 2.10) — the one artifact ChatGPT's Custom GPT
 * "Actions" feature needs before it can call `GET /api/training-context` or
 * `POST`/`DELETE /api/plan-adjustments` at all. Served by `api/openapi.ts`.
 *
 * Hand-written, not generated — this repo carries no schema-validation
 * dependency (no zod, no ajv) and adding one for a single spec file is not
 * worth it. Instead, `api/_openapiSpec.test.ts` guards against this document
 * drifting from the real route shapes: its fixtures are typed against the
 * actual exported interfaces (`ExternalTrainingContext`, `TrainingSignal`,
 * `RaceGoal`, `PlanAdjustmentOperation`, …), so TypeScript's own
 * excess/missing-property checking catches interface drift at build time,
 * and a runtime key-diff there proves this document's `properties` lists
 * still match those fixtures field-for-field.
 *
 * 3.0.3 over 3.1: this document is dense with nullable fields, and 3.0's
 * `nullable: true` is the most broadly-compatible way to say that — 3.1's
 * `type: [x, "null"]` array form is more prone to tripping up a casual
 * importer like ChatGPT's, and nothing here needs a 3.1-only feature.
 *
 * `RaceGoal` and `PlanAdjustmentOperation` are small (four variants each, in
 * one object) and use `oneOf` + `discriminator` — the idiomatic shape at
 * that size. `TrainingSignal.facts` is different: six variants, but sitting
 * inside a large array in *every* response, which is where Actions' `oneOf`
 * support has the roughest edges. So `TrainingSignalFacts` is flattened
 * instead — one object holding the union of every family's fields, each
 * nullable — which is also closer to what an LLM client actually needs:
 * read `family`, then read whichever numeric fields came back non-null.
 */

const RUN_ACTIVITY_TYPE_ENUM = ["easy", "intervals", "simulation", "long", "race", "cross"];

const errorResponse = (description: string) => ({
  description,
  content: {
    "application/json": { schema: { $ref: "#/components/schemas/Error" } },
  },
});

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "STACK External Training API",
    version: "1.0.0",
    description:
      "The read-only training context and future-plan write surface a runner authorizes their own external assistant (ChatGPT, or anything else) to use. STACK stays the source of truth: this API makes no AI/model calls itself, and everything it accepts or returns is a named, versioned STACK shape — never a raw database row. Full contract: https://github.com/2rscrw8cmn-lang/stack-run/blob/main/docs/EXTERNAL_INTEGRATION.md",
  },
  servers: [{ url: "https://stack-run.vercel.app" }],
  security: [{ bearerAuth: [] }],
  paths: {
    "/api/training-context": {
      get: {
        operationId: "getTrainingContext",
        summary: "Read the runner's own training context",
        description:
          "Returns the runner's active plan, upcoming workouts, recent runs, Build progress, Training Signals, Crew membership summary, and recent plan-adjustment history. Returns 200 with an honestly empty context (plan: null, empty arrays) if the account has never synced to STACK's cloud — that is not an error.",
        responses: {
          "200": {
            description: "The runner's training context.",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ExternalTrainingContext" } },
            },
          },
          "401": errorResponse("The bearer token is missing, malformed, unknown, or revoked."),
          "405": errorResponse("Wrong HTTP method — this endpoint answers GET only."),
          "502": errorResponse("STACK's own backend could not be reached."),
          "503": errorResponse("This deployment is not configured for external access."),
          "504": errorResponse("STACK's own backend took too long to answer."),
        },
      },
    },
    "/api/plan-adjustments": {
      post: {
        operationId: "applyPlanAdjustment",
        summary: "Adjust one or more of the runner's future, non-race workouts",
        description:
          "Applies a batch of operations to the runner's active plan as one atomic change: the first invalid operation rejects the whole batch, nothing partial is ever saved. Only future workouts (date after today) can be touched, and race day is never editable through this endpoint. `expectedPlanRevision` must equal the `revision` field currently visible on `plan` in the training context — a stale value (the plan changed since it was last read) is rejected with 409 rather than silently overwritten. Requires a read_write-scoped token; a read-scoped token gets 403.",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/PlanAdjustmentRequest" } },
          },
        },
        responses: {
          "200": {
            description: "The adjustment was applied. Returns the new plan and its bumped revision.",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/PlanAdjustmentApplyResponse" } },
            },
          },
          "400": errorResponse("The request body is malformed or missing a required field."),
          "401": errorResponse("The bearer token is missing, malformed, unknown, or revoked."),
          "403": errorResponse("This token is read-only and cannot make plan changes."),
          "409": errorResponse(
            "`expectedPlanRevision` is stale, or the requested edit touches something this surface cannot change (race day, a past workout, or a field other than a workout's own future-scheduled details).",
          ),
          "422": errorResponse("There is no active plan, or an operation named an unknown or ineligible workout."),
          "502": errorResponse("STACK's own backend could not complete this change."),
          "503": errorResponse("This deployment is not configured for external access."),
          "504": errorResponse("STACK's own backend took too long to answer."),
        },
      },
      delete: {
        operationId: "undoPlanAdjustment",
        summary: "Undo one prior plan adjustment",
        description:
          "Reverts exactly one prior adjustment by the `adjustmentId` returned when it was applied, restoring the exact pre-change value of every workout that adjustment touched. Fails with 409 if the plan has changed since — including a manual edit the runner made in the app, which always wins over a stale undo. Requires a read_write-scoped token; a read-scoped token gets 403.",
        parameters: [
          {
            name: "id",
            in: "query",
            required: true,
            description: "The adjustmentId returned by a prior POST /api/plan-adjustments.",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "The adjustment was undone. Returns the restored plan and its bumped revision.",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/PlanAdjustmentUndoResponse" } },
            },
          },
          "400": errorResponse("The `id` query parameter is missing."),
          "401": errorResponse("The bearer token is missing, malformed, unknown, or revoked."),
          "403": errorResponse("This token is read-only and cannot make plan changes."),
          "404": errorResponse("No adjustment with that id exists for this account."),
          "409": errorResponse("The plan has changed since this adjustment landed, so it can no longer be undone."),
          "502": errorResponse("STACK's own backend could not complete this change."),
          "503": errorResponse("This deployment is not configured for external access."),
          "504": errorResponse("STACK's own backend took too long to answer."),
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        description:
          "A personal, revocable token created in STACK under Settings → Account & Crew → your profile row → External Assistant Access. A read-scoped token may only call GET /api/training-context; a read_write-scoped token may also call POST/DELETE /api/plan-adjustments. Tokens do not expire on their own — revoking one in Settings is the only way it stops working.",
      },
    },
    schemas: {
      Error: {
        type: "object",
        required: ["error", "message"],
        properties: {
          error: { type: "string", description: "A stable machine-readable error code, e.g. unauthorized." },
          message: { type: "string", description: "A human-readable explanation." },
          missing: { type: "string", description: "Present only on a 503 not_configured response." },
        },
      },

      RaceGoalNone: {
        type: "object",
        required: ["type"],
        properties: { type: { type: "string", enum: ["none"] } },
      },
      RaceGoalFinish: {
        type: "object",
        required: ["type"],
        properties: { type: { type: "string", enum: ["finish"] } },
      },
      RaceGoalTime: {
        type: "object",
        required: ["type", "targetFinishSeconds"],
        properties: {
          type: { type: "string", enum: ["time"] },
          targetFinishSeconds: { type: "integer" },
        },
      },
      RaceGoalPace: {
        type: "object",
        required: ["type", "targetPaceSecondsPerMile"],
        properties: {
          type: { type: "string", enum: ["pace"] },
          targetPaceSecondsPerMile: { type: "integer" },
        },
      },
      RaceGoal: {
        description:
          "What the runner is training toward. `none` is a real, explicit answer — the runner has not stated a goal — never a missing field.",
        oneOf: [
          { $ref: "#/components/schemas/RaceGoalNone" },
          { $ref: "#/components/schemas/RaceGoalFinish" },
          { $ref: "#/components/schemas/RaceGoalTime" },
          { $ref: "#/components/schemas/RaceGoalPace" },
        ],
        discriminator: {
          propertyName: "type",
          mapping: {
            none: "#/components/schemas/RaceGoalNone",
            finish: "#/components/schemas/RaceGoalFinish",
            time: "#/components/schemas/RaceGoalTime",
            pace: "#/components/schemas/RaceGoalPace",
          },
        },
      },

      ExternalUpcomingWorkout: {
        type: "object",
        required: ["id", "date", "type", "title", "targetDistanceMiles", "details"],
        properties: {
          id: { type: "string", description: "The workoutId a PlanAdjustmentOperation targets." },
          date: { type: "string", format: "date" },
          type: { type: "string", enum: RUN_ACTIVITY_TYPE_ENUM },
          title: { type: "string" },
          targetDistanceMiles: { type: "string", nullable: true },
          details: { type: "string" },
        },
      },

      ExternalPlanContext: {
        type: "object",
        required: [
          "name",
          "startDate",
          "endDate",
          "currentWeekNumber",
          "totalWeeks",
          "scheduledRunsThisWeek",
          "completedRunsThisWeek",
          "nextScheduledWorkout",
          "upcomingWorkouts",
          "revision",
        ],
        properties: {
          name: { type: "string" },
          startDate: { type: "string", format: "date" },
          endDate: { type: "string", format: "date" },
          currentWeekNumber: { type: "integer" },
          totalWeeks: { type: "integer" },
          scheduledRunsThisWeek: { type: "integer" },
          completedRunsThisWeek: { type: "integer" },
          nextScheduledWorkout: {
            nullable: true,
            allOf: [{ $ref: "#/components/schemas/ExternalUpcomingWorkout" }],
          },
          upcomingWorkouts: {
            type: "array",
            description: "Every remaining scheduled run through the end of the plan, within a 21-day window.",
            items: { $ref: "#/components/schemas/ExternalUpcomingWorkout" },
          },
          revision: {
            type: "integer",
            description: "Pass this as expectedPlanRevision on POST /api/plan-adjustments.",
          },
        },
      },

      ExternalRaceGoal: {
        type: "object",
        required: ["name", "date", "distanceMiles", "goal"],
        properties: {
          name: { type: "string" },
          date: { type: "string", format: "date" },
          distanceMiles: { type: "number" },
          goal: { $ref: "#/components/schemas/RaceGoal" },
        },
      },

      ExternalRun: {
        type: "object",
        required: [
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
        ],
        properties: {
          id: { type: "string" },
          date: { type: "string", format: "date" },
          startTimeLocal: { type: "string", nullable: true },
          distanceMiles: { type: "number" },
          durationSeconds: { type: "integer", nullable: true },
          paceSecondsPerMile: { type: "number", nullable: true },
          averageHeartRate: { type: "integer", nullable: true },
          maxHeartRate: { type: "integer", nullable: true },
          elevationGainFeet: { type: "number", nullable: true },
          averageCadence: { type: "number", nullable: true },
          trainingLoad: { type: "number", nullable: true },
          activityType: {
            type: "string",
            enum: RUN_ACTIVITY_TYPE_ENUM,
            nullable: true,
            description: "Null when this run has no STACK-owned facts — a history-only activity.",
          },
          effort: { type: "string", enum: ["rough", "solid", "great"], nullable: true },
          source: { type: "string", enum: ["manual", "intervals"], nullable: true },
          isExtra: { type: "boolean", nullable: true },
          hasPlacedBlock: { type: "boolean", nullable: true },
        },
      },

      ExternalPlacedBlock: {
        type: "object",
        required: ["row", "columnStart", "width", "height", "activityType", "distanceMiles"],
        properties: {
          row: { type: "integer" },
          columnStart: { type: "integer" },
          width: { type: "integer" },
          height: { type: "integer" },
          activityType: { type: "string", enum: RUN_ACTIVITY_TYPE_ENUM },
          distanceMiles: { type: "number" },
        },
      },

      ExternalBuildContext: {
        type: "object",
        required: ["pendingBlockCount", "placedBlockCount", "courses", "placedBlocks"],
        properties: {
          pendingBlockCount: { type: "integer" },
          placedBlockCount: { type: "integer" },
          courses: { type: "integer" },
          placedBlocks: { type: "array", items: { $ref: "#/components/schemas/ExternalPlacedBlock" } },
        },
      },

      ExternalCrewSummary: {
        type: "object",
        required: [
          "crewName",
          "role",
          "weeklyMiles",
          "longestRun28dMiles",
          "consistencyCompleted",
          "consistencyDue",
          "milesBuilt",
        ],
        properties: {
          crewName: { type: "string" },
          role: { type: "string", enum: ["owner", "member"] },
          weeklyMiles: { type: "number" },
          longestRun28dMiles: { type: "number" },
          consistencyCompleted: { type: "integer" },
          consistencyDue: { type: "integer" },
          milesBuilt: { type: "number" },
        },
      },

      ExternalPlanAdjustment: {
        type: "object",
        required: ["appliedAt", "kind", "operations", "reason", "reverted"],
        properties: {
          appliedAt: { type: "string", format: "date-time" },
          kind: { type: "string", enum: ["apply", "undo"] },
          operations: { type: "array", items: {}, description: "The operations this adjustment applied." },
          reason: { type: "string", nullable: true },
          reverted: { type: "boolean" },
        },
      },

      SignalWindow: {
        type: "object",
        required: ["startDate", "endDate", "days", "runCount"],
        properties: {
          startDate: { type: "string", format: "date" },
          endDate: { type: "string", format: "date" },
          days: { type: "integer" },
          runCount: { type: "integer" },
        },
      },

      SignalWindowCoverage: {
        type: "object",
        required: ["currentPresent", "currentTotal", "currentRatio", "baselinePresent", "baselineTotal", "baselineRatio"],
        properties: {
          currentPresent: { type: "integer" },
          currentTotal: { type: "integer" },
          currentRatio: { type: "number" },
          baselinePresent: { type: "integer" },
          baselineTotal: { type: "integer" },
          baselineRatio: { type: "number" },
        },
      },

      TrainingSignalFacts: {
        type: "object",
        description:
          "Which fields are populated depends on the signal's family: volume/long-run → currentMiles/baselineMiles/differenceMiles/changeRatio (long-run also currentRunId/baselineRunId); frequency → currentRunsPerWeek/baselineRunsPerWeek/differenceRunsPerWeek/currentRunCount/baselineRunCount; workload → currentLoad/baselineLoad/differenceLoad/changeRatio; zone-distribution → currentLowerShare/baselineLowerShare/differenceShare/zoneCount/lowerZoneCount/currentZoneSeconds/baselineZoneSeconds; plan-context → completed/due/percentage/weekCount/extraRuns.",
        properties: {
          currentMiles: { type: "number", nullable: true },
          baselineMiles: { type: "number", nullable: true },
          differenceMiles: { type: "number", nullable: true },
          changeRatio: { type: "number", nullable: true },
          currentRunsPerWeek: { type: "number", nullable: true },
          baselineRunsPerWeek: { type: "number", nullable: true },
          differenceRunsPerWeek: { type: "number", nullable: true },
          currentRunCount: { type: "integer", nullable: true },
          baselineRunCount: { type: "integer", nullable: true },
          currentRunId: { type: "string", nullable: true },
          baselineRunId: { type: "string", nullable: true },
          currentLoad: { type: "number", nullable: true },
          baselineLoad: { type: "number", nullable: true },
          differenceLoad: { type: "number", nullable: true },
          currentLowerShare: { type: "number", nullable: true },
          baselineLowerShare: { type: "number", nullable: true },
          differenceShare: { type: "number", nullable: true },
          zoneCount: { type: "integer", nullable: true },
          lowerZoneCount: { type: "integer", nullable: true },
          currentZoneSeconds: { type: "array", items: { type: "integer" }, nullable: true },
          baselineZoneSeconds: { type: "array", items: { type: "integer" }, nullable: true },
          completed: { type: "integer", nullable: true },
          due: { type: "integer", nullable: true },
          percentage: { type: "integer", nullable: true },
          weekCount: { type: "integer", nullable: true },
          extraRuns: { type: "integer", nullable: true },
        },
      },

      TrainingSignal: {
        type: "object",
        required: [
          "id",
          "family",
          "title",
          "priority",
          "isPresentable",
          "unavailableReason",
          "direction",
          "headline",
          "support",
          "windowLabel",
          "current",
          "baseline",
          "coverage",
          "supportingRunIds",
          "facts",
        ],
        properties: {
          id: {
            type: "string",
            enum: ["volume-trend", "run-frequency", "long-run-progression", "workload-trend", "zone-distribution", "plan-completion"],
          },
          family: { type: "string", enum: ["volume", "frequency", "long-run", "workload", "zone-distribution", "plan-context"] },
          title: { type: "string" },
          priority: { type: "integer" },
          isPresentable: { type: "boolean" },
          unavailableReason: { type: "string", nullable: true },
          direction: { type: "string", enum: ["rising", "falling", "steady"], nullable: true },
          headline: { type: "string", nullable: true },
          support: { type: "string", nullable: true },
          windowLabel: { type: "string", nullable: true },
          current: { $ref: "#/components/schemas/SignalWindow" },
          baseline: { nullable: true, allOf: [{ $ref: "#/components/schemas/SignalWindow" }] },
          coverage: { nullable: true, allOf: [{ $ref: "#/components/schemas/SignalWindowCoverage" }] },
          supportingRunIds: { type: "array", items: { type: "string" } },
          facts: {
            nullable: true,
            allOf: [{ $ref: "#/components/schemas/TrainingSignalFacts" }],
            description: "Every signal returned by this endpoint is presentable, so facts is populated in practice.",
          },
        },
      },

      ExternalTrainingContext: {
        type: "object",
        required: ["generatedAt", "plan", "raceGoal", "recentRuns", "build", "signals", "crew", "planAdjustments"],
        properties: {
          generatedAt: { type: "string", format: "date-time" },
          plan: { nullable: true, allOf: [{ $ref: "#/components/schemas/ExternalPlanContext" }] },
          raceGoal: { nullable: true, allOf: [{ $ref: "#/components/schemas/ExternalRaceGoal" }] },
          recentRuns: {
            type: "array",
            description: "Runs from the last 56 days, most recent first.",
            items: { $ref: "#/components/schemas/ExternalRun" },
          },
          build: { $ref: "#/components/schemas/ExternalBuildContext" },
          signals: { type: "array", items: { $ref: "#/components/schemas/TrainingSignal" } },
          crew: { type: "array", items: { $ref: "#/components/schemas/ExternalCrewSummary" } },
          planAdjustments: {
            type: "array",
            description: "Most recent first, capped at 20.",
            items: { $ref: "#/components/schemas/ExternalPlanAdjustment" },
          },
        },
      },

      PlannedRunValues: {
        type: "object",
        required: ["type", "title", "targetDistanceMiles", "details"],
        properties: {
          type: { type: "string", enum: RUN_ACTIVITY_TYPE_ENUM },
          title: { type: "string" },
          targetDistanceMiles: { type: "string", nullable: true },
          details: { type: "string" },
        },
      },

      PlanAdjustmentMove: {
        type: "object",
        required: ["op", "workoutId", "toDate"],
        properties: {
          op: { type: "string", enum: ["move"] },
          workoutId: { type: "string" },
          toDate: { type: "string", format: "date", description: "Must be a future date." },
        },
      },
      PlanAdjustmentEditRun: {
        type: "object",
        required: ["op", "workoutId", "values"],
        properties: {
          op: { type: "string", enum: ["editRun"] },
          workoutId: { type: "string" },
          values: { $ref: "#/components/schemas/PlannedRunValues" },
        },
      },
      PlanAdjustmentAddRun: {
        type: "object",
        required: ["op", "workoutId", "values"],
        properties: {
          op: { type: "string", enum: ["addRun"] },
          workoutId: { type: "string", description: "The id of the rest-day workout slot to fill." },
          values: { $ref: "#/components/schemas/PlannedRunValues" },
        },
      },
      PlanAdjustmentSkip: {
        type: "object",
        required: ["op", "workoutId"],
        properties: {
          op: { type: "string", enum: ["skip"] },
          workoutId: { type: "string" },
        },
      },
      PlanAdjustmentOperation: {
        description: "One change to make to a single workout. move/editRun/addRun/skip — see docs/PLAN_ADJUSTMENTS.md.",
        oneOf: [
          { $ref: "#/components/schemas/PlanAdjustmentMove" },
          { $ref: "#/components/schemas/PlanAdjustmentEditRun" },
          { $ref: "#/components/schemas/PlanAdjustmentAddRun" },
          { $ref: "#/components/schemas/PlanAdjustmentSkip" },
        ],
        discriminator: {
          propertyName: "op",
          mapping: {
            move: "#/components/schemas/PlanAdjustmentMove",
            editRun: "#/components/schemas/PlanAdjustmentEditRun",
            addRun: "#/components/schemas/PlanAdjustmentAddRun",
            skip: "#/components/schemas/PlanAdjustmentSkip",
          },
        },
      },

      PlanAdjustmentRequest: {
        type: "object",
        required: ["operations", "expectedPlanRevision"],
        properties: {
          operations: {
            type: "array",
            minItems: 1,
            description: "Applied as one atomic batch — the first invalid operation rejects the whole request.",
            items: { $ref: "#/components/schemas/PlanAdjustmentOperation" },
          },
          expectedPlanRevision: {
            type: "integer",
            description: "Must equal the plan.revision currently visible in the training context.",
          },
          reason: {
            type: "string",
            nullable: true,
            description: "Optional, shown back in adjustment history. Capped at 500 characters.",
          },
        },
      },

      PlanAdjustmentApplyResponse: {
        type: "object",
        required: ["adjustmentId", "plan", "revision"],
        properties: {
          adjustmentId: { type: "string" },
          plan: { $ref: "#/components/schemas/ExternalPlanContext" },
          revision: { type: "integer" },
        },
      },

      PlanAdjustmentUndoResponse: {
        type: "object",
        required: ["plan", "revision"],
        properties: {
          plan: { $ref: "#/components/schemas/ExternalPlanContext" },
          revision: { type: "integer" },
        },
      },
    },
  },
};
