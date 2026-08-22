# Crew Week Recap

**Status:** current specialist contract for the weekly Crew recap and, per Evolution 2.04, for the **recap presentation language** any later STACK retrospective reuses.

Extends `docs/DESIGN_SYSTEM.md`. It does not create a second visual system, and it does not change Crew's data boundary, Special Block rules, or Today's action hierarchy.

## What it is

After a Monday–Sunday Crew week closes, STACK tells the Crew what it built that week: a short, celebratory, deterministic story assembled entirely from facts the Crew already shares.

It is deliberately **not**:

- a weekly standings table or leaderboard;
- a second Crew dashboard;
- a public feed, a comment thread, or a share-to-social product;
- a score, an XP total, or a grade;
- a change to who wins a Special Block or how one is placed.

> A recap is a story about the group. A dashboard is a lookup surface. STACK already has the second one.

## The week

One definition, shared with the rest of the product: **Monday through Sunday**, via `mondayOfLocalDate`.

- `lastClosedCrewWeek(today)` — the most recently completed week. A week is never recapped while it is still being run.
- `isCrewRecapCurrent(week, today)` — whether that week is still Today's business. The window opens the day after the week ends and closes `CREW_RECAP_TODAY_DAYS` (3) days later: Monday through Wednesday, then it is gone.
- A week that ended before the Crew's own `buildStartDate` has no recap at all.

## Derivation

`src/crew/weekRecap.ts` is the whole factual half of the feature. Both surfaces render the same `CrewWeekRecap`, so Today's module and the fuller recap cannot disagree about a week.

Three rules govern it.

**Derived, never stored.** No row, no cached score, no ranking. The recap is recomputed from shared Crew data the viewer already has, which is what makes it deterministic: the same closed week produces the same recap on every device, at every hour, in any read order.

**A missing fact omits its beat.** Absence never becomes zero or a hedge. A week with one run produces a short, true recap; it does not produce a padded one.

**It says nothing the Crew has not already said.** Run facts come through `CrewWeekRecapRun`, narrower again than `CrewSharedRun`: no heart rate (D-079), no Props, no `localRunId`, no personal Build coordinates, and — as everywhere in Crew — no notes, routes, exact start times, zones, effort or plan detail. `crewWeekRecapRunsFrom` performs that drop in one reviewable place.

### The beats

`totals` always exists when a recap exists: crew miles, runs, moving time, and how many members ran.

The story after it, in editorial order, with what each beat requires:

| Beat | Exists when | Notes |
| --- | --- | --- |
| `participation` | at least one roster member ran | `everyoneRan` is claimed only when every current member ran, and never for a Crew of one |
| `longestRun` | one run is strictly longest | a tie omits the beat rather than choosing between two runners |
| `build` | at least one of this week's runs is standing in the Crew Build | membership is the run's **local date**, not its placement time, so both members compute the same slice |
| `specialBlocks` | an award for that week is **placed** in the tower | see below |
| `change` | the previous week is inside the Build window and has running in it | signed mile delta; zero is a real answer |

A week with no shared running returns `null`. A recap of zero miles is not a minimal story — it is a dashboard reporting an empty cell.

### Special Blocks

D-080 stands unchanged: `finalize_crew_awards` is the single authority on who won a week, the client carries no mirror of the ranking, and **a Special Block enters the tower by being placed, not by being announced**.

So the recap reports only awards for that week that are already **standing in the Crew Build**, where every member can already open and read them. An unplaced award stays the winner's own placement prompt and appears in no recap — which is also what keeps two members of the same Crew seeing the same list.

## Presentation language

This is the part Evolution 2.05 reuses.

**One fact per frame.** An eyebrow that names the beat, one figure at display size, and the smallest amount of supporting text that makes the figure mean something. A frame is never a row of KPI cards.

**Advanced by hand.** Nothing auto-plays. An auto-advancing story is a Reduced Motion problem, a screen-reader problem and a reading-speed problem at once, and the arcade language STACK speaks is a machine you operate rather than a video you watch. Back / Next / Done, a `1 / n` position, and one `aria-live` stage so a screen reader hears the beat that was moved to.

**Identity is the Crew's.** The Crew emblem and name head the recap; runners appear as their own Runner Icon and member accent. Colour identifies — whose run, which award — and never judges.

**Celebrate the group, not the ranking.** The beats name a runner only where the Crew already names one: the week's longest run, and a Special Block that is already standing. There is no ordering of the roster anywhere in the recap.

**The slice is real.** The Crew Build frame draws this week's blocks in their true tower columns and courses, rebased on the lowest course the week reached, in each runner's own accent. It is decorative (`aria-hidden`) because the same facts are stated in text above it.

