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
// Default run is read-only (GET /api/training-context) — safe against any
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

  return finish();
}

function finish() {
  console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("verify-external-integration.mjs crashed:", error);
  process.exit(1);
});
