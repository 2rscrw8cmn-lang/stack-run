# External-Assistant End-to-End QA (#183, Evolution 2.10F)

The required journey, from the epic issue:

> `authorize -> read training context -> propose adjustment externally -> apply atomic patch -> see AI sparkle -> inspect provenance -> undo/revoke`

This document is the honest record of what's proven and how, split cleanly
into what's automated (verifiable right now, by anyone, with no deployment)
and what still needs a human with a real client connected to a live
deployment. **This PR does not close #177 by itself** — the epic's own
completion rule is "close parent #177 only after this QA issue passes," and
the manual half below hasn't run yet.

## Two real bugs this pass found — not hypothetical gaps

Working through the journey as a real client would revealed the contract was
actually unusable at the write step, in two places nothing before this had
exercised:

1. **`ExternalPlanContext` never exposed `plan.revision`.** `docs/EXTERNAL_INTEGRATION.md`
   always *said* `expectedPlanRevision` must match "the `plan.revision` field
   currently visible in the training context" — but no such field existed.
   An external client had no way to construct a valid write request at all;
   every attempt would have been a guess, and virtually every guess fails
   with `409 plan_changed`. Fixed: `ExternalPlanContext.revision` now carries
   it (`src/external/trainingContextProjection.ts`).
2. **`ExternalUpcomingWorkout` never exposed the workout's `id`.** Every
   `PlanAdjustmentOperation` requires `workoutId`, and nothing reachable from
   `GET /api/training-context` provided one — a client could see *that* a
   future easy run existed on a given date, never what to call it in a write
   request. Fixed: `ExternalUpcomingWorkout.id` now carries it, on both
   `nextScheduledWorkout` and every entry in `upcomingWorkouts`.

Both are additive field changes with their own regression tests
(`src/external/trainingContextProjection.test.ts`) — see that file's #183
comments. Neither should recur silently: the fields are now part of the
documented contract in `docs/EXTERNAL_INTEGRATION.md` and exercised by the
new journey test and script below.

## Automated

