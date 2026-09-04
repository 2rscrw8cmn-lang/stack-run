// #183 (Evolution 2.10F): the one check in this repo that makes an actual
// network request to a *deployed* STACK — everything else exercises route
// handlers in-process (vitest) or SQL over a local docker socket. This is
// the closest thing to "a real client proved the workflow works" available
// without a live ChatGPT session: point it at a preview or production URL
// with a real bearer token and it walks the same journey a connected
// assistant would, over real HTTP.
//
//   node scripts/verify-external-integration.mjs --base-url https://<deployment>
//
// Token comes from --token or STACK_VERIFY_TOKEN — never pass it any other
// way, and never expect this script to print it back.
//
// #181 extends it to the connector: the same run also completes an MCP
// handshake against POST /mcp, lists the tool surface, and calls
// `get_training_context` the way a connected assistant does — so "a real
// client could connect to this deployment" is checked, not assumed.
//
// Default run is read-only (GET /api/training-context, plus the connector's
// handshake and read tool) — safe against any
// real account at any time. Pass --allow-write to additionally apply and
// undo one small, reversible change and exercise the write failure paths;
// only do this against a token you're comfortable seeing one real
// (immediately-undone) plan edit.

import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  options: {
    "base-url": { type: "string" },
    token: { type: "string" },
    "allow-write": { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
});

if (args.help || !args["base-url"]) {
  console.log(
    "Usage: node scripts/verify-external-integration.mjs --base-url <url> [--token <token>] [--allow-write]\n" +
      "Token may also come from the STACK_VERIFY_TOKEN environment variable.",
  );
  process.exit(args.help ? 0 : 1);
}

const baseUrl = args["base-url"].replace(/\/$/, "");
const token = args.token ?? process.env.STACK_VERIFY_TOKEN;
if (!token) {
  console.error("No token given. Pass --token or set STACK_VERIFY_TOKEN.");
  process.exit(1);
}

let failures = 0;

function step(name, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

async function call(method, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await response.json();
  } catch {
    // A non-JSON body is itself a fact the caller may need to report.
  }
  return { status: response.status, json };
}

let rpcId = 0;

/** One JSON-RPC call against the connector, exactly as an MCP client makes it. */
async function rpc(method, params) {
  rpcId += 1;
  const response = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: rpcId, method, params }),
  });
  let json = null;
  try {
    json = await response.json();
  } catch {
    // Same reasoning as `call` — report the status, don't invent a body.
  }
  return { status: response.status, json };
}

/**
 * #181: the connector is what a real assistant actually talks to, so the
 * handshake and the read tool are exercised over real HTTP too. Read-only,
 * and safe against any account: `tools/call` here only ever calls
 * `get_training_context`. The write tools ride the same REST contracts the
 * `--allow-write` section below already proves end to end.
 */
async function verifyConnector() {
  console.log("\nConnector (remote MCP) — the path a connected assistant takes\n");

  const unauthorized = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 0, method: "initialize", params: {} }),
  });
  step(
    "a connector configured with no token is refused",
    unauthorized.status === 401 && /^Bearer/.test(unauthorized.headers.get("www-authenticate") ?? ""),
    `status ${unauthorized.status}`,
  );

  const initialized = await rpc("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "verify-external-integration", version: "1.0.0" },
  });
  step(
    "initialize handshake succeeds",
    initialized.status === 200 && Boolean(initialized.json?.result?.protocolVersion),
    `status ${initialized.status}, protocol ${initialized.json?.result?.protocolVersion ?? "?"}`,
  );
  if (initialized.status !== 200) {
    step("cannot continue without a handshake", false, JSON.stringify(initialized.json));
    return;
  }

  const listed = await rpc("tools/list", {});
  const names = (listed.json?.result?.tools ?? []).map((tool) => tool.name);
  step(
    "the three semantic tools are offered",
    ["get_training_context", "adjust_training_plan", "undo_plan_adjustment"].every((name) => names.includes(name)),
    names.join(", ") || "none",
  );

  const read = await rpc("tools/call", { name: "get_training_context", arguments: {} });
  const result = read.json?.result;
  const isError = result?.isError === true;
  step("get_training_context returns this runner's context", read.status === 200 && !isError,
    isError ? String(result?.content?.[0]?.text) : `status ${read.status}`);
  if (read.status === 200 && !isError) {
    let context = null;
    try {
      context = JSON.parse(result.content[0].text);
    } catch {
      // Reported by the next step rather than thrown.
    }
    step("the tool result parses as an ExternalTrainingContext", Boolean(context?.generatedAt),
      context?.plan ? `plan "${context.plan.name}", revision ${context.plan.revision}` : "no active plan (honest empty state)");
  }

  const unknown = await rpc("tools/call", { name: "definitely_not_a_stack_tool", arguments: {} });
  step(
    "an unknown tool is reported in-band, not as a transport failure",
    unknown.status === 200 && unknown.json?.result?.isError === true && unknown.json?.error === undefined,
    `status ${unknown.status}`,
  );

  const streamed = await fetch(`${baseUrl}/mcp`, { headers: { Authorization: `Bearer ${token}` } });
  step("no server-initiated stream is offered on GET", streamed.status === 405, `status ${streamed.status}`);
}

