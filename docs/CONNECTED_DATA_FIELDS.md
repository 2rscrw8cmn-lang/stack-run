# Connected Data Field Catalog

**Status:** discovery checklist.  
**Purpose:** verify what HealthFit actually delivers through Intervals.icu before STACK builds UI around it.

Do not mark a field `Verified` because Intervals.icu documents it in general. It is verified only when the user's real HealthFit-originated data contains it in the API response.

## Real fixture

The first real fixture is the Apple Watch run that HealthFit successfully synced to Intervals.icu on **June 10, 2026**.

UI-8 must fetch that activity through the deployed STACK proxy and update this file with the actual result.

### Verified on the deployed app, August 9, 2026

An Apple Watch → HealthFit → Intervals.icu run was synced, matched to a
scheduled Long Run and imported on the production deployment. Everything marked
`Verified` below was verified this way: STACK's normalizer reads one specific
field name for each value and drops anything absent or non-numeric, so a value
rendered in the app is a field that was present in the real response.

`icu_hr_zone_times` arrived with **seven** entries, four of them zero — real
zeroes from the source, not gaps. Cadence stayed `Expected`: STACK does not
render it, so this run says nothing about whether it was there. The activity
had no named interval groups, which is the expected result for an unstructured
run rather than evidence about structured ones.

No raw response, and no personal or location metadata, is recorded here.

### Verified on the deployed app, August 13, 2026

A second Apple Watch → HealthFit → Intervals.icu run was reviewed on a real
iPhone against Intervals' and HealthFit's own displays of the same activity.
This is the review that settled cadence and corrected how Run Detail states
its numbers.

What the three sources said about the same run:

| Reading | STACK | Intervals.icu | HealthFit |
|---|---|---|---|
| Pace | ~10:59 /mi | 10:58 /mi | 11:00 /mi |
| Average HR | 153 | 153 | 153 |
| Max HR | 174 | 174 | 174 |
| Elevation gain | ~116 ft (`Gain`) | 115 ft (`Climbing`) | 20 ft |
| Cadence | 79 | 79 (interval rows 79 / 79 / 80) | — |

The activity had no named interval groups, which is again the expected result
for an unstructured run.

#### Elevation gain is the source's, not a recomputation

The altitude series for this run spans roughly **72–113 ft** across all three
apps — a range of about 41 ft — while Intervals reports 115 ft of Climbing and
HealthFit reports 20 ft. Those are three different questions, not three
answers to one: climbing accumulates every rise over the whole run, the
altitude range is a single low-to-high span, and HealthFit is applying its own
much coarser threshold.

STACK's 116 ft is therefore **not a conversion bug**. It is Intervals'
`total_elevation_gain` converted to feet and rounded, and it agrees with
Intervals to within the rounding. The rule this establishes:

> Where STACK already holds an imported activity aggregate, that aggregate is
> what STACK shows. Summary statistics are never recomputed from per-sample
> stream data.

Recreating gain by summing altitude deltas would produce a number that agrees
with nothing the runner can check, and would silently depend on a smoothing
threshold STACK has never verified. `docs/CURRENT_APPLICATION_STRUCTURE.md`
records the same rule for pace and heart rate.

#### Cadence convention

`average_cadence` came back as **79**, and Intervals' own interval rows for
this activity read 79 / 79 / 80. That is the figure Intervals displays.

STACK shows **79**.

It does not double the value into a ~158 steps-per-minute figure, and it does
not print a unit beside it. Both would be claims this pipeline has not
verified: the only source-verified fact is the number itself and the fact that
it matches what Intervals shows the same runner. If a later real payload
establishes the unit, add it here first and only then in the UI.

This is what moved cadence from `Expected` to `Verified` after five phases of
being deliberately withheld.

Do not paste the full raw API response into this repository: it can contain personal health/location metadata. Record field names, presence, units/semantics, and a harmless example shape only.

## Status values

- `Expected` — documented/candidate, not yet verified on the user's pipeline.
- `Verified` — seen on the June 10 or later HealthFit-originated activity.
- `Missing` — checked and absent from the tested pipeline.
- `Deferred` — available somewhere in the ecosystem but not needed for the current phase.

## Minimum activity fields

