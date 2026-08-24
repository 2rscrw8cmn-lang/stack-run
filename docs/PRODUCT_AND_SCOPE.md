# STACK — Product and Scope

**Status:** current product source of truth for `main`.

STACK is a phone-first running product that turns actual training into something a runner can understand, act on and physically build.

> **Actual history says what happened. Plan says what was intended. A link says how an actual run relates to that intent.**

The runner's actual history is foundational. Plan is useful race-specific intent, Build is the tangible reward, and Crew is an optional social layer downstream of personal truth.

## Product promise

Open STACK and quickly answer:

1. **What matters today?**
2. **What have I actually been doing?**
3. **What does that history say about my running right now?**
4. **What am I planning to do next?**
5. **What am I building toward?**

The product should make training understandable without becoming a live tracker, a giant analytics dashboard, a public social network or an opaque coaching engine.

## Primary navigation

The current destination model is:

- **Today** — what matters now.
- **Build** — the tangible reward for runs recorded or accepted into STACK.
- **Runs** — actual history, current-running context, Training Signals, History and Run Detail.
- **Crew** — optional shared training/build context for a signed-in active Crew member.
- **Plan** — upcoming and historical race intent.

Crew is conditional. A runner with no active Crew membership keeps the personal product without a Crew destination.

Settings and Account & Crew are utilities/sheets, not primary destinations.

## Today

Today is a decision surface, not merely today's plan card.

It may surface:

- today's scheduled workout when one is genuinely due;
- a relevant Intervals run waiting for review;
- a completed run and the next Build/Crew action;
- compact recent-running context;
- the current week's actual running;
- at most one useful Training Signal;
- upcoming plan intent;
- Personal Build context;
- small, relevant Crew activity when available;
- a limited-time Crew Week Recap in the days after a Crew week closes.

Today does not own a second analytics engine or a second connected-data lifecycle. It consumes the shared history, Signals, Plan, Build and Crew systems.

## Runs

Runs is the factual running-history pillar.

Its product model is progressive disclosure:

- **Overview** — understanding;
- **History** — chronology and lookup;
- **Run Detail** — investigation.

### Unified actual history

STACK combines:

- accepted/manual `RunLog` records owned by STACK; and
- normalized historical Intervals running activities that may never have been accepted into a plan or Build.

One physical source activity should appear once. When a source activity also has a STACK `RunLog`, STACK-owned editable facts overlay the source mirror at read time rather than rewriting source history.

Historical-only activities are legitimate facts. They do not need acceptance to appear in history and do not silently earn Build blocks.

### Runs Overview

The overview is intentionally not exhaustive. It includes:

- a current running snapshot;
- a compact recent-training visualization;
- up to three featured Training Signals, with remaining Signals available through disclosure;
- three recent runs;
- entry to History.

### Training Signals

The current Signal families are:

1. Volume;
2. Frequency;
3. Long runs;
4. Workload;
5. Zone mix;
6. Plan context.

Signals are descriptive, not grades. Missing or weakly covered metrics are omitted rather than converted to zero. There is no overall training/readiness score.

### History Explorer

History supports multiple ranges and factual metrics such as miles, runs, time, source Training Load, elevation gain and zone composition. Longer ranges aggregate rather than shrinking labels until they are unreadable.

### Run Detail

Run Detail uses trusted source aggregates for stated summary numbers and on-demand source detail/streams for shape.

> **Source aggregates give numbers. Streams give shape.**

Where available, a connected run may show:

- distance, duration and derived pace;
- average/max heart rate;
- source elevation gain;
- source Training Load;
- cadence using the documented source convention;
- HR zones;
- structured interval detail;
- Pace / Heart Rate / Elevation / Cadence profile charts.

Do not recompute trusted summary facts from streams merely because stream samples exist.

## Plan

Plan is race-specific intent, not the authoritative record of whether the runner ran.

The current product carries zero or one active `TrainingPlan`. Completed or
replaced plans are immutable historical intent snapshots in `planHistory`.

Plan separates:

- what was scheduled;
- what the runner actually did in those dates; and
- which actual run has an explicit relationship to a planned workout.

A past workout with no explicit linked run is **No linked run**, not a judgmental `Missed` claim.

Actual historical activity does not automatically satisfy a planned workout. Existing explicit matching/linking rules remain authoritative.

Without an active plan, STACK still records actual history, earns and places
Personal Build blocks, shows runner signals, and supports optional Crew. Today
does not invent a rest day or race countdown. Plan offers a quiet race-setup
path and read-only access to prior plans.

## Personal Build

Build is STACK's distinctive emotional reward.

- A run recorded/accepted into STACK earns one deterministic Personal Build block.
- Historical-only source activities do not silently backfill Personal Build.
- The tower is eight columns wide and uses deterministic gravity/support rules.
- The runner deliberately places earned blocks.
- Deleting/editing runs repairs the structure under the existing domain rules.
- Placement motion is presentation only; it never changes deterministic geometry.

