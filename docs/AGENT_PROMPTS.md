# Copy-Paste Agent Prompts

Use one prompt at a time. Do not combine connected phases.

UI-0 through UI-7 are implemented. The next implementation phase is UI-8.

---

## UI-8 — Connected Data Foundation

```text
You are implementing UI-8 — Connected Data Foundation for STACK.

Before changing code, read in this order:
- AGENTS.md
- START_HERE.md
- docs/PRODUCT_AND_SCOPE.md
- docs/CONNECTED_TRAINING.md
- docs/INTERVALS_INTEGRATION.md
- docs/CONNECTED_DATA_FIELDS.md
- docs/UX_PRODUCT_SPEC.md
- docs/DATA_AND_STORAGE.md
- docs/DECISION_LOG.md
- docs/ENGINEERING_STANDARDS.md
- docs/UI_IMPLEMENTATION_PLAN.md
- docs/QA_ACCEPTANCE.md
- docs/CURRENT_APPLICATION_STRUCTURE.md
- docs/DEPLOYMENT.md

Current product state:
- UI-7 is merged.
- Current AppState is schema version 8.
- Scheduled and extra RunLogs already exist.
- Block placements identify runLogId.
- Manual logging, Build, Plan editing, race generation, run-day preferences, availability import, installability and storage recovery already work.
- api/calendar.ts is existing serverless code. Do not break it.

Goal:
Securely read the user's HealthFit-originated Intervals.icu running activities and let the user confirm/attach them to STACK without retyping objective run data.

The approved data path is:
Apple Watch -> Apple Health -> HealthFit -> Intervals.icu -> STACK.

IMPORTANT SECRET RULES:
- NEVER ask for, commit, print, test with, or place INTERVALS_API_KEY in client code.
- INTERVALS_API_KEY is a Vercel/server environment secret only.
- It must never be prefixed VITE_.
- The browser authenticates to STACK's read proxy with a separate STACK_SYNC_TOKEN.
- STACK_SYNC_TOKEN is also configured server-side; the user enters the same token into the app once.
- Send the sync token in X-Stack-Sync-Token, never a query string.
- Tests must pass with no real secrets.

Required work — server proxy:
1. Add api/intervals.ts.
2. GET only. Read only.
3. Whitelist these resources only:
   - status
   - activities
   - activity detail
   - wellness (route may exist but no wellness UI in UI-8)
4. Do NOT accept arbitrary upstream URLs, methods or paths.
5. Authenticate to Intervals personal API using HTTP Basic auth with username API_KEY and password process.env.INTERVALS_API_KEY.
6. Use athlete/0 where applicable.
7. Require X-Stack-Sync-Token to match process.env.STACK_SYNC_TOKEN before reading private data.
8. Validate activity ids and YYYY-MM-DD date ranges; cap activity/wellness ranges at 120 days.
9. Send Cache-Control: no-store.
10. Never log credentials or activity/wellness bodies.
11. Normalize missing config, upstream 401/403, 429/Retry-After and upstream 5xx into safe small responses.
12. Use a clear STACK User-Agent for upstream calls.
13. Keep api/calendar.ts working unchanged unless a shared helper is genuinely smaller and thoroughly tested.

Required work — connection token:
1. Add a tiny repository for the local STACK sync token under a dedicated key outside AppState, e.g. stack.intervals.sync-token.v1.
2. Add a secondary Run Data connection sheet/surface; do NOT add a fourth tab.
3. Disconnected state asks only for the STACK sync token, never the Intervals API key.
4. Add Test/Connect.
5. Connected state shows Intervals.icu connected, last successful activity sync, Sync Now, Forget Connection and low-priority Clear Ignored Activities.
6. Forgetting the connection removes only the local token, not imported runs.
7. Surface storage failure using the app's existing recovery/write-error patterns.

Required work — schema 9:
1. Implement schema version 8 -> 9 exactly as docs/DATA_AND_STORAGE.md specifies.
2. Existing runs become source='manual', externalSource=null, importedMetrics=null.
3. Add intervalsSync with null last-success and empty ignored ids.
4. Preserve every current run id/workoutId/date/value/timestamp.
5. Preserve every placement, plan edit, availability calendar, run-day preference and race setup.
6. Do not invent imported runs.

Required work — Intervals client and normalization:
1. Add a client that calls only the same-origin /api/intervals proxy.
2. First connection/backfill may request up to the previous 90 days.
3. Normal sync uses a rolling 14-day lookback ending today.
4. No continuous polling.
5. Normalize raw responses into STACK-owned candidate types; do not leak raw Intervals objects through React.
6. Minimum valid candidate: external id, verified running type, valid local date, positive distance, positive moving time or elapsed fallback.
7. Convert meters -> miles at the boundary.
8. Use moving time for STACK duration when positive, elapsed time as fallback; preserve elapsed separately when both exist.
9. Optional metrics are independently validated and omitted when missing/invalid.
10. Repeated external activity id must never create another RunLog.
11. Suppress ids explicitly stored in ignoredActivityIds.

Required work — REAL FIELD DISCOVERY:
A real HealthFit-originated run from June 10, 2026 already exists in the user's Intervals.icu account.
The implementation must support a deployed smoke test that fetches it through /api/intervals.
After the real test, update docs/CONNECTED_DATA_FIELDS.md with:
- the exact Intervals source type for that Apple Watch/HealthFit run;
- verified distance unit;
- moving/elapsed-time behavior;
- whether avg/max HR, cadence, elevation gain, training load and HR-zone data are present;
- any source-specific caveat.
Do NOT commit the raw response or GPS/location data.
Do not hard-code a broad running-type allowlist until the real type is known. Keep the normalizer able to add verified types cleanly.

Required work — matching/import:
1. Remote runs are suggestions until confirmed.
2. Candidate planned workouts are unmatched non-rest workouts within +/-2 calendar days.
3. Rank by closest date, then safe distance fit, then deterministic date/id tie-break.
4. Safely parse only simple numeric target or numeric range; otherwise omit distance scoring rather than guess.
5. Show actual and planned date when they differ.
6. User can Confirm Match or Add as Extra Run.
7. Scheduled import defaults STACK activityType from planned workout.
8. Extra import asks/confirms STACK activityType, default Easy.
9. Ask Rough/Solid/Great and optional notes; do not make the user retype objective date/distance/duration.
10. Accepted run stores normalized source metadata and optional imported metrics and earns the normal normal Build block.

Required work — existing manual-run enrichment:
1. If a remote activity likely represents an existing manual RunLog, offer Attach Synced Data instead of a duplicate.
2. Preserve existing RunLog.id, workout link, effort, notes and placement identity.
3. Clearly show objective date/distance/duration differences before replacing those values.
4. Attach external activity id/imported metrics.
5. If the run already has a placed block and remote distance crosses a Build width band, do NOT silently repack the tower in UI-8. Preserve existing placed geometry and document the mismatch.

Required work — ignored/deleted imports:
1. Explicit Ignore This Activity stores its external id.
2. Closing a suggestion does not permanently ignore it.
3. If an imported Intervals run is deleted locally, confirm whether its source id should remain ignored so normal sync does not resurrect it.
4. Clear Ignored Activities makes this reversible.

Testing:
- api/intervals missing API key
- missing/wrong STACK sync token
- valid proxy authorization
- invalid date range/activity id
- upstream 401/403
- upstream 429 and Retry-After
- upstream 5xx
- no-store response
- schema 8 -> 9 lossless additive migration
- activity normalization minimum fields
- invalid optional metric omitted rather than failing run
- non-running activity ignored
- repeated external id dedupe
- ignored id suppression
- scheduled-match suggestion
- extra-run import
- attach-to-existing manual run preserving id/link/effort/notes/block identity
- manual run entry works disconnected
- current availability/calendar server route still works

Hard boundaries:
- No wellness/recovery UI in UI-8.
- No training trends.
- No complex run charts.
- No Intervals writes.
- No OAuth/webhooks.
- No FIT parser.
- No live workout tracking/GPS.
- No new persistent navigation tab.
- No secret-dependent automated tests.

Verification:
1. npm install
2. npm run check with NO Intervals secrets available
3. Production build checks at 320, 390, 768, 1280px
4. Deploy preview with INTERVALS_API_KEY + STACK_SYNC_TOKEN configured in Vercel
5. On the user's iPhone, connect using only STACK_SYNC_TOKEN
6. Backfill far enough to include June 10
7. Verify the real HealthFit run is found
8. Update CONNECTED_DATA_FIELDS.md from that real response
9. Accept/attach it
10. Reopen/sync again and confirm no duplicate
11. Confirm INTERVALS_API_KEY is absent from browser localStorage/source/network payloads
12. Confirm /api/intervals refuses a request with no/wrong sync token

Documentation:
- Update docs/CONNECTED_DATA_FIELDS.md from real validation.
- Update docs/CURRENT_APPLICATION_STRUCTURE.md.
- Update docs/PHASE_STATUS.md.
- Update docs/DEPLOYMENT.md only if implementation differs from the approved contract.
- Do not weaken D-033 through D-037.

Deliver one focused UI-8 pull request.
```