| STACK concept | Intervals candidate | Status | Notes |
|---|---|---|---|
| External activity id | `id` | Verified | Opaque dedupe key. |
| Local start date/time | `start_date_local` | Verified | Use local date for matching. |
| UTC start | `start_date` | Expected | Preserve only if useful for diagnostics. |
| Source activity type | `type` | Verified | `Run` on the August 9 HealthFit activity, which is the one value the allowlist carries. |
| Name | `name` | Expected | Display optional. |
| Distance | `distance` | Verified | Meters. 9,012 m read back as 5.6 mi. |
| Moving time | `moving_time` | Verified | Preferred STACK duration when positive. |
| Elapsed time | `elapsed_time` | Expected | Fallback duration / detail. |
| Source updated time | `updated` or equivalent | Expected | Do not depend on until verified. |

UI-8 may not ship import until the first six concepts above are understood well enough to create a valid run safely.

## Run summary metrics

| STACK metric | Intervals candidate | Status | UI phase | Notes |
|---|---|---|---|---|
| Average HR | `average_heartrate` | Verified | UI-9 | bpm. 153 on the August 13 activity, agreeing across Intervals and HealthFit. |
| Max HR | `max_heartrate` | Verified | UI-9 | bpm. 174 on the August 13 activity, agreeing across Intervals and HealthFit. |
| Average cadence | `average_cadence` | Verified | UI-23 | Number, no unit stated by the source. **79** on the August 13 activity, matching the figure Intervals itself displays and its own interval rows (79 / 79 / 80). STACK renders the number verbatim — see "Cadence convention" below. |
| Elevation gain | `total_elevation_gain` | Verified | UI-9 | Meters; converted to feet for the current UI. 115 ft as Intervals' Climbing, 116 ft as STACK's Gain after rounding — see "Elevation gain is the source's, not a recomputation" below. |
| Training load | `icu_training_load` | Verified | UI-9 | Intervals-derived; labelled plainly as Training Load. |
| HR zone times | `icu_hr_zone_times` | Verified | UI-9 | Seven entries, seconds, zone 1 first. Zeroes are real; STACK shows every zone rather than guessing which are meaningful. |
| Average speed | `average_speed` | Expected | Deferred | STACK derives pace from distance/duration; use only if needed for diagnostics. |
| Perceived exertion / Apple effort | source-dependent | Expected | Deferred | Do not map into Rough/Solid/Great until actual semantics are verified. |

## Interval / lap metrics

Activity detail may be requested with:

```text
GET /api/v1/activity/{id}?intervals=true
```

Intervals.icu documents `icu_intervals` entries that may include:

- distance;
- moving time;
- elapsed time;
- average/min/max HR;
- average/min/max cadence;
- average/min/max speed;
- total elevation gain;
- interval type / work-rest classification;
- start/end indexes/times.

| Concept | Status | UI phase | Rule |
|---|---|---|---|
| `icu_intervals` exists on HealthFit run | Expected | UI-9 | The August 9 run returned no named groups, as an unstructured run should. Still needs a structured Apple Watch workout to verify. |
| Work/rest intervals are useful | Expected | UI-9 | UI-9's mock fixture verifies named/timed-row handling; real HealthFit grouping is still required. Only explicitly named, positively timed groups are shown. |
| Apple workout laps survive sync | Expected | UI-9 | Verify with an interval session. |

Do not fetch detail for every activity during normal list sync.

## Run Profile streams (Run Detail 2.0)

Run Detail 2.0 added an on-demand chart of one metric over the run's elapsed
time, with selectors for whichever metrics actually have data. The stream
values come from a second endpoint, requested only when a synced run's detail
sheet is open — never during ordinary sync, and never persisted beyond the
open sheet's component state:

```text
GET /api/v1/activity/{id}/streams.json?types=time,heartrate,altitude,velocity_smooth,cadence
```

### Real-source path verified on iPhone, August 18, 2026

During R3 / PR #122, the owner connected Intervals on the Vercel preview
hostname and reopened a real Intervals-backed personal run in iPhone Safari.
The production direct local-key stream request completed and STACK rendered a
real Run Profile through `normalizeIntervalsRunProfile` and the production
Run Profile components.

The earlier apparent failure was not a source or normalizer failure. The
Intervals API key is intentionally stored in account-scoped browser
`localStorage`, so the preview hostname had no source reader until Intervals
was connected on that browser/domain. Once connected, the same real run
rendered the Run Profile successfully.

