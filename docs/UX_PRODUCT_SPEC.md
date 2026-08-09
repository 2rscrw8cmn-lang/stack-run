# UX Product Specification

## Experience principles

### 1. One useful answer per screen

- Today: what matters today and this week
- Build: what the user has actually built
- Plan: the editable dated schedule

### 2. Completion earns something

Finishing any run earns one block. Connected data may remove typing, but it does not remove the placement reward.

### 3. Playful, not complicated

Build feels like a small digital construction toy. The user should not need to understand packing rules or sports-science models.

### 4. Actual running matters more than the original plan

The plan is guidance. Extra runs and the actual date/run metrics belong to the runner even when the plan did not ask for them.

### 5. Quiet interface

Use restrained hierarchy. A card is for the one actionable thing; other bands use Sections. Connected data is progressive disclosure, not a wall of metrics.

### 6. Source data may be incomplete

Heart rate, cadence, elevation, load, HRV and sleep are optional. Omit unavailable metrics. Never render a missing health metric as zero.

## Information architecture

Persistent bottom navigation remains exactly:

- Today
- Build
- Plan

No persistent Stats, Profile, Sync or Settings tab.

Secondary surfaces may include:

- Run Data connection sheet
- Run detail
- Training Trends
- Plan settings/edit sheets

## Global header / screen lead

UI-7 established the visual hierarchy:

- small STACK brand lockup, not a headline;
- each screen has exactly one `h1` containing the thing the screen is about;
- Today leads with date;
- Build leads with the miles/runs that made the tower;
- Plan leads with the week.

Connected Training must preserve this hierarchy.

## Today

Today is the daily command center.

Order:

1. Date + race context.
2. Today's planned workout / completion state / run-found state.
3. This Week.
4. Next workout.
5. `+ Log Run` manual fallback.
6. Build preview.
7. Quiet connection/sync affordance where it does not compete with the workout.

### Today's planned run — no synced candidate

Show the existing scheduled card:

- type/icon/color;
- target;
- instructions;
- `Mark Complete` for manual entry.

Connected data must not remove manual entry.

### Run found

When sync returns an unimported running activity that is a likely match for today's/recent planned workout, the actionable card becomes a run-found confirmation.

Show:

- `Run found`
- actual distance
- actual duration
- derived pace
- average HR if present
- activity date when it differs from today
- proposed planned-workout match

Actions:

- `Confirm Match`
- `Extra Run`
- `Not This Run` / dismiss without ignoring permanently

Example:

```text
RUN FOUND
3.21 mi · 31:42
9:53 /mi · 146 avg HR

Likely match
Tuesday · 3 mi Easy

[ Confirm Match ]
[ Extra Run ]
```

Never silently create the link.

### Confirm imported run

For a scheduled match, do not ask the user to type date/distance/duration again.

Ask only:

- Rough / Solid / Great
- optional note

Default STACK activity type from the planned workout.

For an extra run, also ask for activity type:

- Easy (default)
- Intervals
- Simulation
- Long Run
- Race only when appropriate/explicit; do not infer Race from distance.

On save:

- create/attach the local RunLog;
- preserve imported source metrics;
- earn one block;
- surface `Place Block`.

### Existing manual run + remote match

When a remote activity appears to represent a manual run already in STACK, show `Attach synced data`, not another completed run.

The confirmation must make objective differences visible before replacing local objective values.

Keep:

- existing local run id;
- plan link;
- effort;
- notes;
- block identity/placement.

### This Week

Show scheduled completion separately from actual activity.

Required:

- scheduled runs complete / scheduled runs;
- day strip/status;
- actual miles this week after UI-10;
- extra-run count when non-zero.

Possible UI-10 additions, kept compact:

- total run time;
- longest run.

Do not let extra runs inflate `N of M scheduled runs complete`.

### Next

Show next scheduled non-rest workout:

- day/date
- target
- type

Omit when there is nothing left before the race.

### Sync status

Do not add a large connection card to Today.

Use a quiet control/state such as:

- `Synced 2m ago`
- `Sync`
- `Sync failed · Retry`

Connection setup opens a secondary `Run Data` sheet.

## Run Data connection sheet

Access from a low-priority Today/Plan action. It is not a persistent tab.

Disconnected state:

- explain `HealthFit → Intervals.icu → STACK` in one sentence;
- field for the local `STACK_SYNC_TOKEN` only;
- `Connect` / `Test Connection`;
- never ask for the Intervals API key in the browser UI.

Connected state:

- `Intervals.icu · Connected`
- last successful activity sync
- `Sync Now`
- recent sync error if any
- `Forget Connection` (removes local sync token, not imported runs)
- `Clear ignored activities` as a low-priority action
- later, wellness sync status when UI-12 exists

No API key display.

## Manual Log Run sheet

Manual mode remains available for scheduled and extra runs.

Fields:

1. Date
2. Activity type when needed
3. Distance
4. Duration
5. Effort
6. Notes

Rules from the current product stay intact.

For an imported run, use a separate confirmation form/state rather than pretending imported objective fields are ordinary editable text inputs.

## Build

Build remains what was actually constructed.

