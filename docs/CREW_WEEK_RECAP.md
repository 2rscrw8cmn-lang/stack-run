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
| `performances` | at least one standout effort survives its tie rule | see below |
| `build` | at least one of this week's runs is standing in the Crew Build | membership is the run's **local date**, not its placement time, so both members compute the same slice |
| `specialBlocks` | an award for that week is **placed** in the tower | see below |
| `change` | the previous week is inside the Build window and has running in it | signed mile delta; zero is a real answer |

A week with no shared running returns `null`. A recap of zero miles is not a minimal story — it is a dashboard reporting an empty cell.

### Best performances, and the line they cannot cross

`performances` carries the week's standout efforts in editorial order. Each is a different question, and each survives only if one run answers it outright — a tie has no answer that is not a choice between two runners, so a tie omits the item.

| Kind | The question | Qualifier |
| --- | --- | --- |
| `longestRun` | the furthest single run | distance above zero |
| `bestPace` | the fastest average pace | a non-Cross run of at least 2 miles — **the same qualifier `finalize_crew_awards` uses for Fastest Avg. Pace** |
| `biggestCrewDay` | the day the Crew covered the most ground | one day, strictly biggest |
| `mostActiveDay` | the day the Crew ran most often | one day, strictly busiest, with more than one run on it, **and a different day from `biggestCrewDay`** — when they are the same day, the biggest day's own line already carries its run count |

The last two are crew-level on purpose: four individual bests in a row starts to read as a leaderboard, and two beats about the whole crew's days keep the page a story about the group.

**What this page cannot claim.** A "fastest mile" or a "best 5K" needs within-run data — splits, laps, a distance-over-time stream — that the Crew projection deliberately does not carry. That is the same limit which leaves D-080's `Steady` award unminted rather than fabricated from an average, and it applies here for the same reason: a 3.4-mile run's average pace is not a 5K time, and presenting it as one would be inventing a fact. If STACK ever projects verified splits to Crew, those two become derivable; until then they are absent rather than estimated.

### Special Blocks

D-080 stands unchanged: `finalize_crew_awards` is the single authority on who won a week, the client carries no mirror of the ranking, and **a Special Block enters the tower by being placed, not by being announced**.

So the recap reports only awards for that week that are already **standing in the Crew Build**, where every member can already open and read them. An unplaced award stays the winner's own placement prompt and appears in no recap — which is also what keeps two members of the same Crew seeing the same list.

## Presentation language

This is the part Evolution 2.05 reuses.

**The sheet is the canvas.** There is no inner stage card, no card inside a card, and no frame that is a bordered rectangle containing a number. Hierarchy comes from type, space and actual Crew objects. Bordered containers are reserved for the two places that earn one: the Today module, and a single hairline separating the controls.

**Six pages, one system — not one composition six times.** Each page gets the shape its own facts deserve, and no two are built the same way:

| Page | Composition |
| --- | --- |
| Together | Split: emblem, week, mileage hero, a three-reading scoreboard and the participation row at the top; the week's real blocks standing on the floor, with the sheet's own sky between them |
| Best Performances | One hero effort on an accent edge, then the rest as a rhythm of rows, each naming its runner |
| Added to the Build | One centred group, tower drawn a size up, because here the tower is the subject rather than the payoff under a number |
| Awards | The award objects carry it: hollow blocks at display size, name, result, winner. The count decides the arrangement — one is a centred hero, two a pair, three or four a 2×2, more tightens — rather than `auto-fit` deciding it from whatever width is going |
| Against Last Week | The delta, then two columns of plain CSS against a chart-rule field, at a size that makes them the object of the page |
| Week Complete | The one page that centres itself, because a finish is not a reading: emblem, title, the week's own figures, and the tower it built |

**Participation is folded into the opening, never its own page.** A page whose only fact is "everyone ran" is a weak page, and it does not survive contact with a real roster. The row shows up to seven marks and then counts the rest (`+4`), so an eleven-person Crew reads as easily as a four-person one and neither needs a layout of its own.