This verifies the **direct local-key transport path and payload compatibility
with the current normalizer**. It does not, by itself, promote every individual
stream's units/semantics: those remain `Expected` until each metric is
explicitly spot-checked against source truth. No raw stream values, route data,
GPS, credential material or complete source payload are recorded here.

| STACK concept | Intervals candidate | Status | UI phase | Notes |
|---|---|---|---|---|
| Elapsed-time axis | `time` stream | Expected | UI-23 | Required by the normalizer and therefore present in at least one real payload that produced a Run Profile, but exact units/sample semantics have not been separately recorded. |
| Heart rate over time | `heartrate` stream | Expected | UI-23 | bpm per sample. Shape only — the stated Avg/Max come from the verified summary aggregates. Still needs an explicit source spot-check before promotion. |
| Elevation over time | `altitude` stream | Expected | UI-23 | Meters per sample; converted to feet. The only series whose own low/high are stated, because those are properties of the series. Total gain is **not** derived from it. Still needs explicit source spot-check. |
| Pace over time | derived from `velocity_smooth` stream | Expected | UI-23 | Metres/second under the candidate contract; STACK derives seconds-per-mile rather than trusting an assumed-unit `pace` field. Shape only — the stated pace is the run's own. Still needs explicit source spot-check. |
| Cadence over time | `cadence` stream | Expected | UI-23 | Verbatim, per the verified aggregate convention above. A zero sample is a stop, so it is treated as absent and drawn as a gap. Stream convention still needs explicit source spot-check. |

The R3 owner-device test establishes that the real Intervals response is
recognized well enough to produce a profile; QA is no longer the only evidence
that the path works. The individual rows above remain `Expected` because the
review did not record each stream's source values/units separately, and this
catalog deliberately does not infer semantics merely because a chart rendered.

`normalizeIntervalsRunProfile` in `src/connected/intervals.ts` remains
defensive: a shape it does not recognize resolves to `null` rather than a guess,
and Run Detail simply shows no Run Profile section — the same as a run with no
profile data. Because no stated summary number depends on the streams, a missing
or unrecognized stream can cost a chart but cannot manufacture a run fact.

### Streams give shape; aggregates give numbers

The rule the August 13 review established, applied to every Run Profile metric:

| Metric | Line comes from | Stated facts come from |
|---|---|---|
| Pace | `velocity_smooth` | `RunLog` distance ÷ duration — the run's own pace |
| Heart Rate | `heartrate` | `average_heartrate`, `max_heartrate` |
| Elevation | `altitude` | the series' own low and high |
| Cadence | `cadence` | `average_cadence` |

Two things this deliberately rules out. An arithmetic mean of instantaneous
pace samples is not the run's pace and disagrees with every other screen. And
the fastest and slowest single samples are a GPS artefact and a traffic light
— they were being shown as 6:07 and 53:32 against a real 10:59 run, which is
what prompted this rule.

Missing values keep their time position and break the line. Nothing is
interpolated across a gap, because a joined line would assert measurement
where the source had none.

One display-only exception, which changes no value: the pace chart scales its
visible y-axis to the bulk of the series (Tukey IQR fences) so a handful of
near-stops cannot flatten the rest into a flat line. Outlying samples are kept,
clamped to the edge of the visible window, and still counted everywhere else.

## Wellness fields

Check the Intervals wellness endpoint only after activity import works:

```text
GET /api/v1/athlete/0/wellness?oldest=YYYY-MM-DD&newest=YYYY-MM-DD
```

| STACK concept | Intervals candidate | Status | UI phase | Notes |
|---|---|---|---|---|
| HRV | `hrv` | Expected | UI-12 | Verify units and HealthFit coverage. |
| Resting HR | `restingHR` | Expected | UI-12 | bpm. |
| Sleep duration | `sleepSecs` | Expected | UI-12 | seconds. |
| Steps | current API field | Expected | UI-12 optional | Only use if HealthFit populates it. |
| Weight | `weight` | Expected | UI-12 optional | Intervals examples use kg. |
| SpO2 | `spO2` | Deferred | Not planned | Health context only if later justified. |
| Stress/mood/fatigue | current API fields | Deferred | Not planned | Do not substitute for STACK's own effort or create a readiness score. |
| CTL / ATL / form | wellness/activity fields | Deferred | Not planned | Intervals already presents these deeply; avoid copying its dashboard. |

