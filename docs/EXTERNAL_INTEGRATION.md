# External Integration Guide (#181, Evolution 2.10D)

This is the client-facing "how do I connect an assistant to STACK" reference.
`docs/EXTERNAL_TRAINING_CONTEXT.md` and `docs/PLAN_ADJUSTMENTS.md` explain
*why* each piece is built the way it is, for STACK contributors; this
document is for whoever is wiring an external assistant (ChatGPT, Claude, or
anything else a runner authorizes) up to STACK.

## Two ways in, one contract underneath

STACK exposes the same capabilities through two transports:

| | For | Entry point |
|---|---|---|
| **Connector** (remote MCP server) | An assistant a runner connects: ChatGPT, Claude, anything that speaks MCP. | `POST /mcp` |
| **REST** | Anything that can make an HTTP request: a script, a cron job, a custom GPT Action, your own code. | `GET /api/training-context`, `POST`/`DELETE /api/plan-adjustments` |

The connector is a thin translation layer over the REST routes — it calls
them in process, with the caller's own token, and holds no plan logic, no
auth logic and no database access of its own (`api/mcp.ts`,
`src/external/mcpServer.ts`). Everything below about scopes, revocation,
stale-plan conflicts and what this surface will never do is therefore true of
both, in the same way, for the same reason.

Neither transport is provider-specific. ChatGPT is the named first client;
nothing in either path knows or cares which assistant is calling.

## Connecting an assistant

An ordinary ChatGPT or Claude conversation cannot call STACK. It has no
mechanism to make an HTTP request, so a token pasted into a chat message does
nothing at all — it just sits in the conversation history. **A token is
entered once, in the assistant's connector setup screen, never in a
conversation.** The in-app panel says so too.

### 1. Create the credential in STACK

1. Settings → Account & Crew → your profile row → **External Assistant
   Access**.
2. Copy the **STACK connector URL** shown at the top of the panel. It is your
   deployment's own origin plus `/mcp` — a preview deployment hands out its
   own URL, not production's.
3. Choose an access level (below), name the connection, and create it.
4. The raw token is shown exactly once. STACK cannot show it again.
5. Revoke it any time from the same screen. Revocation is immediate and is
   the only way a token ever stops working — tokens do not expire on their
   own (see **Revocation and expiry**).

### 2. Register STACK in the assistant

**ChatGPT.** In ChatGPT's settings, add a custom connector (an MCP server) —
this lives under Connectors, and on some plans requires developer mode to be
switched on first. Give it the STACK connector URL. When it asks how to
authenticate, choose the access-token / API-key option and paste the STACK
token into that field. ChatGPT sends it as `Authorization: Bearer <token>` on
every call, which is exactly what STACK expects.

**Claude Code.**

```
claude mcp add --transport http stack https://<deployment>/mcp \
  --header "Authorization: Bearer <token>"
```

**Claude Desktop, and any client configured by a JSON file.** Clients that
take a URL but no header field reach STACK through the standard `mcp-remote`
bridge:

```json
{
  "mcpServers": {
    "stack": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote", "https://<deployment>/mcp",
        "--header", "Authorization: Bearer <token>"
      ]
    }
  }
}
```

**Anything else.** Any MCP client that can send an `Authorization` header
with a Streamable-HTTP server works, unchanged. Check the client's own docs
for where its headers or credentials are configured; the exact wording of
these third-party screens moves faster than this document can.

### A note on claude.ai's custom connectors, and on OAuth

claude.ai's own "add a custom connector" flow authenticates with OAuth and
offers no static-token field, so it cannot connect to this version of STACK —
use Claude Code or Claude Desktop, above, or ChatGPT.

Hiding raw-token mechanics behind a proper authorization flow is the
preferred end state, and #181 says so. It requires STACK to run an OAuth 2.1
authorization server: dynamic client registration, an `/authorize` consent
screen bound to a signed-in runner, PKCE code exchange, refresh tokens, and
the migrations behind all of it. That is a larger piece of work than this
slice, and it is deliberately *not* half-built here — a partial OAuth server
is worse than an honest token. What it will not change when it lands is the
tool surface or the domain semantics below: it replaces step 1 and 2's
credential handling, nothing else.

Until then, `POST /mcp` answers `401` with `WWW-Authenticate: Bearer` for a
request carrying no token, and the response body says where the token
belongs.

## Access levels (scopes)

| Scope | Grants |
|---|---|
| `read` | `get_training_context` / `GET /api/training-context` only. |
| `read_write` | Everything `read` grants, plus `adjust_training_plan` and `undo_plan_adjustment` / `POST`/`DELETE /api/plan-adjustments`. |

There is no third level, and no per-field scoping within a level yet: a
`read` token sees the whole training-context payload described below (never
free-text notes or provider-identity details — see
`docs/EXTERNAL_TRAINING_CONTEXT.md`), and a `read_write` token can adjust
any future, non-race workout. The race goal itself is never writable through
this surface at any scope — see `docs/PLAN_ADJUSTMENTS.md`.