**One fact per frame.** An eyebrow naming the beat, one figure at display size, and the smallest amount of supporting text that makes the figure mean something.

**Advanced by hand.** Nothing auto-plays. An auto-advancing story is a Reduced Motion problem, a screen-reader problem and a reading-speed problem at once, and the arcade language STACK speaks is a machine you operate rather than a video you watch. Position is a quiet rail of small blocks — the shape the product is made of — with `Frame n of m` in the live region for a screen reader, and quiet `Back` / `Next` steps either side of the primary action.

**Each page has its own backdrop, and it is the whole panel.** The current page puts a modifier class on the sheet itself (`sheet--crew-recap--build`), and the backdrop is drawn by `.sheet__panel::after` — so a page's mood runs behind the title, the progress rail, the content and the actions at once. It is one designed object, not content laid over a decorative patch in the middle of the body.

Two rules keep it from looking pasted on. **The canvas never visibly begins or ends** — intensity is controlled inside the gradients, never by masking the layer, because a mask that fades in at 26% draws a horizontal seam across the sheet. And **`::after`, not `::before`** — on a phone `.sheet__panel::before` is already the sheet's grab handle.

Every treatment is a CSS gradient stack, held at low alpha so the data stays the loudest thing on screen:

| Page | Treatment |
| --- | --- |
| Together | technical grid under a soft lime rise |
| Best Performances | angled speed streaks and a raking light |
| Added to the Build | blueprint field with a lit floor for the tower to stand on |
| Awards | two soft cones from above and a lit floor — neutral light, because every award already owns a colour and a warm wash would be a second colour system arguing with it |
| Against Last Week | chart rules to read the columns against, and a rise under the bars |
| Week Complete | a centred glow with a scatter of sparks, each spark a 2px radial stop rather than an element or an image |

Nothing here is an asset. No PNG, no SVG illustration, no exported artwork — the whole set ships as gradients.

**Each page owns its vertical composition.** The stage stretches and gets out of the way; it does not centre pages and let some opt out, which is how a tower ends up floating in the middle of a sheet instead of standing on something. Every page states three zones for itself:

| Page | Top | Middle | Bottom |
| --- | --- | --- | --- |
| Together | total and the scoreboard | participation | the week's tower, on the floor |
| Best Performances | hero effort | the rest | breathing space |
| Added to the Build | the block count | air | the tower, just above the footer rule |
| Awards | the heading | the awards, centred | breathing space |
| Against Last Week | the delta | the columns, at a size worth looking at | their two figures |
| Week Complete | emblem, title and the week's figures | — | the tower |

**Say nothing the page already shows.** Three sentences an earlier pass used to explain its own visuals are gone, and `CrewWeekRecapSheet.test.tsx` keeps them gone: the Awards page no longer says the blocks are standing in the Crew Build, the comparison no longer reads its own delta back as a percentage, and the finish no longer congratulates anyone — it closes on the week's own figures instead. A recap of facts does not need a narrator.

**Every visual is drawn by the app.** No artwork, no illustration, no generated image, no second tower renderer. The blocks are the real `Brick` / `AwardBrick` construction under the real member colours; the identity marks are the real `CrewEmblem` and `RunnerIcon`.

**Identity is the Crew's.** Runners appear as their own Runner Icon with their member accent carried on a hairline under the mark, and their name in the reading voice. Colour identifies — whose run, which award — and never judges. No frame ranks the roster; the beats name a runner only where the Crew already names one.

**Two voices, as everywhere else.** Mono for facts — mileage, counts, time, deltas, dates as metadata, machine labels. Sans for the sheet title, the Crew name, member names, sentences and actions. Nothing below the phone type floor.

### Reused components

The recap introduces no geometry of its own. Two extractions carry the Build language into it:

