# UI Implementation Plan

## Implemented foundation

UI-0 through UI-7 are implemented. Do not re-run old phase prompts as if they are pending.

The current product already has:

- Today / Build / Plan shell;
- scheduled and extra actual runs;
- manual run entry;
- 8-column interactive Build tower;
- editable generated race plan;
- run-day preferences;
- availability-calendar proposals;
- installability/storage recovery/UI-7 polish.

Connected Training begins at UI-8.

Primary references:

- `docs/CONNECTED_TRAINING.md`
- `docs/INTERVALS_INTEGRATION.md`
- `docs/CONNECTED_DATA_FIELDS.md`

## UI-8 — Connected Data Foundation

### Product outcome

The user can securely sync recent Intervals.icu running activities, confirm one as the actual run for a planned workout or an extra run, and avoid retyping date/distance/duration.

### Server deliverables

- Add `api/intervals.ts`.
- GET-only, read-only proxy.
- Whitelist resources: status, activities, single activity detail, wellness (wellness may remain unused in UI-8).
- Authenticate upstream with server-only `INTERVALS_API_KEY` using Basic auth `API_KEY:<key>`.
- Require local `X-Stack-Sync-Token` matching server `STACK_SYNC_TOKEN`.
- Never accept arbitrary upstream URL/path/method.
- Validate bounded date ranges/activity ids.
- `Cache-Control: no-store`.
- Safe errors for missing config, auth, rate limit, upstream failure.
- No body/credential logging.
- Tests use injected/mocked environment/fetch, never real secrets.

### Client connection deliverables

- Dedicated local connection-token repository outside AppState.
- Secondary `Run Data` connection sheet/surface.
- Disconnected: enter only STACK sync token, test connection.
- Connected: status, last successful sync, `Sync Now`, forget connection, clear ignored ids.
- Do not ask for/show Intervals API key in client UI.

### Schema/data deliverables

- AppState schema 8 → 9 migration.
- Existing runs become `source: manual` with null external data.
- Add Intervals sync state/ignored ids.
- Add normalized imported source + optional metrics to RunLog.
- Preserve every existing run id/link/block/plan/availability/run-day/race value.
- Add external-id selectors/dedupe helpers.

### Sync deliverables

- Activity-list fetch/normalizer.
- First connect: bounded 90-day backfill.
- Normal sync: rolling 14-day lookback.
- Running-only allowlist begins from verified real HealthFit activity type.
- Repeated external ids suppressed.
- Ignored ids suppressed.
- No continuous polling.
- Manual `Sync Now`.

### Field discovery deliverable

Using the real June 10 HealthFit-originated activity through a deployed preview/production proxy, update `docs/CONNECTED_DATA_FIELDS.md` with:

- exact source run type;
- distance unit;
- moving/elapsed time behavior;
- available HR/cadence/elevation/load/zone fields.

Do not commit the raw personal response.

### Matching/import deliverables

For an unimported remote run:

- suggest unmatched scheduled workouts within ±2 days;
- prioritize closest date then safe distance fit;
- user confirms proposed plan link or Extra Run;
- scheduled import defaults STACK type from planned workout;
- extra import asks/confirms STACK type, default Easy;
- ask effort + optional notes;
- save normalized objective fields/source/metrics;
- earn normal Build block.

For a likely remote match to an existing manual RunLog:

- offer `Attach synced data`;
- preserve local run id, workout link, effort, notes and placement identity;
- clearly confirm objective differences;
- do not create duplicate.

### UI-8 boundaries

Do not add:

- wellness/recovery UI;
- training trends;
- complex HR charts;
- upstream writes;
- OAuth/webhooks;
- fourth persistent tab;
- FIT parsing;
- live workout tracking.

### UI-8 exit gate

- `npm run check` passes with no secrets.
- Schema 8 state migrates losslessly except additive fields.
- Proxy rejects absent/wrong sync token.
- API key does not appear in built JS, browser localStorage or browser request payloads.
- June 10 activity appears in real field-discovery test.
- Imported run can become planned or extra.
- Same external id is never imported twice.
- Existing manual run can be enriched without changing its id/block link.
- Manual logging still works disconnected.
- Works at 320/390/768/1280 px.
- Real iPhone preview/production smoke test passes.

## UI-9 — Connected Run Detail

### Product outcome

A synced run contains enough useful detail to understand the session without opening another app for basic facts.

### Deliver

