# Crew Week Recap

**Status:** current specialist contract for the weekly Crew recap and, per Evolution 2.04, for the **recap presentation language** any later STACK retrospective reuses. Revised by Evolution 2.1 (issue #186): a Crew-page notification, a richer Best Performances page including a source-verified Fastest 5K, and a new-week handoff in place of the old finish.

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
- `isCrewRecapCurrent(week, today)` — whether that week is still current. The window opens the day after the week ends and closes `CREW_RECAP_TODAY_DAYS` (3) days later: Monday through Wednesday, then it is gone. **One window, both surfaces** — Today's teaser and Crew's notification cannot disagree about whether last week is still current.
- `nextCrewWeekAfter(week)` — the week that started when the recapped one ended. The last page hands over to it.
- A week that ended before the Crew's own `buildStartDate` has no recap at all.

## Derivation

`src/crew/weekRecap.ts` is the whole factual half of the feature. Both surfaces render the same `CrewWeekRecap`, so Today's module and the fuller recap cannot disagree about a week.

Three rules govern it.

**Derived, never stored.** No row, no cached score, no ranking. The recap is recomputed from shared Crew data the viewer already has, which is what makes it deterministic: the same closed week produces the same recap on every device, at every hour, in any read order.

**A missing fact omits its beat.** Absence never becomes zero or a hedge. A week with one run produces a short, true recap; it does not produce a padded one.

**It says nothing the Crew has not already said.** Run facts come through `CrewWeekRecapRun`, narrower again than `CrewSharedRun`: no heart rate (D-079), no Props, no `localRunId`, no personal Build coordinates, and — as everywhere in Crew — no notes, routes, exact start times, zones, effort or plan detail. `crewWeekRecapRunsFrom` performs that drop in one reviewable place.

Issue #186 widened that contract by exactly one number, `best5kSeconds` — see "Fastest 5K" below. It is a scalar the source itself computed, not a new telemetry surface, and it is named explicitly in `crewWeekRecapRunsFrom` like every other field there.

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

`performances` carries the week's standout efforts in **editorial order**, capped at `CREW_RECAP_PERFORMANCE_LIMIT` (4). Each is a different question, and each survives only if one run answers it outright — a tie has no answer that is not a choice between two runners, so a tie omits the item.

The order is the point, and Evolution 2.1 changed it. The previous order led with Longest Run and carried two day beats, which meant three of the four items were readings of the distance-and-count aggregates page 1 had already shown at display size. The page's job is the facts a glance at the totals *cannot* give, so those go first:

| # | Kind | The question | Qualifier |
| --- | --- | --- | --- |
| 1 | `best5k` | the fastest verified 5,000 m effort | a run carrying a finite positive `best5kSeconds` — see below |
| 2 | `bestPace` | the fastest average pace | a non-Cross run of at least 2 miles — **the same qualifier `finalize_crew_awards` uses for Fastest Avg. Pace** |
| 3 | `longestRun` | the furthest single run | distance above zero |
| 4 | `biggestCrewDay` | the day the Crew covered the most ground | one day, strictly biggest |
| 5 | `mostActiveDay` | the day the Crew ran most often | one day, strictly busiest, with more than one run on it, **and a different day from `biggestCrewDay`** — when they are the same day, the biggest day's own line already carries its run count |

The limit is a ceiling, not a quota. A candidate with no evidence is skipped and the next one fills in behind it, so a week with no verified 5K reads exactly as it did before Evolution 2.1 (pace, distance, and both day facts), and a sparse week produces a short true page rather than a padded one. `mostActiveDay` is therefore the **fallback** crew-level fact rather than a second day beat: it appears only when an earlier candidate left a slot free.

The last two are crew-level on purpose: a column of individual bests starts to read as a leaderboard, and a beat about the whole crew's day keeps the page a story about the group.

**What this page still cannot claim.** A "fastest mile" needs within-run data — splits, laps, a distance-over-time stream — that the Crew projection deliberately does not carry, and STACK does not reconstruct one from a whole-run average. That is the same limit which leaves D-080's `Steady` award unminted rather than fabricated, and it holds: a 3.4-mile run's average pace is not a mile time, and presenting it as one would be inventing a fact.

### Fastest 5K

Issue #186's one data change, and the exception that proves the rule above rather than breaking it.

**What it means.** The time of a real, continuous 5,000 m effort inside a shared run, as the contributing runner's own connected source reported it. It is never:

- the average pace of a run that happened to be near 5K;
- `duration / distance * 5K`;
- a value reconstructed from one instantaneous pace sample;
- an interpolation between two points on a pace curve.

**Why it is allowed when a fastest mile is not.** STACK does not compute this. Intervals already runs a pace curve over its own activities and reports best-effort times; STACK asks it for the 5,000 m answer, stores that one number against the run, and projects that one number. Nothing within-run reaches Crew — no curve, no stream, no route, no source payload. So the page still says nothing derived from data the recap does not have; the derivation happened at the source, where the data lives.

**Where the truth rule comes from.** Intervals' best-effort calculation requires an actual 5,000 m window inside the activity and does not manufacture one from a 4.99 km run. STACK adopts the same rule, and mirrors it on the device: the enrichment pass will not even spend a request on a run below `BEST_5K_MIN_MILES` (5,000 m rounded up against STACK's two-decimal mileage), and `normalizeIntervalsBestEfforts` matches the 5,000 m point exactly.

