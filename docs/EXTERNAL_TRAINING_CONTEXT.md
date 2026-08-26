# External Training Context (#178, Evolution 2.10A)

Read this before touching `api/training-context.ts`, `external_api_tokens`,
`external_training_snapshot`, or `src/external/trainingContextProjection.ts`.

## The product principle (from #177)

> **STACK stays the source of truth. The runner's chosen assistant may help
> adapt future intent. Actual running history stays factual.**

STACK owns the plan, run history and Build state. An external assistant the
runner explicitly authorizes — ChatGPT is the named first client — does the
reasoning. **STACK makes no call to any AI or model provider, anywhere in this
path, and never will as part of this feature.** There is no STACK-funded
inference cost and none is planned.

This document covers only the read side. There is no way to write a plan
change through this API yet — that is #180, a separate, later, atomically
audited slice. Nothing described here should be mistaken for the finished
integration:

| Slice | What it adds | Status |
|---|---|---|
| #178 (this doc) | Read-only training context | Done |
| #179 | Structured race goal + baseline/current/actual plan truth | Not started |
| #180 | Atomic plan adjustments + audit ledger + undo | Not started |
| #181 | Formal auth scopes + provider-neutral transport | Not started |
| #182 | The AI-sparkle provenance UI | Not started |
| #183 | Real external-assistant end-to-end QA | Not started |

## Auth: a personal, revocable token — not a Supabase session

The caller here is not a signed-in browser; it has no Supabase session or
JWT. Auth is a runner-generated **bearer token**, created and revoked from
Settings → Account & Crew → External Assistant Access, and sent as
`Authorization: Bearer <token>`.

- Tokens never expire on their own. Revocation is the only end — a silent
  expiry would break a standing assistant connection without the runner
  asking for it.
- The raw token is shown exactly once, at creation. `external_api_tokens`
  stores only its SHA-256 hash, and the client is never granted `select` on
  that column — there is no path, buggy or otherwise, that reads it back.
- `POST /rest/v1/rpc/external_training_snapshot` is called with STACK's
  **anon key**, never a service-role key — this repository does not use one
  anywhere. The function is `security definer` and resolves which account a
  token belongs to entirely from the token hash; the caller never supplies,
  and the route never accepts, a raw user id. That is what makes cross-user
  access structurally impossible from this layer, not a policy choice that
  could be gotten wrong at a call site.
- A missing, malformed, or revoked token gets the same generic `401`. The
  response never distinguishes *why* a token failed — that would be an
  enumeration signal with no legitimate use.

See `supabase/migrations/20260814010000_reusable_crew_invites.sql` for the
capability-token pattern this one is built on, and
`api/_crewInvitePreview.ts` for the matching client-side hash-and-fetch shape.

## What the response contains, and why

`ExternalTrainingContext` (`src/external/trainingContextProjection.ts`) is
built the same way Crew's privacy boundary is: every field constructed
explicitly, never `{...spread}` from a `RunLog` or `AppState`. There is no
cross-user boundary to enforce here — this is a runner's own data going to a
service *they* chose — so the withholding is narrower than Crew's:

- **Included**: distance, duration, pace, heart rate, cadence, elevation,
  training load, effort, activity type, source, plan structure, Build
  placement, Training Signals, and the viewer's own Crew membership summary
  (never another member's row, never the shared communal tower).
- **Withheld**: free-text `notes` (the one conservative default this codebase
  applies everywhere — Crew withholds it too), and provider-identity details
  (external activity id, source name/type) that carry no training-reasoning
  value. Revisiting either of these as a per-token scope is #181's job, not
  a call this endpoint makes unilaterally.
- **Truthful empty states, never fabricated ones**: `plan: null` means no
  active plan, exactly like the rest of the app (`docs/NO_ACTIVE_PLAN_LIFECYCLE.md`).
  A token for an account that has never turned on personal cloud sync gets a
  `200` with an honestly empty context, not an error — mirrored from
  `loadPersonalCloudSnapshot`'s own null-when-uninitialized behavior.
  `planAdjustments` is always `[]`, because that model does not exist yet
  (#180).
- **Race goal**: whatever `TrainingPlan.race` already holds
  (`name`/`date`/`distanceMiles`). There is no structured goal type yet —
  that is #179's job, not this endpoint's to invent.

## Where the data comes from

The route does not recompute anything the app doesn't already compute. It:

1. Resolves the token via `external_training_snapshot`, which also returns
   the same four-table document shape `loadPersonalCloudSnapshot`
   (`src/personal-sync/personalCloudRepository.ts`) already assembles
   client-side, scoped by the resolved token owner instead of `auth.uid()`.
2. Reconstructs an `AppState` with `appStateFromCloud`
   (`src/personal-sync/reconciliation.ts`) — the same tested reconstruction
   the browser uses.
3. Runs it through the same pure domain functions the app's own screens use:
   `selectPlanWeekViewModel`/`nextScheduledWorkout` (`src/domain/plan.ts`),
   `unifiedRunnerHistory` (`src/history/runnerRun.ts`),
   `selectBuildViewModel` (`src/domain/build.ts`), and
   `presentableRunnerSignals` (`src/signals/runnerSignals.ts`).
4. Projects the result through `projectExternalTrainingContext`.

## Transport

Plain REST, `GET /api/training-context`, JSON in, JSON out. This is
deliberately not an MCP server or a ChatGPT-plugin-specific contract yet —
formalizing a provider-neutral transport is #181's job. Treat this contract
as stable enough to build against, but expect it to grow a `scopes` concept
later without breaking what's here.
