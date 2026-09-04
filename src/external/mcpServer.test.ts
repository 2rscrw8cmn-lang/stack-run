import { describe, expect, it, vi } from "vitest";
import {
  LATEST_PROTOCOL_VERSION,
  STACK_MCP_TOOLS,
  handleMcpBody,
  handleMcpMessage,
  mcpParseError,
  type StackApiResult,
  type StackExternalApi,
} from "./mcpServer.js";

/**
 * The connector's own contract, with STACK stubbed out entirely. What these
 * assert is that the MCP layer is a faithful translator and nothing more: it
 * invents no authority, hides no failure, and adds no plan logic of its own.
 * That it *reaches* the real STACK contracts correctly is `api/mcp.test.ts`.
 */
function api(overrides: Partial<StackExternalApi> = {}): StackExternalApi {
  const ok = async (): Promise<StackApiResult> => ({ status: 200, body: { ok: true } });
  return {
    getTrainingContext: overrides.getTrainingContext ?? ok,
    applyPlanAdjustment: overrides.applyPlanAdjustment ?? ok,
    undoPlanAdjustment: overrides.undoPlanAdjustment ?? ok,
  };
}

const call = (name: string, args: Record<string, unknown> = {}) => ({
  jsonrpc: "2.0" as const,
  id: 1,
  method: "tools/call",
  params: { name, arguments: args },
});

/** The single text block a tool result carries. */
function text(result: unknown): string {
  const content = (result as { content: { text: string }[] }).content;
  return content[0]!.text;
}

function isError(result: unknown): boolean {
  return (result as { isError?: boolean }).isError === true;
}

describe("MCP connector — protocol", () => {
  it("echoes a protocol version it speaks, and declares only tools", async () => {
    const response = await handleMcpMessage(
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } },
      api(),
    );
    expect(response?.result).toMatchObject({
      protocolVersion: "2025-03-26",
      capabilities: { tools: {} },
      serverInfo: { name: "stack" },
    });
    expect((response?.result as { capabilities: Record<string, unknown> }).capabilities.resources).toBeUndefined();
  });

  it("falls back to the newest version it speaks rather than failing an unknown one", async () => {
    const response = await handleMcpMessage(
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "1999-01-01" } },
      api(),
    );
    expect((response?.result as { protocolVersion: string }).protocolVersion).toBe(LATEST_PROTOCOL_VERSION);
  });

  it("offers exactly the three semantic tools, and no database primitive", async () => {
    const response = await handleMcpMessage({ jsonrpc: "2.0", id: 2, method: "tools/list" }, api());
    const names = (response?.result as { tools: { name: string }[] }).tools.map((tool) => tool.name);
    expect(names).toEqual(["get_training_context", "adjust_training_plan", "undo_plan_adjustment"]);
  });

  it("marks only the read tool read-only, and both writes destructive", () => {
    const byName = Object.fromEntries(STACK_MCP_TOOLS.map((tool) => [tool.name, tool.annotations]));
    expect(byName.get_training_context?.readOnlyHint).toBe(true);
    expect(byName.get_training_context?.destructiveHint).toBe(false);
    expect(byName.adjust_training_plan?.readOnlyHint).toBe(false);
    expect(byName.adjust_training_plan?.destructiveHint).toBe(true);
    expect(byName.undo_plan_adjustment?.readOnlyHint).toBe(false);
    expect(byName.undo_plan_adjustment?.destructiveHint).toBe(true);
  });

  it("answers ping", async () => {
    const response = await handleMcpMessage({ jsonrpc: "2.0", id: 3, method: "ping" }, api());
    expect(response?.result).toEqual({});
  });

  it("says nothing at all to a notification", async () => {
    expect(await handleMcpMessage({ jsonrpc: "2.0", method: "notifications/initialized" }, api())).toBeNull();
  });

  it("reports an unimplemented method as method-not-found", async () => {
    const response = await handleMcpMessage({ jsonrpc: "2.0", id: 4, method: "resources/list" }, api());
    expect(response?.error?.code).toBe(-32601);
  });

  it("rejects a body that is not a JSON-RPC request", async () => {
    const response = await handleMcpMessage({ hello: "there" }, api());
    expect(response?.error?.code).toBe(-32600);
  });

  it("answers a batch with one response per request, skipping notifications", async () => {
    const responses = await handleMcpBody(
      [
        { jsonrpc: "2.0", id: 1, method: "ping" },
        { jsonrpc: "2.0", method: "notifications/initialized" },
        { jsonrpc: "2.0", id: 2, method: "tools/list" },
      ],
      api(),
    );
    expect(Array.isArray(responses)).toBe(true);
    expect((responses as unknown[]).length).toBe(2);
  });

  it("has nothing to answer when a batch is all notifications", async () => {
    expect(await handleMcpBody([{ jsonrpc: "2.0", method: "notifications/initialized" }], api())).toBeNull();
  });

  it("names a parse failure with the reserved JSON-RPC code", () => {
    expect(mcpParseError().error?.code).toBe(-32700);
  });
});