async function main() {
  console.log(`Verifying external-assistant integration against ${baseUrl}\n`);

  // 1. Authorize + read training context.
  const read = await call("GET", "/api/training-context");
  step("GET /api/training-context succeeds", read.status === 200, `status ${read.status}`);
  if (read.status !== 200) {
    step("cannot continue without a successful read", false, JSON.stringify(read.json));
    return finish();
  }

  const context = read.json;
  const hasPlan = context.plan !== null;
  step("plan/race context is readable", true, hasPlan ? `"${context.plan.name}", revision ${context.plan.revision}` : "no active plan (honest empty state)");
  if (hasPlan) {
    step("structured race goal is readable", typeof context.raceGoal?.goal?.type === "string", context.raceGoal?.goal?.type);
  }
  step("actual run history is readable", Array.isArray(context.recentRuns), `${context.recentRuns?.length ?? 0} recent runs`);
  step("Build status is readable", typeof context.build?.placedBlockCount === "number", `${context.build?.placedBlockCount ?? "?"} placed, ${context.build?.pendingBlockCount ?? "?"} pending`);
  step("plan-adjustment history is readable", Array.isArray(context.planAdjustments), `${context.planAdjustments?.length ?? 0} recent adjustments`);
  if (context.planAdjustments?.length > 0) {
    step(
      "each prior adjustment carries the id an undo needs (#181)",
      context.planAdjustments.every((adjustment) => typeof adjustment.adjustmentId === "string"),
      "adjustmentId present on every row",
    );
  }

  await verifyConnector();

  if (!args["allow-write"]) {
    console.log("\n(read-only run — pass --allow-write to also exercise apply/undo)");
    return finish();
  }
  if (!hasPlan) {
    step("write steps skipped", true, "no active plan on this account");
    return finish();
  }

  const target = [context.plan.nextScheduledWorkout, ...context.plan.upcomingWorkouts]
    .filter((workout) => workout && workout.type !== "race")[0];
  if (!target) {
    step("write steps skipped", true, "no eligible future non-race workout to adjust");
    return finish();
  }

  // 2. Apply one legitimate future adjustment.
  const marker = ` (verified by verify-external-integration.mjs, ${new Date().toISOString()})`;
  const apply = await call("POST", "/api/plan-adjustments", {
    operations: [{
      op: "editRun",
      workoutId: target.id,
      values: { type: target.type, title: target.title, targetDistanceMiles: target.targetDistanceMiles, details: `${target.details}${marker}` },
    }],
    expectedPlanRevision: context.plan.revision,
    reason: "verify-external-integration.mjs",
  });
  step("POST /api/plan-adjustments applies", apply.status === 200, `status ${apply.status}`);
  if (apply.status !== 200) {
    step("cannot continue without a successful apply", false, JSON.stringify(apply.json));
    return finish();
  }
  const adjustmentId = apply.json.adjustmentId;
  step("apply response carries an adjustment id and bumped revision", Boolean(adjustmentId) && apply.json.revision === context.plan.revision + 1);

  // 3. Undo it — this is what #182's sparkle sheet triggers in-app for a
  // human, and what an assistant itself can call directly.
  const undo = await call("DELETE", `/api/plan-adjustments?id=${adjustmentId}`);
  step("DELETE /api/plan-adjustments undoes", undo.status === 200, `status ${undo.status}`);
  if (undo.status === 200) {
    step("undo response reflects the reverted plan", undo.json.revision === apply.json.revision + 1);
  }

  // 4. Failure paths, over real HTTP — none of these should ever mutate anything.
  const stale = await call("POST", "/api/plan-adjustments", {
    operations: [{ op: "editRun", workoutId: target.id, values: { type: target.type, title: target.title, targetDistanceMiles: target.targetDistanceMiles, details: "should not land" } }],
    expectedPlanRevision: context.plan.revision, // now stale — two writes have happened since
  });
  step("a stale expectedPlanRevision is rejected (409)", stale.status === 409, `status ${stale.status}`);

  const unknownWorkout = await call("POST", "/api/plan-adjustments", {
    operations: [{ op: "skip", workoutId: "does-not-exist" }],
    expectedPlanRevision: undo.json?.revision ?? context.plan.revision,
  });
  step("an unknown workoutId is rejected (422)", unknownWorkout.status === 422, `status ${unknownWorkout.status}`);

  const bogusUndo = await call("DELETE", "/api/plan-adjustments?id=00000000-0000-0000-0000-000000000000");
  step("undoing an unknown adjustment id is rejected (404)", bogusUndo.status === 404, `status ${bogusUndo.status}`);

  // 5. The same apply/undo cycle again, this time through the connector's own
  // tools rather than REST — #181's acceptance asks for the write path to be
  // proven where an assistant actually reaches it, not only underneath it.
  await verifyConnectorWrites(target, unknownWorkout.json?.revision ?? undo.json?.revision ?? null);

  return finish();
}

