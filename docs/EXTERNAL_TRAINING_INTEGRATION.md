# External Training Integration

**Status:** Evolution 2.10A–B read-only contract. The semantic context now
distinguishes baseline/current/actual plan truth and carries a structured race
goal. External authorization, scopes, transport, mutation and assistant-
specific QA are later slices of issue #177.

## Boundary

STACK remains the source of truth for the runner's plan, factual run history
and Build state. An external assistant may eventually reason over a runner-
authorized snapshot and propose changes to future plan intent. STACK does not
run, host or pay for a model.

The current slice establishes one provider-neutral semantic read:

```text
read training context for auth.uid() as of the runner's local YYYY-MM-DD date
```

The database function is:

```sql
public.read_external_training_context_v2(p_as_of_date date default current_date)
```

The typed application adapter is:

```ts
readExternalTrainingContext(client, asOfDate)
```

Neither accepts a subject/user id. The authenticated Supabase session is the
subject. The function is `SECURITY INVOKER`, so the existing personal-table and
Crew RLS policies still apply. `anon` and `PUBLIC` have no execute privilege.

This RPC is the storage-to-domain reader, not the external-assistant transport.
Evolution 2.10D / issue #181 must put provider-neutral external authorization,
scopes, revocation and transport in front of it before a third-party client can
call it.

## Version 2 response

Every response carries:

- `schemaVersion: 2`;
- `subject: "authenticated-user"`;
- the exact `asOfDate` used for local-date windowing;
- `accountStatus`, which distinguishes an initialized account from one that has
  not adopted canonical cloud state;
- active-plan state;
- bounded recent actual history;
- plan-adjustment-history availability.

The client parser fails closed if this shape drifts.

### Plan state

`plan.status` is one of:

- `active`;
- `no-active-plan`;
- `account-not-initialized`.

An active plan exposes only its id, name, date range and narrow race context
(name, date and distance), its positive revision, baseline origin, structured
race goal, and current/future workouts dated on/after `asOfDate`. The frozen
baseline exposes the same bounded workout fields in `baselineWorkouts`, so a
consumer can compare original intent with the current schedule without
reconstructing either one. A workout keeps its id, local date, week, phase,
type, title, target-distance text and details. Past workouts, archived plans,
race location/start time, plan notes, availability and preferred training days
are not in v2.

The race goal is exactly one of `none`, `finish`, `target-finish-time` with
positive integer seconds, or `target-pace` with positive integer seconds per
mile. It is runner-owned read-only context. The integration cannot edit it.

`asOfDate` must be the runner's local calendar date. The database has no
authoritative runner timezone, so a transport that supplies another date must
state and preserve that date rather than presenting it as an inferred today.

### Recent factual history

The window is the inclusive 90 local dates ending on `asOfDate`, bounded to 100
rows. `coverage.truncated` says when the row limit was reached.

Each row uses canonical accepted-run identity:

```text
run-log:<personal_runs.run_id>
```

The row includes:

- actual local date, STACK activity type and running/Cross Training kind;
- distance, duration and pace derived from those two run facts;
- `manual` / `intervals` source semantics, without the upstream activity id;
- explicit linked-workout versus extra-run relationship;
- Personal Build lifecycle as `placed` or `earned-unplaced`, without geometry;
- normalized available metrics with null for missing values and explicit heart-
  rate provenance;
- only this runner's already-authorized Crew contribution state, with Member
  Build and communal Crew Build lifecycle but no teammate facts.

The read never returns notes, effort, raw provider payloads, credentials,
external activity ids, GPS/routes, exact source start time, streams or complete
Build geometry.

### Honest coverage limitation

Version 2 history is always marked `partial`.

The account cloud contains canonical accepted/manual `RunLog` rows. The
historical source mirror is intentionally device-local and outside Supabase.
Consequently, source-only historical activities cannot be returned by a remote
account read without introducing new external health-record persistence, which
this program forbids merely for assistant reasoning.

The response therefore states:

```text
includedOrigins: ["stack-run-log"]
historicalSourceMirrorIncluded: false
```

It never calls accepted-run history complete and never converts an empty or
unavailable history source into zero training.

### Plan-adjustment history

No adjustment ledger exists in 2.10B, so v2 returns
`status: "not-available"` and an empty entry list. Issue #180 owns the ledger;
the reader can expose it only after that canonical model exists.

## Privacy and authorization

- Personal rows remain self-only under their current RLS policies.
- Crew rows are read as the caller and additionally filtered to
  `shared_runs.user_id = auth.uid()`; membership RLS still decides whether the
  Crew is currently visible.
- User A cannot request User B by changing an argument because no subject
  argument exists.
- The transactional SQL test proves two members of one Crew receive only their
  own personal context even though ordinary Crew RLS lets members see the
  narrow shared projection.
- Signed-out/local-only STACK remains fully usable; it simply has no remote
  external-integration context.
- Revoking future integration authorization or losing the integration
  transport cannot affect normal STACK use because the product has no runtime
  dependency on this read.

## Cost and execution boundary

This system performs a database read only.

- No OpenAI or other model API key exists in STACK for this feature.
- No inference call, model hosting or per-user token billing exists.
- No external health-record copy is created to support reasoning.
- ChatGPT is the first intended client, not a hard-coded provider in the
  contract.

## Verification

`supabase/tests/0027_external_training_context_read.sql` and
`0028_structured_plan_truth.sql` cover:

- active, no-active-plan and not-initialized states;
- current/future workout filtering;
- recent-history bounds and canonical RunnerRun identity;
- Personal and Crew Build lifecycle reads;
- omission of raw/uncontracted fields;
- same-Crew cross-user isolation;
- the absence of a subject id argument;
- anonymous execute denial;
- baseline/current separation, revision and structured goal round-trip;
- existing-row adoption and rolling-v2 archive enrichment;
- preservation of factual runs while plan intent changes.

`src/integrations/externalTrainingContext.test.ts` covers the typed contract,
fail-closed parsing, local-date validation and the exact no-user-id RPC call.

## Later slices

This contract grants no mutation authority. Issues #180–#183 own, in order:

1. atomic future-plan adjustments, audit ledger and undo;
2. external authorization, scopes, revocation and transport;
3. the small AI-sparkle provenance UI;
4. real external-client end-to-end QA.

Completed/actual run facts, imported source identity, historical data, Build
geometry/awards, other runners' data, archived plans and the race goal remain
outside assistant mutation authority.
