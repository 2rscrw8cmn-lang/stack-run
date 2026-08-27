# External Integration Guide (#181, Evolution 2.10D)

This is the client-facing "how do I connect an assistant to STACK" reference.
`docs/EXTERNAL_TRAINING_CONTEXT.md` and `docs/PLAN_ADJUSTMENTS.md` explain
*why* each piece is built the way it is, for STACK contributors; this
document is for whoever is wiring an external assistant (ChatGPT, or
anything else a runner authorizes) up to STACK.

## Transport

Plain HTTPS REST. No SDK, no MCP handshake, no ChatGPT-specific contract —
any HTTP client that can send a bearer token and parse JSON can integrate.
This is a deliberate choice, not a placeholder: `docs/EXTERNAL_TRAINING_CONTEXT.md`
already called out that formalizing this was #181's job, and a plain,
stable REST contract *is* the provider-neutral transport, not a step on the
way to one. Nothing here rules out someone building an MCP adapter, a
ChatGPT custom-GPT Action, or any other wrapper on top of it later — that
wrapper would just be a client of this same contract.

## Connecting

1. In STACK: Settings → Account & Crew → your profile row → **External
   Assistant Access**.
2. Choose an access level (below), name the connection, and create it.
3. The raw token is shown exactly once. Copy it into whatever you're
   connecting — STACK cannot show it again.
4. Revoke it any time from the same screen. Revocation is immediate and is
   the only way a token ever stops working — tokens do not expire on their
   own (see **Revocation and expiry** below).

## Access levels (scopes)

| Scope | Grants |
|---|---|
| `read` | `GET /api/training-context` only. |
| `read_write` | Everything `read` grants, plus `POST`/`DELETE /api/plan-adjustments`. |

There is no third level, and no per-field scoping within a level yet: a
`read` token sees the whole training-context payload described below (never
free-text notes or provider-identity details — see
`docs/EXTERNAL_TRAINING_CONTEXT.md`), and a `read_write` token can adjust
any future, non-race workout. The race goal itself is never writable through
this surface at any scope — see `docs/PLAN_ADJUSTMENTS.md`.

A `read`-scoped token calling a mutation endpoint fails with `403
insufficient_scope` — enforced independently in SQL (`_resolve_external_api_token`
in `supabase/migrations/20260825140000_external_api_token_scopes.sql`), not
only by this route, so it holds even against a direct call to the
underlying RPC.

## Connecting a ChatGPT Custom GPT

ChatGPT's Custom GPT "Actions" feature needs an OpenAPI 3.0.3 schema before
it can call anything — `GET /api/openapi.json` serves exactly that (a plain,
unauthenticated, cacheable route; the document is not account-specific).

1. In the GPT Builder, under **Actions**, choose **Import from URL** and give
   it `https://stack-run.vercel.app/api/openapi.json`.
2. Set **Authentication** to **API Key**, **Auth Type: Bearer**, and paste in
   the token from **Connecting** above.
3. The three operations (`getTrainingContext`, `applyPlanAdjustment`,
   `undoPlanAdjustment`) should appear with no schema errors.

The schema is hand-written from the real route shapes and guarded by a test
(`api/_openapiSpec.test.ts`) that fails if it drifts from them — see that
file's header for how.

## Connecting Claude (remote MCP)