/** Reads the current plan revision back through the connector's read tool. */
async function connectorContext() {
  const read = await rpc("tools/call", { name: "get_training_context", arguments: {} });
  if (read.status !== 200 || read.json?.result?.isError) return null;
  try {
    return JSON.parse(read.json.result.content[0].text);
  } catch {
    return null;
  }
}

async function verifyConnectorWrites(target, knownRevision) {
  console.log("\nConnector writes — apply and undo as the assistant itself calls them\n");

  const context = await connectorContext();
  const revision = context?.plan?.revision ?? knownRevision;
  if (typeof revision !== "number") {
    step("connector write steps skipped", true, "could not read a current plan revision back");
    return;
  }

  const marker = ` (connector-verified, ${new Date().toISOString()})`;
  const apply = await rpc("tools/call", {
    name: "adjust_training_plan",
    arguments: {
      operations: [{
        op: "editRun",
        workoutId: target.id,
        values: { type: target.type, title: target.title, targetDistanceMiles: target.targetDistanceMiles, details: `${target.details}${marker}` },
      }],
      expectedPlanRevision: revision,
      reason: "verify-external-integration.mjs (connector)",
    },
  });
  const appliedError = apply.json?.result?.isError === true;
  step("adjust_training_plan applies an eligible future change", apply.status === 200 && !appliedError,
    appliedError ? String(apply.json.result.content?.[0]?.text) : `status ${apply.status}`);
  if (apply.status !== 200 || appliedError) return;

  let applied = null;
  try {
    applied = JSON.parse(apply.json.result.content[0].text);
  } catch {
    // Reported by the next step.
  }
  step("the connector's apply result carries an adjustment id", typeof applied?.adjustmentId === "string", applied?.adjustmentId ?? "none");
  if (typeof applied?.adjustmentId !== "string") return;

  // The id is also readable from a fresh context read — which is how a new
  // conversation, holding nothing from this one, can still undo it.
  const after = await connectorContext();
  step(
    "the applied adjustment is identifiable from a fresh get_training_context",
    (after?.planAdjustments ?? []).some((adjustment) => adjustment.adjustmentId === applied.adjustmentId),
    `${after?.planAdjustments?.length ?? 0} adjustments listed`,
  );

  const undo = await rpc("tools/call", {
    name: "undo_plan_adjustment",
    arguments: { adjustmentId: applied.adjustmentId },
  });
  const undoError = undo.json?.result?.isError === true;
  step("undo_plan_adjustment undoes it", undo.status === 200 && !undoError,
    undoError ? String(undo.json.result.content?.[0]?.text) : `status ${undo.status}`);

  // A failure the model must be able to reason about, not a transport error.
  const bogus = await rpc("tools/call", {
    name: "undo_plan_adjustment",
    arguments: { adjustmentId: "00000000-0000-0000-0000-000000000000" },
  });
  step(
    "an unknown adjustment id comes back as a tool error, not a broken connection",
    bogus.status === 200 && bogus.json?.result?.isError === true && bogus.json?.error === undefined,
    `status ${bogus.status}`,
  );
}

function finish() {
  console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("verify-external-integration.mjs crashed:", error);
  process.exit(1);
});
