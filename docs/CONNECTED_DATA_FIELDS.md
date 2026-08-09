# Connected Data Field Catalog

**Status:** discovery checklist.  
**Purpose:** verify what HealthFit actually delivers through Intervals.icu before STACK builds UI around it.

Do not mark a field `Verified` because Intervals.icu documents it in general. It is verified only when the user's real HealthFit-originated data contains it in the API response.

## Real fixture

The first real fixture is the Apple Watch run that HealthFit successfully synced to Intervals.icu on **June 10, 2026**.

UI-8 must fetch that activity through the deployed STACK proxy and update this file with the actual result.

Do not paste the full raw API response into this repository: it can contain personal health/location metadata. Record field names, presence, units/semantics, and a harmless example shape only.

## Status values

- `Expected` — documented/candidate, not yet verified on the user's pipeline.
- `Verified` — seen on the June 10 or later HealthFit-originated activity.
- `Missing` — checked and absent from the tested pipeline.
- `Deferred` — available somewhere in the ecosystem but not needed for the current phase.

## Minimum activity fields

| STACK concept | Intervals candidate | Status | Notes |
|---|---|---|---|
| External activity id | `id` | Expected | Opaque dedupe key. |
| Local start date/time | `start_date_local` | Expected | Use local date for matching. |
| UTC start | `start_date` | Expected | Preserve only if useful for diagnostics. |
| Source activity type | `type` | Expected | Record exact Apple Watch/HealthFit running value before building allowlist. |
| Name | `name` | Expected | Display optional. |
| Distance | `distance` | Expected | Expected meters; verify. |
| Moving time | `moving_time` | Expected | Preferred STACK duration when positive. |
| Elapsed time | `elapsed_time` | Expected | Fallback duration / detail. |
| Source updated time | `updated` or equivalent | Expected | Do not depend on until verified. |

UI-8 may not ship import until the first six concepts above are understood well enough to create a valid run safely.

## Run summary metrics

| STACK metric | Intervals candidate | Status | UI phase | Notes |
|---|---|---|---|---|
| Average HR | `average_heartrate` | Expected | UI-9 | bpm. |
| Max HR | `max_heartrate` | Expected | UI-9 | bpm. |
| Average cadence | `average_cadence` | Expected | UI-9 | **Verify running cadence semantics/units before displaying. UI-9 deliberately omits it while this remains Expected.** |
| Elevation gain | `total_elevation_gain` | Expected | UI-9 | Expected meters; convert to feet for current UI. |
| Training load | `icu_training_load` | Expected | UI-9 | Intervals-derived; label plainly as Training Load. |
| HR zone times | `icu_hr_zone_times` or current API equivalent | Expected | UI-9 | Verify array order/count against athlete zones. |
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
| `icu_intervals` exists on HealthFit run | Expected | UI-9 | Verify on a structured Apple Watch workout, not necessarily June 10 if it was an easy run. |
| Work/rest intervals are useful | Expected | UI-9 | UI-9's mock fixture verifies named/timed-row handling; real HealthFit grouping is still required. Only explicitly named, positively timed groups are shown. |
| Apple workout laps survive sync | Expected | UI-9 | Verify with an interval session. |

Do not fetch detail for every activity during normal list sync.

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
- [ ] Cadence presence and semantics are recorded.
- [ ] Elevation gain presence/unit is recorded.
- [ ] Training-load presence is recorded.
- [ ] HR-zone field presence/shape is recorded.
- [ ] A structured interval workout is checked later for `icu_intervals`.
- [ ] Wellness coverage is checked before UI-12.