| Journey step | Proven by |
|---|---|
| Authorize | `create_external_api_token`, exercised in `supabase/tests/0030_external_assistant_end_to_end.sql` |
| Read training context — plan, race goal, actual history, Build status | Same file, step 2; field-level projection tests in `src/external/trainingContextProjection.test.ts` |
| Apply one legitimate future adjustment | `0030`, step 3; `src/domain/planAdjustment.test.ts`; `api/plan-adjustments.test.ts` |
| Sparkle / provenance data shape | `0030` asserts the `plan_adjustments` row has exactly the shape `deriveWorkoutProvenance` (#182) reads; the sparkle UI itself is proven separately in `src/features/plan/PlanScreen.test.tsx` / `src/features/today/TodayScreen.test.tsx` |
| Undo | `0030`, step 4; `src/domain/planProvenance.test.ts`'s `canUndoProvenance` coverage |
| Revoke, and that it fails closed on **both** read and write | `0030`, step 6 — closes a gap `0027`-`0029` left (revocation was only ever checked against the read RPC before this) |
| Stale revision / invalid operation / no-active-plan / cross-user isolation | `0030`, consolidated into the one journey rather than split by RPC, plus `supabase/tests/0027`-`0029` |
| `personal_runs` / `personal_build_state` immutability across a full write cycle | `0030` — snapshots both tables before the apply and after the undo and asserts byte-identical; previously only true structurally (different columns), never checked as data |
| No STACK-funded model inference or model key | `src/external/noModelDependency.test.ts` — a standing guard (no AI/model SDK dependency, no model-provider API key referenced under `api/`), not a one-time claim |
| Real HTTP, against an actual deployment | `scripts/verify-external-integration.mjs` — see below |
| **Connector** (#181): MCP framing, protocol negotiation, tool surface, and every STACK failure reaching the model intact | `src/external/mcpServer.test.ts` |
| **Connector**: the three tools over the *real* REST routes — scope, revocation, stale revision, past-workout refusal, undo | `api/mcp.test.ts` (only Supabase is stubbed; the connector, both REST routes and their RPC contracts all run) |
| **Connector**: undo reachable from a new conversation | `supabase/tests/0031_external_connector_undo_handle.sql` |

Run all of it: `npm run check`, `npm run db:verify` (or
`node scripts/run-supabase-sql-tests.mjs` / `node scripts/verify-supabase-migrations.mjs`
directly against local Supabase).

## `scripts/verify-external-integration.mjs`

Every check above either runs in-process (vitest calling route handlers
directly) or against a local Supabase instance over a docker socket — none
of it makes a real network request to a *deployed* STACK. This script does:

```
node scripts/verify-external-integration.mjs --base-url https://<deployment> --token <token>
```

- Default run is **read-only**: `GET /api/training-context`, plus (since
  #181) the connector's `initialize` handshake, `tools/list`, and a
  `get_training_context` call — the exact path a connected assistant takes.
  Safe against any real account, any time.
- `--allow-write` additionally applies one small, reversible edit, confirms
  it landed with the right revision bump, undoes it, and exercises the real
  HTTP failure paths (stale revision → 409, unknown workout → 422, bogus
  undo id → 404) — then repeats the apply/undo cycle *through the connector's
  own tools*, including reading the new `adjustmentId` back from a fresh
  `get_training_context` before undoing by it.
- Token via `--token` or `STACK_VERIFY_TOKEN` — never logged, never printed.

**Not run against a deployment** — there is still no deployed URL or real
token available. It has, however, been run end to end in the #181 session
against the real handlers served over real loopback HTTP with only Supabase
stubbed: all 24 checks passed, including every connector step. That exercises
the script itself, the MCP framing over the wire, and the whole
apply → read-back → undo cycle; what it cannot exercise is a real database, a
real token, or a real deployment.

## A real MCP client, in the #181 session

The script is STACK's own client. To check that the endpoint is a *correct*
MCP server and not merely self-consistent, the same locally-served handlers
(Supabase stubbed, as above) were also driven by the official
`@modelcontextprotocol/sdk` client over `StreamableHTTPClientTransport`,
installed outside the repository so nothing about STACK's dependency
boundaries changed. It connected without special-casing, and:

- negotiated the handshake and read back `serverInfo` (`stack`, `1.0.0`),
  capabilities (`tools` only) and the server instructions;
- listed exactly `get_training_context`, `adjust_training_plan`,
  `undo_plan_adjustment`;
- read the training context, applied an adjustment, found its `adjustmentId`
  in a *fresh* context read, and undid it by that id;
- with a `read`-scoped token, read fine and was refused the write with the
  `insufficient_scope` explanation — a tool error, not a broken connection;
- got a tool error, not a transport error, for an unknown tool name.

That is the strongest available evidence short of a live assistant: a real
MCP client library, not STACK's own code, talking to the real route.

## Needs a human — not closeable from this session

- **A real assistant, ChatGPT if the supported path is available, actually
  connected.** The MCP-client run above proves the protocol; it does not
  prove that ChatGPT's connector setup screen accepts this URL and token, or
  that a live model uses the tools sensibly. Point the script at a deployment
  first for a fast sanity check before spending a real ChatGPT session on it,
  and follow the per-assistant steps in `docs/EXTERNAL_INTEGRATION.md`.
- **claude.ai's own custom connectors** remain out of reach until STACK runs
  an OAuth authorization server; Claude Code and Claude Desktop connect today
  with a header. See the OAuth note in `docs/EXTERNAL_INTEGRATION.md`.
- **`supabase/tests/0031`** has not been executed — no docker daemon was
  available in the #181 session, so no SQL test in this repository ran there.
  It needs `npm run db:verify` against local Supabase.
- **320 / ~390 / 430 / desktop UI review** of the auth-gated screens: the
  External Assistant Access panel (#181) and the sparkle/provenance sheet
  (#182). Both sit behind `checkSupabaseBoundary`, which only accepts the
  two real Supabase projects — not local dev — so neither has ever been
  screenshotted in this session. Same caveat #181 and #182 already flagged.
- **Deployment itself.** None of #178-183's branches are merged, and no
  migration in this stack has been applied to a real (preview or
  production) Supabase project. `scripts/verify-external-integration.mjs`
  and the literal ChatGPT walkthrough both need that to exist first.

## Privacy-safe evidence

Once the manual half runs, capture: the script's PASS/FAIL output (contains
no token, no personal data beyond what the account owner already sees),
screenshots of the sparkle/provenance sheet and the External Assistant
Access panel at the four required widths, and — if a real ChatGPT session is
used — a description of what was asked and what changed, not a transcript
containing the account owner's raw training data.
