# UI Implementation Plan

## Status

UI-0 through UI-11 are implemented/accepted.

This file is now a compact historical index. The active implementation specification for the next product revision lives in:

```text
docs/RUNS_AND_BUILD_IMPLEMENTATION.md
```

Do not start an older UI-12 Wellness prompt from Git history or an outdated branch.

## Implemented phases

| Phase | Name | Status |
|---:|---|---|
| 0 | Repository foundation | Complete |
| 1 | App shell/design system | Complete |
| 2 | Today | Complete |
| 3 | Manual run entry | Complete |
| 4 | Build foundation | Complete |
| 5 | Plan review | Complete |
| 5.5 | Core Loop Revision | Complete |
| 6 | Plan adjustment | Complete |
| 7 | Polish/release | Complete |
| 8 | Connected Data Foundation | Complete |
| 9 | Connected Run Detail | Complete |
| 10 | Connected Today + Week | Complete |
| 11 | Training Trends | Complete |

## UI-12 — Wellness / Recovery Context

**Status: Deferred / intentionally skipped.**

D-046 removes wellness from the active product roadmap. Do not implement HRV/sleep/resting-HR/readiness UI unless a later owner decision reactivates it.

D-038 remains the safety contract if revisited.

## UI-13 — Runs Pillar + Navigation Revision

**Status: Next approved phase.**

Full specification and agent prompt:

```text
docs/RUNS_AND_BUILD_REVISION.md
docs/RUNS_AND_BUILD_IMPLEMENTATION.md
```

Outcome:

- bottom nav becomes Today / Build / Runs / Plan;
- Settings moves to an icon-only top-right gear;
- Runs becomes chronological actual history;
- existing rich run detail/edit/delete is reused;
- Training Trends gets a canonical home from Runs;
- no new run-history persistence or schema migration expected.

## UI-14 — Build Reward Revision

**Status: Approved after UI-13.**

Full specification and agent prompt:

```text
docs/RUNS_AND_BUILD_REVISION.md
docs/RUNS_AND_BUILD_IMPLEMENTATION.md
```

Outcome:

- Build leads with miles built + tower;
- remove Runs Complete and Run Streak from Build heading;
- mileage appears on sufficiently wide blocks;
- pointer/touch release may commit after a deliberate snapped drag;
- tap/keyboard remain complete placement paths;
- restrained placement payoff;
- earned Race capstone treatment;
- existing 8-column geometry/schema preserved.

## UI-15 — Optional Plan Export Investigation

**Status: Deferred. No code authorization.**

D-040 remains in force. Any STACK → Intervals.icu write integration requires a separate product/security decision first.

## Implementation rule

For UI-13 and UI-14, do not use the older connected-phase prompts. Use the copy/paste prompts embedded in `docs/RUNS_AND_BUILD_IMPLEMENTATION.md`.
