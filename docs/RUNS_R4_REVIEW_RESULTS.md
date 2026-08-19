# Runs Reframe R4 — Integration Review Results

**Branch:** `feature/runs-integration-review`  
**PR:** #124  
**Base:** `feature/stack-next`  
**Status:** implementation/static review complete; awaiting owner iPhone visual review. Do not merge yet.

## Review question

> Does Runs now feel like one coherent STACK product from overview to history to single-run investigation?

R4 is a seam review over the owner-accepted R1, R2 and R3 work. It adds no new analytics or product layer.

## Path reviewed

The integrated code path was reviewed in this order:

1. Today → Runs handoff;
2. Runs Overview;
3. Training Signal detail;
4. History Explorer;
5. aggregate-only accepted Run Detail;
6. rich accepted Run Detail;
7. historical-only Run Detail;
8. Plan/Build adjacency and run editing/linking boundaries.

## Findings

### 1. Today → Runs already has the right boundary

`TodayScreen` keeps the daily decision surface small and delegates deeper running context to Runs. `ThisWeekStrip` can open Runs for the factual record and `TodaySignalNote` opens Runs rather than creating another Signal detail implementation. `AppShell` routes both handoffs to the existing `runs` destination.

No R4 code change is needed here.

### 2. Runs Overview and History already share the accepted R2 hierarchy

The integrated `RunsScreen` still preserves:

- snapshot first;
- compact Recent Training;
- up to three Signals before inline expansion;
- three Recent Runs before bounded expansion;
- a distinct History destination;
- History as a child screen, not a modal or bottom-nav destination;
- Overview scroll position remembered while History opens at its own top.

`HistoryExplorer` still uses metric + range as its only permanent controls, one primary readout, sparse chart labels, `Runs in period`, flat rows and no Planned / Extra / History-only filter row.

No R4 architecture change is needed here.

### 3. One real cross-phase visual seam remained in Run Profile

R3 reused the older Run Profile chart styling. Its elapsed-time axis was still **8px**, while the accepted R2 chart contract sets a **12px phone minimum** for axis/date labels and explicitly says to reduce density before shrinking text. Run Profile has only two or three elapsed-time labels, so there was no density justification for keeping the old microtype.

The profile selector also inherited the global `:focus-visible` outline around its full invisible 44px hit target. Because the selected metric already has a lime border on the smaller visible chip, keyboard focus could look like two nested lime boxes. This was the visually heavy state noticed during R3 review.

R4 fixes only those seams:

- Run Profile elapsed-time axis: **12px**;
- Run Profile fact labels: **10px** instead of 8px;
- the 44px selector target remains intact;
- keyboard focus is drawn around the visible chip rather than around the full invisible hit region;
- selected-state styling remains unchanged.

The change lives in `src/styles/runsIntegration.css` and is guarded by `src/features/runs/runsIntegrationStyling.test.ts`.

### 4. Run Detail ownership remains coherent

Accepted runs still use `RunDetailSheet` and retain STACK-owned facts/actions: effort, notes, plan relationship, edit, link/unlink and Build semantics.

Historical-only runs still use the same source-owned `SourceRunDetail` presentation without gaining effort, notes, plan status, edit controls, Build blocks, import actions or inferred workout type.

Aggregate-only runs remain a complete state: summary facts and zones when present, with no empty Run Profile frame. Rich runs progressively add Pace / Heart Rate / Elevation / Cadence when source access and recognized streams exist.

No R4 ownership/data change is needed.

### 5. Source semantics remain untouched

R4 changes no source/domain calculation. The existing rule remains:

> **Streams provide shape. Aggregates provide stated numbers.**

R4 does not alter:

- average pace truth;
- Avg/Max HR truth;
- elevation Gain source truth;
- cadence convention;
- missing-is-missing behavior;
- historical identity/dedupe;
- Training Signal formulas or availability;
- plan matching/linking;
- Build earning/placement;
- persistence or schema.

### 6. Plan and Build remain adjacent, not duplicated

Runs still owns actual-history understanding and single-run investigation. Plan remains future intent; Build remains the reward layer. Run Detail continues to use the existing edit/link/unlink callbacks rather than introducing a new Plan or Build workflow.

No Plan or Build redesign belongs in R4.

## Deliberately unchanged

R4 does not add or reopen:

- Best Efforts / PRs;
- pace or HR trends across runs;
- new Training Signals;
- workout-type inference for historical runs;
- maps/routes/GPS;
- readiness/recovery/wellness;
- historical Build backfill;
- Crew work;
- Plan role redesign / NEXT-5;
- new persistence/schema;
- durable stream storage.

## Verification

### Automated/build evidence

The Vercel preview for the current R4 head builds successfully.

The assistant GitHub environment does not provide a repository checkout capable of running `npm install`, `npm run check` or `git diff --check` directly. Those commands must still be run on final head before R4 is accepted/merged; this document does not substitute a green Vercel build for the full test/lint suite.

### Owner-device review still required

Before acceptance, review the PR #124 preview on a real iPhone at minimum for:

- Runs Overview default state;
- Signals expanded/collapsed and one Signal detail;
- Recent Runs expanded/collapsed;
- History 4W Miles, a longer range and Zones;
- History Back → Overview scroll restoration;
- aggregate-only Run Detail;
- rich Run Detail with Pace / HR / Elevation / Cadence;
- the updated Run Profile time labels and selected/focus treatment;
- historical-only Run Detail;
- one real Intervals-backed run with Intervals connected on the same preview hostname.

Intervals credentials are browser/domain-local. A new R4 preview hostname must be connected before a real Run Profile can be used as a source-path review.

## R4 acceptance gate

If the owner-device pass finds no new integration seam, R4 is ready for final-head checks and owner acceptance. After acceptance, merge #124 into `feature/stack-next`, record R4 in `STACK_NEXT_ACCEPTANCE_LOG.md`, and begin **NEXT-5 — Plan role revision** on a fresh branch.