### Wellness verification requirement

Before UI-12 begins, confirm in Intervals.icu itself that at least HRV and/or resting HR/sleep are actually arriving from HealthFit. If they are not there, do not build empty recovery UI; investigate HealthFit permissions/sync configuration first.

## Advanced Apple running dynamics

HealthFit's current export capabilities include detailed workout streams such as heart rate, running power and running dynamics (vertical oscillation, ground contact time, stride length). Intervals.icu can store activity streams/custom FIT-derived fields.

These are **not guaranteed to arrive as ordinary activity summary properties**.

| Metric | Status | Rule |
|---|---|---|
| Running power | Deferred | Inspect activity detail/custom stream availability before designing UI. |
| Stride length | Deferred | Same. |
| Ground contact time | Deferred | Same. |
| Vertical oscillation | Deferred | Same. |

If these are only accessible by downloading/parsing FIT data or through custom stream endpoints, create a separate phase. Do not add a FIT parser to UI-8.

## Data quality rules

When verifying a field, record:

1. exact JSON property name;
2. whether it is number/string/array/null;
3. source unit;
4. whether it is present on every tested run or only some;
5. whether the value matches what HealthFit/Apple Fitness shows closely enough to trust;
6. any source-specific caveat.

Example update:

```text
| Average HR | `average_heartrate` | Verified | UI-9 | Number, bpm; present on June 10 and matches HealthFit within rounding. |
```

Never include a user's precise GPS coordinates or complete raw workout payload in this file.

## UI coverage thresholds

A metric should be promoted into a trend only when data coverage supports it.

Suggested minimums:

- Single-run detail: one valid value is enough.
- HR-zone weekly summary: at least half of that week's running duration has HR-zone data; otherwise label the coverage or omit.
- Easy pace trend: at least 4 Easy runs.
- Easy HR trend: at least 4 Easy runs with valid average HR.
- Recovery baseline: at least 7 valid observations; prefer 28-day history before writing baseline language.

These thresholds are product guardrails, not physiology claims.

## Discovery completion checklist

UI-8 field discovery is complete when:

- [ ] June 10 activity is returned through `/api/intervals`.
- [ ] Exact running `type` is recorded.
- [ ] Distance unit is verified.
- [ ] Moving/elapsed time behavior is verified.
- [ ] Average/max HR presence is recorded.
- [x] Cadence presence and semantics are recorded. (August 13: `average_cadence` = 79, source convention repeated verbatim — see "Cadence convention".)
- [ ] Elevation gain presence/unit is recorded.
- [ ] Training-load presence is recorded.
- [ ] HR-zone field presence/shape is recorded.
- [ ] A structured interval workout is checked later for `icu_intervals`.
- [ ] Wellness coverage is checked before UI-12.

## UI-23 discovery: Run Profile streams

R3 established that a real owner Intervals activity can be fetched through the
direct local-key path and normalized into the production Run Profile. Complete
the remaining source-semantic checks before promoting the individual stream rows
above to `Verified`:

- [x] Direct local-key `GET /activity/{id}/streams.json?types=time,heartrate,altitude,velocity_smooth,cadence` is confirmed reachable on a real owner run.
- [ ] The deployed `/api/intervals` proxy stream path is separately confirmed on a real owner run if that legacy connection mode remains supported.
- [x] The returned payload is compatible with the current normalizer and produced a real Run Profile. Exact raw response shape is intentionally not stored here.
- [ ] `time` stream presence/units are explicitly recorded on a real HealthFit-originated run.
- [ ] `heartrate` stream presence is explicitly spot-checked against the run's known average HR.
- [ ] `altitude` stream presence/unit is explicitly recorded, and its low/high span is checked against source truth.
- [ ] `velocity_smooth` presence/unit is explicitly recorded and the derived pace is spot-checked against the run's known average pace.
- [ ] `cadence` stream presence is explicitly checked against the verified undoubled source convention.
- [ ] A run genuinely lacking streams (e.g. an older or manually uploaded activity) is confirmed to render with no Run Profile section rather than an error.
- [ ] A real run whose stream drops out mid-activity is confirmed to render a visible gap rather than a line drawn across it.