Build is not XP, a score, currency, levels or a generic achievement economy.

## Connected running data

The common Apple path is:

```text
Apple Watch → Apple Health → HealthFit → Intervals.icu → STACK
```

Other watch/services may connect to Intervals directly and skip HealthFit.

Manual logging remains a complete fallback.

### Intervals connection modes

STACK currently supports:

- the per-device personal Intervals API-key path; and
- a legacy protected proxy path retained for compatibility/deprecation work.

Intervals credentials remain device-local and outside personal AppState/cloud sync. They are never sent to Crew or stored in Supabase personal-state tables.

### Review and matching

Connected reads discover candidates. The runner explicitly chooses the approved relationship:

- match/link to a scheduled workout;
- accept as an extra run; or
- attach source data to an existing manual run.

Pending review is durable. A rolling Intervals query is not allowed to erase an unresolved candidate merely because the activity fell outside the next query window.

## Personal account and multi-device sync

Personal use remains available while signed out.

### Signed out

- schema-9 personal AppState is local browser state;
- no account is required for the core personal product.

### Signed in

The account's private Supabase data becomes canonical while local storage remains the offline/cache working copy.

Private personal cloud state is normalized across:

- `personal_training_state`;
- `personal_runs`;
- `personal_build_state`;
- `personal_intervals_state`.

Writes use authenticated revision/generation-enforcing RPCs rather than direct browser-table writes. Runs use durable identity/tombstone rules so stale devices cannot casually resurrect deleted data.

The complete personal AppState is not stored as one opaque cloud blob.

### Credentials remain local

Intervals API keys/proxy tokens are intentionally **not** part of personal cloud sync. A new device can receive canonical plan/runs/Build/review state while still requiring its own Intervals credential.

See `PERSONAL_ACCOUNT_SYNC.md` and `DATA_AND_STORAGE.md` for implementation detail.

## Crew

Crew is an optional invite-only social layer built from a narrow projection of accepted personal runs.

A signed-in account may belong to multiple Crews and views one Crew at a time.

Current Crew identity includes:

- Crew name/type/race context;
- Crew emblem;
- runner display name;
- runner color;
- Runner Icon.

### Crew types and relationship to personal Plan

Crew race metadata never silently rewrites a runner's personal plan. A mismatch is context/information, not plan mutation.

Club-style Crew behavior does not require every social metric to depend on a personal training plan.

### Shared Crew Build

Crew owns its own communal eight-column Build.

- eligible accepted/shared runs create runner-owned Crew blocks;
- the runner who earned a block places/moves that block;
- nobody places or moves a teammate's block;
- Crew placement coordinates are independent of Personal Build placement;
- server-side RPCs remain authoritative for collision/support/concurrency rules;
- the Crew Build has a Crew-owned build-start window;
- Member Build/history and Crew Build window semantics are intentionally distinct.

### Crew comparisons

The current shared comparison set is:

- Weekly Miles;
- Longest Run;
- Avg Pace;
- Miles Built;
- Awards.

There is no overall Crew score.

### Props

Props is lightweight encouragement attached to safe Crew-visible runs. It is intentionally not comments, DMs or a public social feed.

### Special Blocks / weekly awards

Completed Crew weeks can mint zero-mile Special Blocks. Current standard awards include Most Miles, Best Zone 2, Fastest Avg. Pace and Most Runs, plus a rotating Feature award where the required fact can be derived honestly.

Special Blocks:

- belong to one winner;
- are placed by that winner;
- participate in the same shared Build support/collision rules;
- never add to Miles Built;
- preserve the hollow-block visual system documented in `CREW_SPECIAL_BLOCKS.md`.

`Steady` intentionally produces no Feature award until a verified pace-variability scalar exists; STACK does not fabricate a fallback.

### Crew Week Recap

After a Monday–Sunday Crew week closes, STACK tells the Crew what it built that week: a short celebratory story derived from facts the Crew already shares — miles, runs, time, who ran, the week's standout efforts, the slice of the Crew Build the week added, and any Special Block already standing in the tower.

It is a story, not a second dashboard:

- it is derived on demand and never stored, so two members of the same Crew see the same shared-week facts;
- a beat with no evidence is omitted rather than padded or estimated, and a week with no shared running produces no recap;
- it never ranks the roster, never scores anybody, and never announces an unplaced Special Block;
- it is discovered in two places inside the same limited window — a teaser below Today's action surface and a notification below the Crew header — both of which open the same recap, share one seen/cleared record, and age out three days after the week closes;
- each page carries something the pages before it did not, which is why the story now ends by handing over to the new Crew week rather than restating the closed one.

Its Best Performances page may name a **source-verified Fastest 5K**: the time of a real 5,000 m effort inside a shared run, as the contributing runner's connected source reported it. STACK never estimates one from a run's average pace — a run under 5,000 m has no 5K — and a "fastest mile" stays unavailable for exactly that reason.

`docs/CREW_WEEK_RECAP.md` is the contract, including the recap presentation language later retrospectives reuse.