**Selection.** Smallest value wins. The existing tie rule holds — an exact tie omits the beat rather than picking between two runners. The item carries the runner's identity and the run's date, and the presentation states the elapsed 5K time with the equivalent `/MI` beneath it. That pace is the *same verified result in another unit*, which is the one arithmetic this metric permits; the forbidden direction (a run's average pace scaled into a 5K) invents a measurement and nothing does it.

**Where the value lives.**

| Layer | Field | Notes |
| --- | --- | --- |
| Personal run | `RunLog.importedMetrics.best5kSeconds` | Source-derived. Absent on a manual run, a run under 5 km, and a synced run whose source has not been asked. |
| Crew column | `shared_runs.best_5k_seconds` | Nullable `integer`, CHECK 600–21600, mirrored on the device by `crewSafeBest5kSeconds`. See `docs/CREW_PROJECTION_CONTRACT.md`. |
| Crew read | `CrewSharedRun.best5kSeconds` | A missing column, an older row and an out-of-bounds value all read as "no 5K" rather than failing the crew read. |
| Recap | `CrewWeekRecapRun.best5kSeconds` | Carried explicitly by `crewWeekRecapRunsFrom`, for this beat only. |

**How existing runs get one.** `src/connected/best5k.ts` plans a bounded pass and `useBest5kEnrichment` runs it: newest run first, only runs that could have a 5K, at most `BEST_5K_PASS_LIMIT` (6) activities per pass, within `BEST_5K_LOOKBACK_DAYS` (120), and **one pass per foreground event** — app open or return to the front, exactly like `useConnectedSync`. Every activity actually asked about is recorded in `src/storage/best5kProbeRepository.ts` — including the ones with no 5K, which is the common answer and the one worth remembering — so a settled question is never asked twice. A **failed** request settles nothing: a rate limit says nothing about the run. Nothing has to be deleted or re-imported, and a device that never runs the pass simply has runs with no 5K.

**Why a pass never chains into the next one.** The first version re-armed on how many runs were still unasked, so a pass that found six 5Ks started another immediately. Each of those state writes changes `projectionFingerprint`, and every fingerprint change re-uploads the runner's whole history to **every** crew and invalidates the Crew dashboard — so a runner with a season of history got a burst of full-history projection uploads and Crew reads, and the Crew screen visibly flashed between `Loading crew data…` and its data. The bound that matters is therefore per *foreground event*, not per pass. History still fills in, just across visits, which is the pace this feature was always allowed.

**The notification spends no request of its own.** `CrewRecapNotification` takes the Crew screen's existing award read as a prop. It must never open a `useCrewAwards` of its own: `loadCrewAwards` begins with the `finalize_crew_awards` **write** RPC, so a second hook meant two concurrent finalizations of the same crew on every Crew visit inside the recap window.

**A new Crew column must not be able to cost the Crew its runs.** `loadCrewDashboard` asks for `best_5k_seconds` and, if that select is refused, asks again without it — see `OPTIONAL_SHARED_RUN_COLUMNS` in `src/crew/dashboard.ts`. Code and schema roll out separately (a Vercel deploy is not a migration), and a failed shared-run read costs the tower, Recent Crew Runs and Props, not one footnote. Add a nullable column to `OPTIONAL_SHARED_RUN_COLUMNS` rather than to the base list.

**Source-verification status.** The pace-curve endpoint and response shape follow Intervals.icu's documented contract and are recorded as `Expected`, **not `Verified`**, in `docs/CONNECTED_DATA_FIELDS.md`: they have not yet been checked against a real connected run. `normalizeIntervalsBestEfforts` is written accordingly — a shape it does not recognize yields no 5K rather than a guess — and the device-side bound is what keeps an unverified source value from reaching a Crew CHECK.

### Special Blocks

D-080 stands unchanged: `finalize_crew_awards` is the single authority on who won a week, the client carries no mirror of the ranking, and **a Special Block enters the tower by being placed, not by being announced**.

So the recap reports only awards for that week that are already **standing in the Crew Build**, where every member can already open and read them. An unplaced award stays the winner's own placement prompt and appears in no recap — which is also what keeps two members of the same Crew seeing the same list.

## Presentation language

This is the part Evolution 2.05 reuses.

**The sheet is the canvas.** There is no inner stage card, no card inside a card, and no frame that is a bordered rectangle containing a number. Hierarchy comes from type, space and actual Crew objects. Bordered containers are reserved for the two places that earn one: the Today module, and a single hairline separating the controls.

**Six pages, one system — not one composition six times.** Each page gets the shape its own facts deserve, and no two are built the same way:

| Page | Composition |
| --- | --- |
| Together | Split: emblem, week, mileage hero, a three-reading scoreboard (`Runs` / `Runners` / **`Hours`**) and the participation row at the top; the week's real blocks standing on the floor, with the sheet's own sky between them |
| Best Performances | One hero effort on an accent edge, then the rest as a rhythm of rows, each naming its runner |
| Added to the Build | One centred group, tower drawn a size up, because here the tower is the subject rather than the payoff under a number |
| Awards | The award objects carry it: hollow blocks at display size, name, result, winner. The count decides the arrangement — one is a centred hero, two a pair, three or four a 2×2, more tightens — rather than `auto-fit` deciding it from whatever width is going |
| Against Last Week | The delta, then two columns of plain CSS against a chart-rule field, at a size that makes them the object of the page |
| New Week Live | The one page that centres itself, because a handoff is not a reading: emblem, title, and the new Monday–Sunday range. Nothing else — see "Every page earns its place" |

**Every page earns its place.** Evolution 2.1 replaced the old Week Complete page, which showed the emblem again, the same mileage/runs/runners page 1 had already given at display size, and the Build crop page 3 had just animated. Three jobs the recap had already done, at the moment it should have been ending — which is what made the finish weak.

What replaced it is the one fact none of the earlier pages could carry: the week that is already running. It stays a shared Crew fact — the same seven days for every member, with no personal workout, plan or schedule on it — and the footer's existing `Done` is the action, because a second button on the page would be the same tap twice.

The rule this sets for any later retrospective reusing this language: **if a finish page cannot carry a genuinely new fact, it should not exist.** Padding a story with a page that restates it is worse than ending one page earlier.

`Hours` is the same rename applied to the opening scoreboard: `On Your Feet` was a sentence fragment doing a machine label's job, next to two labels (`Runs`, `Runners`) that simply name their reading.

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
| New Week Live | a centred glow with a scatter of sparks, each spark a 2px radial stop rather than an element or an image. The treatment survived Evolution 2.1 even though the page's job changed: a week opening is as much a moment as a week closing |

Nothing here is an asset. No PNG, no SVG illustration, no exported artwork — the whole set ships as gradients.

**Each page owns its vertical composition.** The stage stretches and gets out of the way; it does not centre pages and let some opt out, which is how a tower ends up floating in the middle of a sheet instead of standing on something. Every page states three zones for itself:

| Page | Top | Middle | Bottom |
| --- | --- | --- | --- |
| Together | total and the scoreboard | participation | the week's tower, on the floor |
| Best Performances | hero effort | the rest | breathing space |
| Added to the Build | the block count | air | the tower, just above the footer rule |
| Awards | the heading | the awards, centred | breathing space |
| Against Last Week | the delta | the columns, at a size worth looking at | their two figures |
| New Week Live | — | emblem, title and the new week's range, centred | — |

**Say nothing the page already shows.** Three sentences an earlier pass used to explain its own visuals are gone, and `CrewWeekRecapSheet.test.tsx` keeps them gone: the Awards page no longer says the blocks are standing in the Crew Build, the comparison no longer reads its own delta back as a percentage, and the finish no longer congratulates anyone. Evolution 2.1 extended the same rule from sentences to whole pages — the finish no longer restates the week's figures or redraws its tower either. A recap of facts does not need a narrator, and it does not need a reprise.

**Every visual is drawn by the app.** No artwork, no illustration, no generated image, no second tower renderer. The blocks are the real `Brick` / `AwardBrick` construction under the real member colours; the identity marks are the real `CrewEmblem` and `RunnerIcon`.

**Identity is the Crew's.** Runners appear as their own Runner Icon with their member accent carried on a hairline under the mark, and their name in the reading voice. Colour identifies — whose run, which award — and never judges. No frame ranks the roster; the beats name a runner only where the Crew already names one.

**Two voices, as everywhere else.** Mono for facts — mileage, counts, time, deltas, dates as metadata, machine labels. Sans for the sheet title, the Crew name, member names, sentences and actions. Nothing below the phone type floor.

### Reused components

The recap introduces no geometry of its own. Two extractions carry the Build language into it:

- `src/features/build/BuildCrop.tsx` — a **read-only piece of tower**. Personal and Crew Build each own an *interactive* tower (placement, drag, selection, landing slots, skyline, ground). A surface that only needs to show built blocks needs none of that, and copying the geometry into a local stylesheet is how a second, drifting renderer gets built by accident. `BuildCrop` is the presentation half alone: the same `built-tower` grid, the same `placed-block` positioning, the same `Brick` / `AwardBrick` faces, the same voids, at a `hero` or `teaser` scale.
- `src/features/crew/crewBrickFace.ts` — `crewFaceLabel` and `memberPieceColor`, lifted out of `CrewBuild` so the shared tower and any crop of it cannot disagree about a block. Both are load-bearing product rules rather than styling: the asterisk is issue #129's hand-logged marker, and the colour is the only channel that says whose block this is.

`faceCulledRecapSlice` in `weekRecap.ts` adds the neighbour-aware face culling, as `faceCulledMiniBuildTower` does for Member Build — kept separate from `crewWeekRecap` so the beat's tested shape never grows fields only a renderer needs.

**The slice is real.** The Crew Build frames draw this week's blocks in their true tower columns, widths, heights and member colours, rebased on the lowest course the week reached, with the cells other weeks occupy drawn as recesses. It is `aria-hidden` behind a single accessible label, because the same facts are stated in text above it and a masonry crop has no reading order worth announcing.

## Discovery

The recap has two discovery surfaces, and they are deliberately different shapes: a **teaser** on Today, and a **notification** on Crew. Both derive the same `CrewWeekRecap`, open the same sheet, and share one acknowledgement record.

### Acknowledgement: seen and cleared

`src/storage/crewRecapAcknowledgementRepository.ts` holds both, per account and per Crew week, device-local.

| | Written by | Means | Effect |
| --- | --- | --- | --- |
| **Seen** | opening the recap from either surface | "I opened it" | clears the Crew notification's unread treatment; hides nothing |
| **Cleared** | the Today card's dismiss, or the Crew row's swipe / Clear | "I am done with it" | removes the prompt from **both** surfaces for that week |

Two rules make this the whole design.

**One record, both surfaces.** Today's teaser and Crew's notification are the same recap seen from two places. A recap cleared on Today must not still be sitting unread on Crew, so there is one stored answer rather than two independent "dismissed" concepts.

**Seen is not hidden.** The distinction is Props' — opening either Crew surface clears the unread ring, but a row leaves the list only when its runner actually clears it. A story worth telling is worth replaying for as long as its week is current.

Acknowledging a recap is a statement about a screen, never about the week: no Crew fact is mutated, and no crewmate learns of it.

### Crew: a notification

`src/features/crew/CrewRecapNotification.tsx`.

- It renders **immediately below the Crew header**, above Props and above the tower. A notification a runner has to scroll past the Build to find is a notification they will not see; Props is a running feed, the recap is the weekly moment, so the recap sits first.
- It is a **notification, not a second dashboard card**. Crew already has a notification language and it is the right one: a row rather than a panel, an unread edge, a swipe or a `Clear` button, `touch-action: pan-y` so a vertical scroll is never hijacked, and the same exit animation. Introducing a second Crew alert pattern for one weekly row would be inventing a dialect.
- The row **states the week's headline facts** — `WEEK RECAP · SEP 7 – SEP 13` over `Last week is in · 54.8 MI · 12 RUNS`. "Your recap is ready" is a notification about a notification.
- The mark is the **Crew's own emblem**, not a generic analytics glyph. The recap is about this crew and the emblem is how the product already says so.
- One notification per `crewId + weekStart`, gated by exactly the same conditions Today's teaser uses: a valid Crew with a real `buildStartDate`, available shared runs, real shared running in the week, the Monday 06:00 ET release, and the current window.
- The whole body is one target into the recap: two hit areas to one story would be two ways to the same place.

### Today: a teaser

`src/features/today/TodayCrewRecap.tsx`.

- The module renders **below Today's action surface**. The workout, the run just logged and the blocks it still owes stay first and stay louder; last week's story is a payoff on the way down.
- It is limited-time by construction: the recap window above, a real recap, and no dismissal.
- It is a **teaser, not a second dashboard card**: one header line, one sentence, one compact machine line, and a bottom row pairing the way in with a small crop of the week's real blocks. The crop is the first thing to give way — it is hidden below 360px so the copy never loses a line.
- It states the week's headline facts itself. A module that says only "your recap is ready" is a notification wearing a card's clothes.
- `View recap →` opens the fuller page-by-page recap, replayable for as long as the module is on Today.
- Its dismiss control is the **cleared** statement above, so it takes the prompt off Crew too; opening `View recap →` is the **seen** statement, which does not.
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

The recap exists for three days a week, for a Crew that ran, after a 06:00 ET release. That is right for the product and impossible to review on demand, so a preview-host demo is **required scope for this feature**, not optional QA polish: `src/features/crew/crewRecapDemo.ts`.

- `?demo=recap` — a nine-runner week with every beat present, a representative source-verified Fastest 5K, and a won-but-unplaced Special Block that must **not** appear;
- `?demo=recap-minimal` — one run, one runner, nothing placed, no previous week, and no verified 5K.

Both are preview-host-only (localhost or a Vercel `-git-` branch preview), carry their own fake crew, roster, week and awards, never touch a real Crew, account, `localStorage`, Supabase or Intervals, and never make a live source read — the 5K in the fixture is a literal in that module.

Both discovery surfaces resolve the same fixture, so one URL reviews the whole feature:

| Surface | What is reviewable |
| --- | --- |
| Today | the teaser, and `View recap →` into the sheet |
| Crew | the notification unread, opening it (seen), and clearing it |
| Sheet | every page in order, including `Hours`, the Fastest 5K, the Build animation, Awards, Against Last Week, and the new-week handoff |

Two things make it a real review rather than a mock. The demo renders the **production notification, card, sheet and derivation** — only the facts going in and the acknowledgement callbacks are fake, and the acknowledgement is held in memory so reviewing writes nothing into the runner's stored recap state. And `crewRecapDemoVariant()` also opens the **Crew destination** in `App.tsx`, because the notification lives on Crew and a reviewer with no crew could otherwise not reach the screen at all. That gate is preview-host-only, so no production hostname can reach it, and the Crew screen then renders the fake-data demo rather than any account's real crew.

Both surfaces carry a `RECAP DEMO · FAKE CREW DATA` banner.

## Naming

The recap page is titled **Awards**. The underlying object keeps its product name — a **Special Block** is still what D-080 defines, still what the Crew screen offers a winner, and still what the tower holds. "Awards" is the page's title only, because that is what the page is about: what the Crew won this week, rather than the block mechanic behind it.

## Sharing

Deliberately not implemented. Evolution 2.04 states sharing is optional and only worth doing if it can be privacy-safe and visually strong; nothing here has been widened in anticipation of it.

## Verification

- `src/crew/weekRecap.test.ts` — the window, every beat's evidence rule, the editorial order, the Fastest 5K's present/missing/invalid/tied cases, determinism across read order, the sparse-week minimum, and the field drop.
- `src/features/crew/CrewRecapNotification.test.tsx` — unseen → seen → cleared, the release hour and the window, the demo review path, and the cases that render nothing.
- `src/features/today/TodayCrewRecap.test.tsx` — the Today window, dismissal persistence, and the cases that render nothing.
- `src/features/crew/CrewWeekRecapSheet.test.tsx` — the page order, the page class the backdrop hangs off, the copy that must stay deleted, that the finish repeats neither the tower nor the totals, the large-roster overflow row, and the pages a sparse week drops.
- `src/storage/crewRecapAcknowledgementRepository.test.ts` — per-account, per-week seen and cleared kept apart, and corrupt-value tolerance.
- `src/features/crew/crewRecapDemo.test.ts` — the review overlay's host rule, its window, both fixtures, and that it reaches no real source.
- `src/connected/best5k.test.ts` — the pace-curve normalizer's recognized shapes, its refusal to invent a 5K from a nearby distance, the enrichment plan's bounds, and the probe record.
- `src/features/connected/useBest5kEnrichment.test.tsx` — that a pass stops at its limit rather than draining the rate limit, that a settled "no 5K" is remembered and a failed request is not, and that a run with nothing to ask about costs no request.
- `src/crew/projection.test.ts` — that a `best_5k_seconds` value the CHECK would refuse is never sent, boundaries included.
- `src/crew/dashboard.test.ts` — the approved column list, and a missing/unusable 5K read as no 5K.
- `supabase/tests/0026_crew_best_5k_seconds.sql` — the column's round-trip, its null case, its CHECK and its update grant.

Reviewed in a real browser at 320px, ~390px, 430px and desktop via the owner-review overlay. Real iPhone Safari review, and real-Intervals verification of the pace-curve response shape, remain owner verification.