## Today integration

`src/features/today/TodayCrewRecap.tsx`.

- The module renders **below Today's action surface**. The workout, the run just logged and the blocks it still owes stay first; last week's story is a payoff on the way down.
- It is limited-time by construction: the recap window above, a real recap, and no dismissal.
- It states the week's headline facts itself. A module that says only "your recap is ready" is a notification wearing a card's clothes.
- `Open the recap` opens the fuller frame-by-frame recap, replayable for as long as the module is on Today.
- Dismissal is device-local, per account and per Crew week (`src/storage/dismissedCrewRecapRepository.ts`). Dismissing is a statement about this screen, not about the week: the Crew's shared facts are untouched and no crewmate learns of it.
- The award read that feeds the `specialBlocks` beat happens only after the week, the Crew and the dismissal have all said yes, so Today never spends a round trip on a recap it will not show. It is failure-tolerant: an unavailable award read costs the recap that one beat, never the recap.

## Relationship to Special Block weeks

The recap and `finalize_crew_awards` use the **same week**, and that is deliberate rather than coincidental:

| | Recap (`weekRecap.ts`) | Finalizer (`finalize_crew_awards`) |
| --- | --- | --- |
| Week shape | ISO Monday → Sunday | ISO Monday → Sunday (`v_week` … `v_week + 6`) |
| Matched on | the run's own `localDate` | the run's own `local_date` |
| Most recent week handled | `lastClosedCrewWeek(today)` | `current_date`'s Monday minus 7 |
| Floor | the Crew's `buildStartDate` | `greatest(build_start_date's Monday, first Monday on/after awards_start_date)` |

Two differences are real and intended:

- **Whose clock.** The recap reads the *device's* local date; the finalizer reads the *database's* `current_date`. Near midnight on a Sunday these can disagree by a day. It degrades safely: the recap simply shows no `specialBlocks` beat until the awards exist, and an award has to be *placed* before the recap reports it anyway.
- **The awards floor.** `awards_start_date` (D-080) floors award minting but not the recap. A Crew that predates the Special Blocks rollout gets recaps for weeks that have no awards — correctly, since those beats are omitted rather than invented.

**Recap totals are not award qualifying totals, and must not be read as such.** The recap's `miles` / `runs` / time are *everything the Crew shared that week*. The awards deliberately qualify more narrowly — Most Miles and Most Runs both exclude `cross`, Most Runs needs ≥1 mi or ≥10 min, Fastest Avg. Pace needs ≥2 mi, Best Zone 2 needs a ≥30 min run with a synced Zone 2 scalar. A Crew whose week included Cross Training will therefore see recap miles above the Most Miles result, and that is both correct readings of two different questions.

The recap also differs from the Crew screen's four figures above the tower (`crewTotals.ts`), which count only runs **placed** in the Build. The recap counts the week's running whether or not it has been built yet, and says so in its own Build beat.

## Owner review

The recap is on Today for three days a week, for a Crew that ran. That is right for the product and awkward to review, so `src/features/today/crewRecapDemo.ts` provides the same kind of in-memory overlay `?demo=today` already gives Today:

- `?demo=recap` — a four-runner week with every beat present, including a won-but-unplaced Special Block that must **not** appear;
- `?demo=recap-minimal` — one run, one runner, nothing placed, no previous week.

Both are preview-host-only (localhost or a Vercel `-git-` branch preview), carry their own fake crew, roster, week and awards, never touch a real Crew or account, and never write to `localStorage`. The recap they show is produced by the real `crewWeekRecap` derivation — only the facts going in are invented — and the module renders the same card the live path does. The card carries a `RECAP DEMO · FAKE CREW DATA` banner.

## Sharing

Deliberately not implemented. Evolution 2.04 states sharing is optional and only worth doing if it can be privacy-safe and visually strong; nothing here has been widened in anticipation of it.

## Verification

- `src/crew/weekRecap.test.ts` — the window, every beat's evidence rule, determinism across read order, the sparse-week minimum, and the field drop.
- `src/features/today/TodayCrewRecap.test.tsx` — the Today window, dismissal persistence, and the cases that render nothing.
- `src/features/crew/CrewWeekRecapSheet.test.tsx` — the frame sequence and the one-frame sparse recap.
- `src/storage/dismissedCrewRecapRepository.test.ts` — per-account, per-week dismissal and corrupt-value tolerance.
- `src/features/today/crewRecapDemo.test.ts` — the review overlay's host rule, its window, and both fixtures.