---

## UI-9 — Connected Run Detail

```text
You are implementing UI-9 — Connected Run Detail after UI-8 is merged.

Read:
- AGENTS.md
- START_HERE.md
- docs/CONNECTED_TRAINING.md
- docs/INTERVALS_INTEGRATION.md
- docs/CONNECTED_DATA_FIELDS.md
- docs/UX_PRODUCT_SPEC.md
- docs/DATA_AND_STORAGE.md
- docs/UI_IMPLEMENTATION_PLAN.md
- docs/CURRENT_APPLICATION_STRUCTURE.md

Goal:
Make imported run data useful without rebuilding Intervals.icu inside STACK.

Required:
1. Preserve the existing primary run facts: date, distance, duration, effort, notes, plan/extra context.
2. Derive and show pace from STACK distance/duration.
3. Show avg/max HR only when verified/present.
4. Show cadence only after CONNECTED_DATA_FIELDS documents its real semantics/units.
5. Show elevation gain and training load when verified/present.
6. Show HR-zone distribution only from verified source zone data; include text labels/durations/percentages.
7. Add quiet Synced via Intervals.icu source context.
8. Fetch activity detail/intervals on demand, not for every synced activity.
9. Show interval/lap rows for a verified structured workout only when the source grouping is understandable.
10. Omit missing fields. Never render guessed 0 values.

Do not:
- add wellness UI;
- add Training Trends;
- add a map/raw stream chart;
- add a FIT parser;
- add a chart library;
- write upstream.

Testing:
- minimum-field imported run detail
- every optional metric absent
- each optional metric present
- HR-zone accessibility
- detail fetch success/failure/rate-limit
- structured interval fixture
- manual-run detail remains unchanged

Exit:
- npm run check passes
- run detail works at 320/390/desktop
- optional metrics degrade cleanly
- no unnecessary detail requests during normal sync
- update CURRENT_APPLICATION_STRUCTURE and PHASE_STATUS
```