- Primary distance/duration/pace/date.
- Optional avg/max HR.
- Optional cadence only after semantics verified.
- Optional elevation gain.
- Optional Intervals training load.
- Optional HR-zone distribution when verified.
- Quiet `Synced via Intervals.icu` source label.
- On-demand `/activity/{id}?intervals=true` detail request.
- Structured interval/lap rows only when source data is verified/understood.
- Missing values omitted.

### Data strategy

Prefer on-demand detail over persisting large interval arrays. If persistence is needed for UX/offline-like behavior, define a bounded normalized schema addition before implementation rather than storing the raw response.

### Exit gate

- Detail works with only minimum import fields.
- Every optional-metric combination is safe.
- No missing metric renders as zero.
- Detail fetch occurs on demand.
- Structured interval fixture is tested.
- Accessible labels/text accompany HR-zone visuals.
- `npm run check` passes.

## UI-10 — Connected Today + Week

### Product outcome

A freshly synced run naturally appears in the daily workflow and weekly progress reflects actual training without clutter.

### Deliver

- Quiet stale-aware sync on app start/focus.
- Avoid duplicate focus syncs / request storms.
- `Run found` actionable Today state for high-quality candidates.
- `Confirm Match`, `Extra Run`, temporary dismiss/explicit ignore.
- Sync state/retry that does not replace the planned-workout experience when nothing is found.
- This Week actual miles.
- This Week total run time.
- Longest run.
- Scheduled progress remains mathematically separate.
- Build block reward immediately after imported-run confirmation.

### Exit gate

- Today still communicates the primary workout in under five seconds.
- No continuous polling.
- Late HealthFit upload in rolling lookback can still be discovered.
- Sync failure never blocks manual log/edit/build/plan.
- Extra runs do not alter scheduled completion/streak.
- 320px Today remains visually restrained.
- `npm run check` passes.

## UI-11 — Training Trends

### Product outcome

The user can answer `Am I building toward this race?` without a generic analytics dashboard.

### Navigation

Training Trends is a secondary view opened from Today/Plan. It is not a fourth persistent tab.

### Deliver

- Weekly actual mileage.
- Long-run distance progression.
- Scheduled consistency percentage.
- Easy-run average pace trend.
- Easy-run average-HR trend when coverage is adequate.
- Clear date ranges/units.
- Low-data states.
- Text summaries paired with visuals.

### Visualization discipline

- Prefer simple CSS/inline SVG.
- No chart library unless approved separately.
- One visual idea at a time on phone.
- No race prediction.
- No generic CTL/ATL/form dashboard unless separately approved.

### Exit gate

- Calculation helpers unit-tested.
- Trends use actual run date, not planned date.
- Imported/manual source is irrelevant to trend math once a RunLog exists.
- Easy HR trend omits runs without HR.
- Low coverage is stated/omitted rather than extrapolated.
- Accessible text summary exists for each chart.
- `npm run check` passes.

## UI-12 — Wellness / Recovery Context

### Precondition

Do not start until real Intervals wellness responses have been checked and `docs/CONNECTED_DATA_FIELDS.md` marks useful fields Verified.

### Product outcome

Today can show a small amount of recovery context from the user's own recent baseline without becoming a readiness engine.

### Deliver when verified

- Wellness-range fetch/normalizer.
- Bounded local cache if persistence is useful; recommended ≤120 days.
- HRV.
- Resting HR.
- Sleep duration.
- Optional steps/weight only when verified and product-useful.
- Recent-baseline helper, preferring 28 days.
- Require enough observations before comparison language.
- Raw-value-only state when history is insufficient.
- Compact Recovery section on Today or secondary detail.

### Language

Allowed:

- `near recent baseline`
- `above recent baseline`
- `below recent baseline`
- numeric deltas

Not allowed:

- `readiness 72`
- `bad recovery`
- medical diagnosis
- deterministic instruction to skip/change a workout

### Exit gate

- Missing wellness never blocks Today.
- Baseline math tested with missing days/outliers.
- No automatic plan mutation.
- Wellness cache bounded.
- No proprietary readiness score.
- `npm run check` passes.

## UI-13 — Optional Plan Export Investigation

**Deferred. No implementation authorization.**

Before coding any Intervals write route, produce a decision/proposal covering:

- source of truth;
- external planned-workout ids;
- create/update/delete behavior;
- conflict/duplicate behavior;
- token/write-scope security;
- retries/rollback;
- what HealthFit actually receives from Intervals.

Then request product-owner approval for a separate phase.
