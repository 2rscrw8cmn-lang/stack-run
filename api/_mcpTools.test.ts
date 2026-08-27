/**
 * The drift guard for `api/_mcpTools.ts`, mirroring `api/_openapiSpec.test.ts`'s
 * approach: fixtures typed against the real `PlanAdjustmentOperation` union,
 * checked for exact key-set equality against each tool schema's declared
 * properties.
 */
import { describe, expect, it } from "vitest";
import { mcpTools } from "./_mcpTools.js";
import type { PlanAdjustmentOperation } from "../src/domain/planAdjustment.js";

type SchemaNode = {
  type?: string;
  properties?: Record<string, SchemaNode & { enum?: string[] }>;
  required?: string[];
  oneOf?: SchemaNode[];
};

function schemaFor(name: string): SchemaNode {
  const tool = mcpTools.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`No MCP tool named "${name}".`);
  return tool.inputSchema as SchemaNode;
}

function assertExactKeys(real: object, schema: SchemaNode, path: string) {
  const realKeys = Object.keys(real).sort();
  const specKeys = Object.keys(schema.properties ?? {}).sort();
  expect(realKeys, `${path}: real object's fields don't match the tool schema's declared properties`).toEqual(specKeys);
}

const operationFixtures: PlanAdjustmentOperation[] = [
  { op: "move", workoutId: "w-1", toDate: "2026-09-01" },
  { op: "editRun", workoutId: "w-1", values: { type: "easy", title: "Easy run", targetDistanceMiles: "4", details: "" } },
  { op: "addRun", workoutId: "w-1", values: { type: "cross", title: "Cross training", targetDistanceMiles: null, details: "" } },
  { op: "skip", workoutId: "w-1" },
];

describe("MCP tool schemas match the real request shapes", () => {
  it("lists exactly the 3 expected tools, each with a non-empty description", () => {
    expect(mcpTools.map((tool) => tool.name).sort()).toEqual([
      "apply_plan_adjustment",
      "get_training_context",
      "undo_plan_adjustment",
    ]);
    mcpTools.forEach((tool) => expect(tool.description.length, tool.name).toBeGreaterThan(0));
  });

  it("get_training_context takes no arguments", () => {
    expect(schemaFor("get_training_context").properties).toEqual({});
  });

  it("apply_plan_adjustment: top-level request fields", () => {
    const schema = schemaFor("apply_plan_adjustment");
    expect(schema.required).toEqual(["operations", "expectedPlanRevision"]);
    expect(Object.keys(schema.properties ?? {}).sort()).toEqual(["expectedPlanRevision", "operations", "reason"]);
  });

  it("apply_plan_adjustment: every PlanAdjustmentOperation variant matches its oneOf branch, self-contained (no $ref)", () => {
    const operations = schemaFor("apply_plan_adjustment").properties?.operations as { items?: SchemaNode } | undefined;
    const variants = operations?.items?.oneOf ?? [];
    expect(variants.length).toBe(4);

    operationFixtures.forEach((operation) => {
      const variant = variants.find((candidate) => candidate.properties?.op?.enum?.[0] === operation.op);
      if (!variant) throw new Error(`No oneOf branch for op "${operation.op}".`);
      assertExactKeys(operation, variant, `PlanAdjustmentOperation(${operation.op})`);
      if (operation.op === "editRun" || operation.op === "addRun") {
        const valuesSchema = variant.properties?.values;
        if (!valuesSchema) throw new Error(`${operation.op} branch has no "values" schema.`);
        assertExactKeys(operation.values, valuesSchema, `PlanAdjustmentOperation(${operation.op}).values`);
        expect(valuesSchema.oneOf, `${operation.op}.values must be inlined, not a $ref`).toBeUndefined();
        expect((valuesSchema as { $ref?: string }).$ref, `${operation.op}.values must be inlined, not a $ref`).toBeUndefined();
      }
    });
  });

  it("undo_plan_adjustment requires adjustmentId", () => {
    const schema = schemaFor("undo_plan_adjustment");
    expect(schema.required).toEqual(["adjustmentId"]);
    expect(Object.keys(schema.properties ?? {})).toEqual(["adjustmentId"]);
  });
});