---

## UI-10 — Connected Today + Week

```text
You are implementing UI-10 — Connected Today + Week after UI-9 is merged.

Read the connected-data source-of-truth docs first.

Goal:
Make sync feel like part of normal daily use rather than a separate import workflow.

Required:
1. Add stale-aware quiet sync on app open/focus.
2. Prevent duplicate focus/request storms.
3. Keep manual Sync Now.
4. No continuous polling.
5. When a strong unimported candidate exists for today's/recent planned workout, Today's actionable area shows Run Found with actual distance/duration/pace and avg HR when present.
6. Actions: Confirm Match, Extra Run, temporary dismiss, explicit ignore.
7. Confirmation continues into the existing imported-run confirmation/Build reward flow.
8. This Week adds actual miles, total run time and longest run while keeping scheduled N-of-M completion separate.
9. Extra runs contribute actual stats but not scheduled completion/streak.
10. Show quiet sync failure/retry without displacing the planned workout when no candidate exists.
11. Late uploads remain discoverable through the rolling lookback.

Hard boundaries:
- no fourth tab
- no trend dashboard yet
- no wellness
- no automatic plan edits
- no continuous polling

Testing:
- sync stale/fresh behavior
- focus de-bounce/dedupe
- run-found state
- no candidate state
- sync error manual fallback
- weekly actual stats with scheduled + extra runs
- delayed older activity still surfaced
- 320px hierarchy

Exit:
- Today is still understandable in under five seconds
- npm run check passes
- production iPhone test after a HealthFit sync works
- update docs
```

---

## UI-11 — Training Trends