Connected data does not add charts/HR zones to the tower.

### Heading

Keep UI-7's content-first Build heading:

- actual miles
- runs
- streak

### Blocks Ready

Imported and manual runs are indistinguishable as blocks except for optional source context in detail.

Show:

- activity icon/type
- date
- miles
- block footprint
- `Place`

### Tower

- continuous 8 columns
- only placed blocks
- no future blueprint
- width from actual distance
- height from STACK activity type
- newest placement glow only
- direct/tap/keyboard placement paths preserved

### Block/run detail

Primary:

- date
- distance
- duration
- pace
- effort
- notes
- planned-workout context or `Extra run`

Imported secondary metrics when present:

- avg/max HR
- cadence
- elevation gain
- training load
- HR-zone summary

Source label may say `Synced via Intervals.icu` quietly.

Do not show unavailable rows.

## Plan

Plan remains the complete editable schedule.

Connected data affects completion, not plan ownership.

### Week lead

Keep UI-7 merged week lead:

- week number/date range/phase
- scheduled completion
- previous/next/current controls

After UI-10, weekly actual mileage may appear as a secondary fact if it fits without crowding.

### Workout row/detail

A linked imported run is completed exactly like a linked manual run.

Detail may show imported metrics under `Actual run`.

Sync never moves, edits or creates planned workouts in UI-8 through UI-12.

## Training Trends — secondary view, UI-11

Do not add a fourth bottom-navigation item.

Open from Today with a secondary `View Trends` action after there is enough data.

First trend set:

- weekly actual mileage;
- long-run distance progression;
- scheduled-workout consistency percentage;
- Easy-run average pace;
- Easy-run average HR when coverage is adequate.

Charts:

- accessible text summary accompanies each visual;
- simple CSS or inline SVG is preferred;
- no chart-library dependency without approval;
- no dual-axis spaghetti charts on a phone;
- empty/low-data states say what is needed for a trend.

## Connected Run Detail — UI-9

Primary row:

```text
5.12 MI     49:08     9:36 /MI
```

Secondary metric grid when present:

```text
AVG HR      148
MAX HR      164
CADENCE     169
GAIN        121 ft
LOAD         62
```

### HR zones

If verified zone-time data exists, show a simple horizontal distribution with labels and durations/percentages.

Do not invent zone values if the source does not provide them.

### Intervals/laps

For structured sessions, activity detail may show work/rest rows from verified Intervals `icu_intervals` data.

Only show when grouping makes sense. An easy run does not need a fake interval table.

## Wellness / Recovery — UI-12

Build only after `docs/CONNECTED_DATA_FIELDS.md` confirms real data coverage.

Today may show a small Recovery section:

- HRV
- resting HR
- sleep
- optional steps/weight if useful

Use runner-relative context, not population grades.

Example:

```text
RECOVERY
HRV       48 ms      near recent baseline
Rest HR   54 bpm     +2 vs recent baseline
Sleep     7h 21m
```

Rules:

- require enough historical observations before writing baseline language;
- raw value is always acceptable when history is insufficient;
- neutral wording only;
- no red `bad recovery` score;
- no readiness number;
- no automatic plan edits;
- no medical diagnosis/advice.

## Imported-data missing states

Examples:

- no HR → omit HR rows;
- no cadence → omit cadence;
- no wellness for today → show no Recovery section or a quiet `No recovery data` state, depending on context;
- sync offline/error → manual app remains functional.

Never fill missing data with `0`, `--` in a dense dashboard, or a guessed value.

## Matching behavior

Matching suggests, user decides.

Candidate window:

- unmatched scheduled non-rest workouts within ±2 calendar days.

Ranking:

1. exact/closest date;
2. best safely parsed distance fit;
3. deterministic tie-break.

Show both actual and planned dates when they differ.

If no suitable match exists, offer `Extra Run`.

## Ignore behavior

Closing a suggestion is temporary.

An explicit `Ignore this activity` prevents it from returning on normal sync.

Ignored activities can be restored by clearing the ignored list from Run Data settings.

Deleting an already imported Intervals run should add the external activity id to the ignored list so normal sync does not resurrect it.

## Sync behavior

- first connect/backfill: up to 90 days;
- normal sync: rolling 14-day lookback;
- quiet sync on open/focus when stale;
- manual `Sync Now`;
- no continuous polling;
- honor rate limiting;
- manual entry remains usable during errors.

## Accessibility

Existing UI-7 accessibility requirements remain.

Connected additions:

- imported metrics have text labels, not color-only meaning;
- sync status announced appropriately without repeated noisy live-region updates;
- charts have textual summaries;
- drag remains optional and never the only block-placement method;
- connection errors are readable and actionable;
- health trend arrows/symbols always include words/values.

## Active implementation order

The original UI-0 through UI-7 program is implemented.

Next:

1. UI-8 Connected Data Foundation
2. UI-9 Connected Run Detail
3. UI-10 Connected Today + Week
4. UI-11 Training Trends
5. UI-12 Wellness / Recovery Context

Source of truth: `docs/CONNECTED_TRAINING.md` and `docs/INTERVALS_INTEGRATION.md`.
