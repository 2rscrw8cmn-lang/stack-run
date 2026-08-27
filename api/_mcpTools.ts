/**
 * The 3 MCP tool definitions `api/mcp.ts` advertises from `tools/list` —
 * Claude's equivalent of what `api/_openapiSpec.ts` is for ChatGPT's Custom
 * GPT Actions. Same three operations, same underlying routes.
 *
 * Every `inputSchema` below is composed from the literal schema objects
 * `api/_openapiSpec.ts` already exports — never hand-copied — so there is
 * nothing here that can drift from the OpenAPI document by itself (both are
 * still independently guarded against the real TypeScript interfaces by
 * `api/_openapiSpec.test.ts` / `api/_mcpTools.test.ts`, the same
 * "re-validate independently" posture `docs/PLAN_ADJUSTMENTS.md` describes
 * for the SQL layer). The one exception is `undo_plan_adjustment`'s
 * `{adjustmentId}`, hand-written because the REST API takes it as a query
 * parameter, which has no OpenAPI body-schema counterpart to reuse.
 *
 * A standalone MCP tool `inputSchema` has no OpenAPI-style `$ref` registry
 * to resolve against, so anywhere `_openapiSpec.ts` uses `$ref` (only
 * `PlanAdjustmentEditRun.values` / `PlanAdjustmentAddRun.values`, both
 * pointing at `PlannedRunValues`) that `$ref` is replaced with the real
 * `PlannedRunValues` object here, producing a fully self-contained schema.
 */
import { openApiSpec } from "./_openapiSpec.js";

const schemas = openApiSpec.components.schemas;

/** `PlanAdjustmentEditRun`/`PlanAdjustmentAddRun` with `values`'s $ref inlined. */
function withInlinedValues(schema: typeof schemas.PlanAdjustmentEditRun) {
  return {
    ...schema,
    properties: { ...schema.properties, values: schemas.PlannedRunValues },
  };
}

const planAdjustmentOperationSchema = {
  description: schemas.PlanAdjustmentOperation.description,
  oneOf: [
    schemas.PlanAdjustmentMove,
    withInlinedValues(schemas.PlanAdjustmentEditRun),
    withInlinedValues(schemas.PlanAdjustmentAddRun),
    schemas.PlanAdjustmentSkip,
  ],
};

export interface McpTool {
  name: string;
  description: string;
  inputSchema: object;
}

export const mcpTools: readonly McpTool[] = [
  {
    name: "get_training_context",
    description: openApiSpec.paths["/api/training-context"].get.description,
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "apply_plan_adjustment",
    description: openApiSpec.paths["/api/plan-adjustments"].post.description,
    inputSchema: {
      type: "object",
      required: schemas.PlanAdjustmentRequest.required,
      properties: {
        ...schemas.PlanAdjustmentRequest.properties,
        operations: {
          ...schemas.PlanAdjustmentRequest.properties.operations,
          items: planAdjustmentOperationSchema,
        },
      },
    },
  },
  {
    name: "undo_plan_adjustment",
    description: openApiSpec.paths["/api/plan-adjustments"].delete.description,
    inputSchema: {
      type: "object",
      required: ["adjustmentId"],
      properties: {
        adjustmentId: {
          type: "string",
          description: "The adjustmentId returned by a prior apply_plan_adjustment call.",
        },
      },
    },
  },
];