A `read`-scoped token attempting a mutation fails with `403
insufficient_scope` — enforced independently in SQL (`_resolve_external_api_token`
in `supabase/migrations/20260825140000_external_api_token_scopes.sql`), not
only by the route, so it holds even against a direct call to the underlying
RPC. Through the connector the same refusal comes back as a tool error whose
text names `insufficient_scope` and says what the runner would do to change
it. The connector lists all three tools at either scope: it never sees the
token's scope, and inferring it would mean asking the database a question the
runner did not ask.

## The connector

### Endpoint

`POST /mcp` (`/api/mcp` also works — `/mcp` is a rewrite of it), speaking
JSON-RPC 2.0 over MCP's Streamable HTTP transport.

```
POST /mcp
Authorization: Bearer <token>
Content-Type: application/json
```

- Protocol revisions: `2025-06-18`, `2025-03-26`, `2024-11-05`. An
  unrecognized `protocolVersion` at `initialize` is answered with the newest
  STACK speaks rather than refused.
- Capabilities: `tools` only. No resources, no prompts, no sampling.
- Stateless. STACK issues no `Mcp-Session-Id`, opens no server-initiated SSE
  stream (`GET` answers `405`), and holds nothing between calls.
- `OPTIONS` is answered for CORS; the endpoint carries no cookies and no
  ambient authority, only the bearer token.

### Tools

| Tool | Maps to | Scope |
|---|---|---|
| `get_training_context` | `GET /api/training-context` | `read` |
| `adjust_training_plan` | `POST /api/plan-adjustments` | `read_write` |
| `undo_plan_adjustment` | `DELETE /api/plan-adjustments?id=` | `read_write` |

`get_training_context` takes no arguments and returns the whole
`ExternalTrainingContext` as JSON text.

`adjust_training_plan` takes `{operations, expectedPlanRevision, reason?}` —
the same body `POST /api/plan-adjustments` takes, described below. Only those
three fields cross the boundary; anything else in the arguments object is
dropped, not forwarded.

`undo_plan_adjustment` takes `{adjustmentId}`. The id comes from an earlier
`adjust_training_plan` result, or from `planAdjustments[].adjustmentId` in
`get_training_context` — which is what makes undo reachable from a *new*
conversation that never saw the original apply.

A STACK failure comes back as an MCP tool error (`isError: true`) carrying
STACK's own message, its error code, and what to do next — not as a JSON-RPC
transport error. The distinction matters: a model should see and reason about
"the plan changed underneath you, re-read it," and a client should not treat
that as the server being broken.

## REST endpoints

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
returned when it was applied — also carried per-row as
`planAdjustments[].adjustmentId` in `training-context`. Fails with `409`
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

Through the connector these become tool errors carrying the same `error` code
and message verbatim, plus one sentence of guidance. Nothing is added to what
a REST client can already see, and nothing is taken away.

## Revocation and expiry

Tokens have no expiry. This is a deliberate choice, not an oversight: this
surface is meant to back a standing assistant connection, and a silent
expiry would break that connection without the runner asking for it.
Revocation — from Settings, instantly — is the only way a token stops
working. A revoked token fails closed (`401` on every endpoint, an
"authorization is gone, reconnect in your connector settings" tool error on
every connector call) with no effect on anything else: normal in-app STACK
use, signed-out/local-only STACK, and any other tokens the runner has created
are all untouched.

## Outages

If STACK's own Supabase backend cannot be reached, times out, or returns
something this route can't parse, every endpoint answers `502`/`504` rather
than fabricating a response or silently succeeding. A caller should treat
these as "try again later," not as "the plan was not adjusted" or "the plan
was adjusted" — for a write, an outage that happens *after* STACK's database
already committed the change (the response itself failing to reach the
caller) is indistinguishable from one that happens before it from the
client's side; re-reading `training-context`'s `plan.revision` after a
suspected outage is the reliable way to find out which happened. The
connector says exactly this back to the model rather than letting it guess.

The connector is also strictly optional infrastructure. If `/mcp` is down,
misconfigured, or never deployed, normal STACK — plan, runs, Build, Crew,
personal sync, signed-out local-only use — is entirely unaffected. Nothing in
the app calls it.

## What this surface will never do

Carried over unchanged from #178/#180's boundaries, and true of the connector
for the structural reason that the connector cannot reach anything the REST
routes don't hand it:

- No broad Crew export — only the token owner's own membership summary in
  whichever crews they belong to, never another member's data or the shared
  communal tower.
- No arbitrary database access — every response is a named, versioned
  STACK shape (`ExternalTrainingContext`, a plan-adjustment result), never a
  raw table row. The connector exposes semantic tools, not database
  primitives, and cannot form a request the REST surface would have refused.
- No STACK-funded AI/model call, anywhere in this path, at either scope, over
  either transport. STACK reasons about nothing; the assistant the runner
  chose does. Guarded by `src/external/noModelDependency.test.ts`.
- No mutation of factual run/Build history, at either scope — `read_write`
  only ever touches the `plan` column's future, non-race workouts.
- No external health-record ingestion — this surface only ever reads what
  STACK already computed from the runner's own connected sources.
- No user id ever accepted from a caller. Identity is resolved from the
  token's hash, in SQL, and nowhere else — which is what makes cross-user
  access structurally impossible rather than merely disallowed.