- `src/features/build/BuildCrop.tsx` — a **read-only piece of tower**. Personal and Crew Build each own an *interactive* tower (placement, drag, selection, landing slots, skyline, ground). A surface that only needs to show built blocks needs none of that, and copying the geometry into a local stylesheet is how a second, drifting renderer gets built by accident. `BuildCrop` is the presentation half alone: the same `built-tower` grid, the same `placed-block` positioning, the same `Brick` / `AwardBrick` faces, the same voids, at a `hero` or `teaser` scale.
- `src/features/crew/crewBrickFace.ts` — `crewFaceLabel` and `memberPieceColor`, lifted out of `CrewBuild` so the shared tower and any crop of it cannot disagree about a block. Both are load-bearing product rules rather than styling: the asterisk is issue #129's hand-logged marker, and the colour is the only channel that says whose block this is.

`faceCulledRecapSlice` in `weekRecap.ts` adds the neighbour-aware face culling, as `faceCulledMiniBuildTower` does for Member Build — kept separate from `crewWeekRecap` so the beat's tested shape never grows fields only a renderer needs.

**The slice is real.** The Crew Build frames draw this week's blocks in their true tower columns, widths, heights and member colours, rebased on the lowest course the week reached, with the cells other weeks occupy drawn as recesses. It is `aria-hidden` behind a single accessible label, because the same facts are stated in text above it and a masonry crop has no reading order worth announcing.

## Today integration

`src/features/today/TodayCrewRecap.tsx`.

- The module renders **below Today's action surface**. The workout, the run just logged and the blocks it still owes stay first and stay louder; last week's story is a payoff on the way down.
- It is limited-time by construction: the recap window above, a real recap, and no dismissal.
- It is a **teaser, not a second dashboard card**: one header line, one sentence, one compact machine line, and a bottom row pairing the way in with a small crop of the week's real blocks. The crop is the first thing to give way — it is hidden below 360px so the copy never loses a line.
- It states the week's headline facts itself. A module that says only "your recap is ready" is a notification wearing a card's clothes.
- `View recap →` opens the fuller page-by-page recap, replayable for as long as the module is on Today.
- Dismissal is device-local, per account and per Crew week (`src/storage/dismissedCrewRecapRepository.ts`). Dismissing is a statement about this screen, not about the week: the Crew's shared facts are untouched and no crewmate learns of it.
- The award read that feeds the `specialBlocks` beat happens only after the week, the Crew and the dismissal have all said yes, so Today never spends a round trip on a recap it will not show. It is failure-tolerant: an unavailable award read costs the recap that one beat, never the recap.

## Motion

Small, factual, and always optional:

- a frame's content fades and rises 8px on arrival;
- the blocks of a crop settle in, lowest course first, on the recap frames;
- the progress rail's current segment widens into place.

No confetti, no bouncing, no falling physics, no rotation, no ambient animation, no autoplay. Every rule above is dropped under `prefers-reduced-motion: reduce`.

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

## Naming

The recap page is titled **Awards**. The underlying object keeps its product name — a **Special Block** is still what D-080 defines, still what the Crew screen offers a winner, and still what the tower holds. "Awards" is the page's title only, because that is what the page is about: what the Crew won this week, rather than the block mechanic behind it.

## Sharing

Deliberately not implemented. Evolution 2.04 states sharing is optional and only worth doing if it can be privacy-safe and visually strong; nothing here has been widened in anticipation of it.

## Verification

- `src/crew/weekRecap.test.ts` — the window, every beat's evidence rule, determinism across read order, the sparse-week minimum, and the field drop.
- `src/features/today/TodayCrewRecap.test.tsx` — the Today window, dismissal persistence, and the cases that render nothing.
- `src/features/crew/CrewWeekRecapSheet.test.tsx` — the six-page order, the page class the backdrop hangs off, the copy that must stay deleted, the large-roster overflow row, and the pages a sparse week drops.
- `src/storage/dismissedCrewRecapRepository.test.ts` — per-account, per-week dismissal and corrupt-value tolerance.
- `src/features/today/crewRecapDemo.test.ts` — the review overlay's host rule, its window, and both fixtures.

Reviewed in a real browser at 320px, ~390px, 430px and desktop via the owner-review overlay. Real iPhone Safari review remains owner verification.