## Crew projection and privacy boundary

Crew never receives complete personal history/AppState or raw upstream payloads.

The projection is assembled field-by-field rather than spreading a `RunLog`.

### Current Crew-visible run facts

Depending on availability/validation, the projection may include:

- local run id for canonical Crew identity;
- local date;
- STACK activity type;
- distance;
- duration;
- run source (`manual` / `intervals`);
- sanitized Personal-Build placement facts used for Member Build;
- average, max and manual heart rate under the deliberate D-079 exception;
- narrowly derived award scalars required for deterministic Special Block ranking;
- one source-verified best-effort scalar, the fastest 5,000 m time, under the deliberate D-087 exception.

Optional constrained values are sanitized to `null` rather than being allowed to fail the entire Crew upload.

### Still private / never projected raw

Crew does **not** receive raw:

- Intervals credentials;
- Intervals external activity ids;
- source payloads;
- pace curves and per-sample streams (only the single derived 5K scalar above crosses the boundary);
- GPS/routes/location;
- exact start time;
- HR-zone arrays/raw zone durations;
- source Training Load;
- wellness data;
- effort;
- notes;
- private calendar/availability;
- complete personal AppState;
- complete historical Intervals mirror.

Heart rate is therefore no longer on the never-send list; it is a deliberate, narrow current exception. Raw zones and other health/history detail remain private.

See `CREW_PROJECTION_CONTRACT.md`, `RACE_CREW_IMPLEMENTATION.md` and `CREW_SPECIAL_BLOCKS.md` before widening this boundary.

## Cross Training

Cross Training is a current STACK activity type and may be recorded/accepted into personal state. Crew storage also permits Cross Training, including zero-distance sessions when valid.

Unified actual history includes approved Cross Training from the connected source when the source activity type has been verified on the real pipeline. The current verified mapping is `HighIntensityIntervalTraining` → Cross Training; STACK does not guess cycling, swimming, strength or other source aliases. Zero-distance Cross Training is valid.

Runs chronology can therefore show a source-only Cross Training session whether or not it was accepted into STACK. Running-specific interpretation remains running-only: mileage, run frequency, pace, long-run calculations, History metrics and Training Signals exclude Cross Training. Historical-only Cross Training never earns a Personal Build block and does not widen the Crew projection.

## Persistence boundaries

Current persistence is deliberately split by responsibility:

- **AppState/cache** — schema-9 personal configuration, plan, accepted runs and placement state;
- **private account tables** — canonical signed-in personal training/runs/Build/Intervals review state;
- **historical activity repository** — normalized source history outside AppState;
- **pending Intervals repository** — unresolved source-review queue outside AppState;
- **credential repository** — device-local sensitive Intervals credential;
- **Crew/Supabase shared tables** — approved social projection, memberships, Crew Build, Props, awards and identity data.

Do not collapse these into one persistence model merely for convenience.

## Design direction

Current visual direction is **Performance Arcade**.

The product-wide presentation principle is:

> **Interface is quiet. Data is STACK.**

Use normal sans typography for interface language and Space Mono/data typography for values, dates, units and machine-like labels where appropriate. Use typography, spacing and thin rules before adding another card/container.

`DESIGN_SYSTEM.md` is the central design reference; specialist chart/Build/Crew docs extend it.

## Current product boundaries

STACK is deliberately **not**:

- a live GPS/run tracker;
- a Strava clone;
- an Intervals dashboard clone;
- a route-mapping product;
- a public social network;
- a follower graph/DM/comment platform;
- an AI coach that autonomously rewrites plans;
- a medical/injury/readiness product;
- a generic game economy with XP/coins/quests;
- a full raw cloud archive of private source data.

Do not add infrastructure or product breadth merely because an upstream API makes it available.

## Known current limitations / explicit future decisions

The following are known product boundaries, not undocumented surprises:

- the legacy Intervals proxy path still exists alongside the verified direct local-key path;
- Crew `Steady` award awaits a verified pace-variability source;
- Best Efforts / personal records are not currently claimed;
- route/GPS data is intentionally absent;
- historical source activities do not automatically earn Personal Build blocks.

Forward product work is tracked in the Stabilization 1.xx and Evolution 2.xx GitHub issues rather than in this current-state document.

## Success criteria

STACK is doing its job when:

- the runner can understand today's next action quickly;
- connected data materially reduces manual work without silently inventing plan relationships;
- actual history remains trustworthy even outside one race plan;
- Signals communicate useful longitudinal context without grading the runner;
- Build makes accumulated training tangible;
- Crew makes training with friends more engaging without becoming a public network or leaking private history;
- social/backend failure never makes personal STACK unusable;
- missing data is omitted rather than fabricated;
- the code and product contracts remain understandable enough for small-team/agent-driven development.

## Authority

This document describes the current product on `main`.

For deeper subsystem behavior, read the relevant current specialist contract. Historical NEXT/UI/Race Crew phase documents explain how the product got here but do not override current behavior when they conflict.