```text
You are implementing UI-11 — Training Trends after connected Today is stable.

Goal:
Answer whether training is accumulating/progressing toward the active race without creating a generic analytics dashboard.

Navigation:
- Secondary view opened from Today/Plan.
- Do NOT add a fourth bottom-nav destination.

Required first trend set:
1. Weekly actual mileage.
2. Long-run distance progression.
3. Scheduled-workout consistency percentage.
4. Easy-run average pace trend.
5. Easy-run average-HR trend only when enough runs have HR.
6. Text summary and low-data state for every visual.
7. Clear date ranges and units.
8. Use actual run dates.
9. Manual and imported runs participate equally once recorded.

Coverage guardrails:
- Easy pace: at least 4 Easy runs before drawing a trend conclusion.
- Easy HR: at least 4 Easy runs with valid avg HR.
- Do not interpolate missing HR as zero.
- Use simple descriptive language; no race prediction.

Visualization:
- Prefer CSS or inline SVG.
- No chart dependency without explicit approval.
- Accessible text alternative.
- One idea per chart on phone.

Do not:
- add AI coaching
- create a readiness score
- add generic CTL/ATL/form dashboards
- add race-time prediction
- auto-change plan

Testing:
- weekly grouping by actual date
- extra runs included in actual mileage
- scheduled consistency excludes extra runs
- Long Run filtering
- Easy pace/HR coverage thresholds
- missing HR handling
- accessibility of chart summaries

Exit:
- npm run check passes
- charts are legible at 320px
- low-data states do not overclaim
- update docs
```

---

## UI-12 — Wellness / Recovery Context

```text
You are implementing UI-12 only if docs/CONNECTED_DATA_FIELDS.md confirms that useful HealthFit-originated wellness data is actually present in Intervals.icu.

If no useful wellness field is Verified, STOP and report the missing source coverage instead of building an empty Recovery section.

Read:
- AGENTS.md
- docs/CONNECTED_TRAINING.md
- docs/INTERVALS_INTEGRATION.md
- docs/CONNECTED_DATA_FIELDS.md
- docs/UX_PRODUCT_SPEC.md
- docs/DATA_AND_STORAGE.md
- docs/DECISION_LOG.md

Goal:
Show compact, non-prescriptive recovery context from the runner's own recent data.

Required, only when verified:
1. Wellness-range proxy/client call through the existing protected read path.
2. Normalize verified fields such as HRV, resting HR, sleep duration; steps/weight only when genuinely useful.
3. If local persistence is needed, use a bounded recent cache (target <=120 days) and a documented schema migration.
4. Build a runner-relative baseline helper, preferring 28-day history.
5. Require enough observations before saying above/below/near baseline; with insufficient history show raw values only.
6. Add a compact Recovery section, preserving Today hierarchy.
7. Missing field/day never breaks Today.

Allowed language:
- near recent baseline
- above recent baseline
- below recent baseline
- numeric delta

Forbidden:
- readiness score
- medical diagnosis
- red/green health grade
- automatic plan edits
- instruction to skip a workout purely because one metric changed

Testing:
- missing days
- missing individual fields
- insufficient baseline history
- baseline calculation
- bounded cache
- sync errors
- no plan mutation

Exit:
- npm run check passes
- no proprietary readiness score exists
- recovery UI disappears/degrades cleanly when source data is absent
- real iPhone/Intervals wellness smoke test passes
- update docs
```

---

## Connected phase review prompt

```text
Review the current Connected Training pull request against:
- AGENTS.md
- START_HERE.md
- docs/PRODUCT_AND_SCOPE.md
- docs/CONNECTED_TRAINING.md
- docs/INTERVALS_INTEGRATION.md
- docs/CONNECTED_DATA_FIELDS.md
- docs/DATA_AND_STORAGE.md
- docs/DECISION_LOG.md
- the active section of docs/UI_IMPLEMENTATION_PLAN.md
- docs/QA_ACCEPTANCE.md
- docs/CURRENT_APPLICATION_STRUCTURE.md

Focus findings by severity on:
1. Secret exposure or an unprotected private-data proxy.
2. Any Intervals write route introduced outside an approved write phase.
3. Duplicate imported activities / broken external-id ownership.
4. Lossy schema migration or damage to existing runs/blocks/plans.
5. Remote activity silently changing plan or attaching without confirmation.
6. Missing imported metric represented as zero/guessed data.
7. Manual logging broken by connection absence/failure.
8. Polling/request storms/rate-limit handling.
9. Health/recovery overclaiming, readiness scores or automatic plan changes.
10. Product hierarchy drift: fourth tab, analytics wall, Build becoming a metrics screen.
11. Mobile/accessibility failures at 320px.
12. Raw personal payloads or credentials in tests/logs/docs.
13. Unnecessary dependencies/abstractions.

Run npm run check with no real secrets. For UI-8+ also review the documented real-data smoke-test evidence separately; automated CI must not depend on credentials.
Do not implement future phases during review.
```