describe("MCP connector — tools", () => {
  it("hands the training context back verbatim", async () => {
    const context = { plan: { name: "Fall Half", revision: 7 }, recentRuns: [] };
    const response = await handleMcpMessage(
      call("get_training_context"),
      api({ getTrainingContext: async () => ({ status: 200, body: context }) }),
    );
    expect(isError(response?.result)).toBe(false);
    expect(JSON.parse(text(response?.result))).toEqual(context);
  });

  it("forwards only the three documented adjustment fields, never the whole argument object", async () => {
    const applyPlanAdjustment = vi.fn(async () => ({ status: 200, body: { adjustmentId: "adj-1" } }));
    await handleMcpMessage(
      call("adjust_training_plan", {
        operations: [{ op: "skip", workoutId: "w-1" }],
        expectedPlanRevision: 4,
        reason: "travelling",
        userId: "someone-else",
        scope: "read_write",
      }),
      api({ applyPlanAdjustment }),
    );
    expect(applyPlanAdjustment).toHaveBeenCalledWith({
      operations: [{ op: "skip", workoutId: "w-1" }],
      expectedPlanRevision: 4,
      reason: "travelling",
    });
  });

  it("passes a missing reason through as null rather than inventing one", async () => {
    const applyPlanAdjustment = vi.fn<StackExternalApi["applyPlanAdjustment"]>(async () => ({ status: 200, body: {} }));
    await handleMcpMessage(
      call("adjust_training_plan", { operations: [{ op: "skip", workoutId: "w-1" }], expectedPlanRevision: 4 }),
      api({ applyPlanAdjustment }),
    );
    expect(applyPlanAdjustment.mock.calls[0]?.[0]).toMatchObject({ reason: null });
  });

  it("refuses an undo with no adjustment id, without calling STACK", async () => {
    const undoPlanAdjustment = vi.fn(async () => ({ status: 200, body: {} }));
    const response = await handleMcpMessage(call("undo_plan_adjustment", {}), api({ undoPlanAdjustment }));
    expect(isError(response?.result)).toBe(true);
    expect(undoPlanAdjustment).not.toHaveBeenCalled();
  });

  it("reports an unknown tool in-band, so the model can correct itself", async () => {
    const response = await handleMcpMessage(call("delete_everything"), api());
    expect(response?.error).toBeUndefined();
    expect(isError(response?.result)).toBe(true);
    expect(text(response?.result)).toMatch(/no tool named/);
  });
});

describe("MCP connector — STACK failures reach the model intact", () => {
  async function failing(status: number, body: unknown): Promise<unknown> {
    const response = await handleMcpMessage(
      call("adjust_training_plan", { operations: [], expectedPlanRevision: 1 }),
      api({ applyPlanAdjustment: async () => ({ status, body }) }),
    );
    return response?.result;
  }

  it("tells a read-only connection what it is, and how the runner would change it", async () => {
    const result = await failing(403, { error: "insufficient_scope", message: "This token is read-only and cannot make plan changes." });
    expect(isError(result)).toBe(true);
    expect(text(result)).toMatch(/read-only/);
    expect(text(result)).toMatch(/insufficient_scope/);
    expect(text(result)).toMatch(/External Assistant Access/);
  });

  it("tells a revoked connection to be reconnected in connector settings, never in conversation", async () => {
    const result = await failing(401, { error: "unauthorized", message: "That token is not valid. It may be malformed or revoked." });
    expect(text(result)).toMatch(/connector settings/);
    expect(text(result)).toMatch(/do not ask them for the token in conversation/i);
  });

  it("sends a stale plan back to a fresh read rather than to a retry", async () => {
    const result = await failing(409, { error: "plan_changed", message: "The plan changed underneath this request." });
    expect(text(result)).toMatch(/get_training_context/);
  });

  it("does not let an outage be read as a settled outcome", async () => {
    const result = await failing(502, { error: "upstream_unavailable", message: "STACK's own database could not be reached." });
    expect(text(result)).toMatch(/do not assume whether a write landed/i);
  });

  it("passes an unrecognized failure through without inventing a diagnosis", async () => {
    const result = await failing(418, {});
    expect(isError(result)).toBe(true);
    expect(text(result)).toMatch(/418/);
  });

  it("never repackages a STACK failure as a JSON-RPC transport error", async () => {
    const response = await handleMcpMessage(
      call("get_training_context"),
      api({ getTrainingContext: async () => ({ status: 401, body: { error: "unauthorized", message: "no" } }) }),
    );
    expect(response?.error).toBeUndefined();
    expect(isError(response?.result)).toBe(true);
  });
});