Claude doesn't consume OpenAPI/Actions — its equivalent is a remote
[MCP](https://modelcontextprotocol.io) server. `POST /api/mcp` is exactly
that: a JSON-RPC 2.0 / Streamable HTTP endpoint exposing three tools
(`get_training_context`, `apply_plan_adjustment`, `undo_plan_adjustment`)
that call the exact same routes described above — same behavior, same
tokens, same error taxonomy, because it's the same code underneath.

Auth is the same personal bearer token from **Connecting** above, sent as a
request header — never OAuth. Where you paste it depends on which Claude
surface you're using:

**Claude Desktop or Claude Code** (works today, no beta flag needed) — add
a remote MCP server with a custom header, e.g. in Claude Desktop's config:

```json
{
  "mcpServers": {
    "stack": {
      "url": "https://stack-run.vercel.app/api/mcp",
      "headers": { "Authorization": "Bearer <token>" }
    }
  }
}
```

(Claude Code: `claude mcp add --transport http stack https://stack-run.vercel.app/api/mcp --header "Authorization: Bearer <token>"`.)

**claude.ai (web)** — Customize → Connectors → **Add custom connector**,
enter `https://stack-run.vercel.app/api/mcp` as the URL, then open **Request
headers** and add `Authorization` with the value `Bearer <token>` (include
the word `Bearer` — Claude sends the header value exactly as entered, with
no scheme prepended). As of this writing, request-header auth on custom
connectors is an Anthropic beta rolling out gradually — if the **Request
headers** section isn't in your dialog yet, use Claude Desktop or Claude
Code instead, or check again later.

The tool schemas are composed directly from the same OpenAPI schema objects
above (`api/_mcpTools.ts`) and guarded by their own drift test
(`api/_mcpTools.test.ts`), so they can't quietly diverge from either the
REST contract or the real route shapes.

## Endpoints

### `GET /api/training-context`

```
Authorization: Bearer <token>
```

Returns the runner's own `ExternalTrainingContext` — active plan, upcoming
workouts, recent runs, Build progress, Training Signals, Crew membership
summary, and recent plan-adjustment history. `200` with an honestly empty
context (`plan: null`, empty arrays) if the account has never synced to the
cloud. Full field-by-field description: `docs/EXTERNAL_TRAINING_CONTEXT.md`.

### `POST /api/plan-adjustments`

```
Authorization: Bearer <token>
Content-Type: application/json

{
  "operations": [
    { "op": "move", "workoutId": "...", "toDate": "2026-09-10" }
  ],
  "expectedPlanRevision": 4,
  "reason": "optional, shown back in adjustment history"
}
```

`operations` — one or more of `move` / `editRun` / `addRun` / `skip`; see
`docs/PLAN_ADJUSTMENTS.md` for the full shape of each. `expectedPlanRevision`
must match the `plan.revision` field currently visible in the training
context — a stale value (someone else changed the plan since you last read
it) is rejected with `409`, not silently overwritten. On success, returns
`{adjustmentId, plan, revision}` — `plan` is the same shape
`training-context`'s `plan` field is.

### `DELETE /api/plan-adjustments?id=<adjustmentId>`

```
Authorization: Bearer <token>
```

Undoes exactly one prior adjustment, identified by the `adjustmentId`
returned when it was applied (also visible per-row in `training-context`'s
`planAdjustments` list, though that list doesn't include the id — read it
back from the `apply` response, or from your own records). Fails with `409`
if the plan has changed since that adjustment landed — including a manual
edit the runner made in the app, which always wins over a stale undo.

## Error codes

| Status | `error` | Meaning |
|---|---|---|
| 400 | `invalid_request` | Malformed body, or missing required fields. |
| 401 | `unauthorized` | Token missing, malformed, unknown, or revoked. Deliberately not distinguished — see below. |
| 403 | `insufficient_scope` | A `read` token attempted a mutation. |
| 404 | `not_found` | The `adjustmentId` given to `DELETE` doesn't exist for this account. |
| 409 | `plan_changed` | `expectedPlanRevision` is stale, or the requested edit touches something this surface can't change (race day, a past workout, the race goal). Deliberately not distinguished — see below. |
| 409 | `not_undoable` | The adjustment was already undone. |
| 422 | `no_active_plan` / `invalid_operation` | No active plan to adjust, or an operation named an unknown/ineligible workout. |
| 502 / 503 / 504 | `upstream_unavailable` / `not_configured` / `upstream_timeout` | STACK's own backend could not complete the request — see **Outages** below. |

`401` never says *why* a token failed (unknown vs. malformed vs. revoked
are all the same response) and `409 plan_changed` never says *which*
invariant a patch violated. Both are deliberate: naming the specific reason
would be an information-disclosure surface with no legitimate client use —
a well-behaved integration doesn't need to know, and a misbehaving one
shouldn't be able to probe with it. `403 insufficient_scope` is the one
exception, and is named plainly: the caller already knows their own token's
scope by construction, so there's nothing to leak.

## Revocation and expiry

Tokens have no expiry. This is a deliberate choice, not an oversight: this
surface is meant to back a standing assistant connection, and a silent
expiry would break that connection without the runner asking for it.
Revocation — from Settings, instantly — is the only way a token stops
working. A revoked token fails closed (`401` on every endpoint) with no
effect on anything else: normal in-app STACK use, signed-out/local-only
STACK, and any other tokens the runner has created are all untouched.

## Outages

If STACK's own Supabase backend cannot be reached, times out, or returns
something this route can't parse, every endpoint answers `502`/`504` rather
than fabricating a response or silently succeeding. A caller should treat
these as "try again later," not as "the plan was not adjusted" or "the plan
was adjusted" — for `POST`/`DELETE /api/plan-adjustments`, an outage that
happens *after* STACK's database already committed the change (the response
itself failing to reach the caller) is indistinguishable from one that
happens before it from the client's side; re-reading `training-context`'s
`plan.revision` after a suspected outage is the reliable way to find out
which happened.

## What this surface will never do

Carried over unchanged from #178/#180's boundaries, now with `read_write`
in the picture too:

- No broad Crew export — only the token owner's own membership summary in
  whichever crews they belong to, never another member's data or the shared
  communal tower.
- No arbitrary database access — every response is a named, versioned
  STACK shape (`ExternalTrainingContext`, a plan-adjustment result), never a
  raw table row.
- No STACK-funded AI/model call, anywhere in this path, at either scope.
- No mutation of factual run/Build history, at either scope — `read_write`
  only ever touches the `plan` column's future, non-race workouts.
- No external health-record ingestion — this surface only ever reads what
  STACK already computed from the runner's own connected sources.
