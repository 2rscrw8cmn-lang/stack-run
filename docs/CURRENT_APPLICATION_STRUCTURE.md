# Current Application Structure

## Current state

**UI-23 — Run Detail 2.0 is implemented for owner review, corrected against the August 13 real-device review.** It reworks personal Run Detail into a richer activity-analysis view: compact `Plan`/`Extra` status tags replace the old standalone explanatory sections, secondary metric labels are shortened and stay 2×2 on phones, a Run Profile chart adds on-demand pace/HR/elevation/cadence visualization with gap-preserving lines, HR zones become an interactive donut with no visible legend, the confusing `View intervals` button/empty-message flow is replaced by an automatic conditional Intervals section, and `Connect to Plan` moved from an always-visible inline form into a compact action and picker sub-sheet. Cadence is displayed for the first time, verbatim at the source's own convention. The governing rule, from that review: **streams give shape, imported aggregates give numbers** — no summary statistic is recomputed from per-sample data. See `## UI-23 — Run Detail 2.0` below. It adds no Supabase migration and no new dependency.

### Runner Icons (post-UI-23)

Crews had emblems and runners had colors; runners had no mark of their own, so
every compact Crew identity surface fell back to a 7px accent dot. `Runner
Icons` replace that dot with the person. D-074 records the decision.

`src/crew/runnerIcon.ts` owns the model: six heads, six faces, six bodies, six
flair options and six backdrops, and the
`R2-<head>.<face>.<body>.<flair>.<background>` code that
`profiles.runner_icon` stores. It holds no color at all — the runner's color is
`profiles.accent_color`, so an icon and the Crew Build blocks that runner owns
cannot disagree. Decoding is deliberately tolerant in the same way emblems are:
an index this client does not have degrades to that part's first option, the
four-part `R1-` code that predates backdrops still decodes (keeping its four
choices, taking the empty backdrop for the one its owner never made), and
`resolveRunnerIcon` falls back to `runnerIconFromSeed(userId)`, a stable
derivation that is why accounts predating this feature needed no backfill, are
never blocked on setup, and look the same in every crewmate's roster.
Seed-derived icons deliberately leave `flair` and `background` empty — an icon
nobody chose does not also wear a bolt or stand on a badge.

**The mark is a small robot, and it is drawn against landmarks rather than by
eye.** One square coordinate space holds every part, with fixed edges the
library composes against: the chassis runs x 30–70, the head meets the face at
y 34, the face plate is exactly y 38–64, and every body's first twelve units
are the full chassis width. Those edges are the whole reason one chest band
lands identically on six different bodies and pods sit flush on the face plate
under any head, so `runnerIcon.test.ts` asserts them as geometry — a path
nudged two units still looks fine alone and is exactly the change that makes
flair look pasted on. The drawing is deliberately blocky and rectilinear: an
arcade-console read, a step short of literal 8-bit.

The library is small on purpose. Every part has to survive at the 26–34px the
Crew surfaces actually use, so there are six options each and no expansion for
quantity; the six heads are six different silhouettes (boxy cap, flared visor,
antenna mast, twin peaks, side lamps, one-sided wedge) rather than one
silhouette with six trims, because two heads differing only in trim are the same
head at that size. Every face is the same beveled plate with different cut-outs
— slots, a visor band, one big lit eye, two lit eyes, a scan chevron, a grille —
so the part carrying the accent color stays constant and the cut pattern does
the identifying. A cut is drawn in ink rather than punched through, and a `pip`
sets the accent back inside it, which is what makes a socket read as a lit eye.

**Flair is either on the runner or off it, never halfway.** This is the part
the previous library got wrong: pieces that neither touched the figure nor
cleared it. An attached option (`Ear Pods`, `Chest Band`) is flush against a
landmark edge; a detached one (`Bolt`, `Spark`, `Orbit`) clears the chassis by
real space, so it reads as a mark beside the runner rather than a chip out of
their shoulder. Flair is also the one part drawn in a non-accent tone
(`--runner-icon-mark`), which is what makes a bolt read as applied hardware
rather than more of the runner's color. `Side Stripe` is retired — at real size
a thin vertical rule at the silhouette's edge was indistinguishable from the
icon's own outline. A retired option keeps its index and keeps decoding and
drawing — `selectableRunnerIconIndices` is what the editor and Surprise Me
walk — so no already-saved icon ever changes meaning.

**A backdrop is a badge plate behind the runner**: a dark field
(`--runner-icon-field`) with the accent on its *edge*, because a solid accent
shape would swallow the accent-colored runner standing on it. Five shapes plus
none, all of them wide enough at the middle to hold the widest head, the widest
foot and the furthest-out flair; that constraint is why there is no
needle-pointed diamond in the set.

`RunnerIcon.tsx` draws the mark at any size from one shared square coordinate
space, paints the backdrop behind the runner and flair in front of everything,
and sets `data-member-color` on the SVG itself rather than inheriting it, so an
icon lifted out of a member-colored row is still the right color. It is
decorative by default and only exposes itself as an image when given a label —
which in practice is the editor preview alone, because everywhere else the
runner's name is already beside it.

`RunnerIconBuilder.tsx` is the editor, and it is one screen: a preview pinned
above five grids of six tiles, plus Surprise Me. Choosing a part is a
comparison, and the arrows-and-labels version it replaces made the runner hold
six shapes in their head and read a name to find out what they were looking at.
Each tile draws its option in place on the runner being built with the rest of
the figure dimmed, cropped to that part's own window, so a choice is judged in
combination rather than as an isolated shape in a box. Nothing is named on
screen — names exist for assistive technology only. Six columns hold at 320px.

Editing lives at Settings → Account & Crew → Edit Profile → Runner Icon, one
level below the profile panel, reached from a row that previews the current
icon. Parts are drafted and committed with `Save Icon`; the color is not. The
editor shows the same member-accent picker the profile panel does, not a second
palette, and a color pick applies immediately because it repaints Crew Build
blocks and comparison bars as well as the icon.

The icon now stands in for the retired `.crew-member-marker` dot in Crew member
rows and the crew roster, Recent Crew Runs, Today's Crew Activity, crew
comparisons, Member Build cards and the Member Build sheet, crew-safe Run Detail
and the Crew Build legend. It does **not** go on Crew Build blocks, and
`CrewBuildRun` deliberately carries no `runnerIcon` so that boundary is
structural rather than a convention.

**Crew Build blocks carry no mark at all.** The small corner initial is gone
with `Brick`'s `monogram` prop: the whole block is already the runner's colour
(issue #65), so an initial was a second ownership signal on the same object and
the only thing keeping a Crew brick from looking like a Personal one. The
runner's name still reaches assistive technology through each block's hidden
label, and their icon lives in the legend beneath the tower.

**Both Builds land a block the same way (issue #76).** Placement is physical
now: the block falls into the position gravity already chose, squashes briefly
on impact, rebounds once and settles — about 380ms of fall, 75ms of squash and
125ms of rebound, with an impact glow gone by 640ms. It falls two and a half to
three and a half courses; `--drop-fall-max` caps that and is also the minimum
sky each site keeps above its tower, so the start of a fall is never clipped by
the stage or the Crew field's scroll edge. Personal Build's stage keeps a
Crew-sized field open while a block is in hand rather than collapsing around
the tower. There is one
implementation. `src/features/build/placementDrop.ts` turns "this block is
landing" plus its footprint into `data-just-placed` and `data-impact`, both
Builds spread those marks onto the shared `.placed-block` element they already
render, and `components.css` animates them once. `data-impact` bands the
footprint by cells — light (≤2), normal, heavy (≥6) — so a race lands harder
than a short easy run without anything approaching cartoon physics; the site
answers with a short brightening of the ground plane, plus a 1px settle of that
plane for heavy footprints only.

The landing is a moment, never a state. Only an intentional placement sets it:
Personal Build marks the block inside its existing placement payoff, and Crew
marks it through `useJustPlaced` for the length of the landing once
`place_crew_build_block` has succeeded. Page load, account hydration, Crew
refresh and multi-device sync therefore bring back a tower that is already
standing, and a Crew block another runner places while the viewer is watching
deliberately does not animate. Reduce Motion switches the whole thing off — no
fall, no squash, no glow, no ground movement, just a static ring on the new
brick and the live region's sentence. Because the motion is entirely CSS over
the deterministic position, an interrupted, skipped or reduced-motion landing
leaves exactly the same tower as a completed one.

**One icon per row, not two.** A Crew run card used to carry an activity tile
*and* a Runner Icon, which is what made it 72px tall. The Runner Icon takes the
single icon slot; what kind of run it was moves to a thin left edge on
`.crew-run-item` in the activity colour plus the type word leading the meta
line, and the card drops from three text lines to two (name and date on one,
`EASY · 4.2 mi · 39:12 · 9:20` on the next). Today's Crew Activity follows the
same rule. The general form for Crew identity surfaces: **the icon says who,
the colour says what kind.**

**Comparison bars are coloured by person.** `--comparison-accent` is gone. The
bars had been keyed to the metric, so four runners drew four identical bars in
an activity colour and a runner changed colour whenever the metric tab moved;
`.crew-comparison__bar-fill` now reads `--member-accent` off the row, matching
that runner's icon, legend entry and Crew Build blocks. The metric keeps its own
identity in the selector tabs (`--metric-option-color`). `crewComparisonStyling.test.ts`
guards both halves — one bar geometry for every metric, and a fill keyed to the
runner rather than the metric.

**The icon is the signed-in runner across STACK, not only inside Crew.** It
replaces the generic person glyph in the Account & Crew profile row and in
Settings' account row (`SettingsRow` grew an optional `mark` slot for exactly
this), and stands beside the gear in `AppShell`'s header as the account
affordance, inside the existing row at the gear's own height. Because the header
opens Account & Crew directly, `AppShell` now remembers whether a visit came
from Settings and only returns there if it did — the same pattern Run Data
already used. Personal Build gets no icon: those bricks are already all yours,
and marking them would repeat the mistake removed from Crew Build above.

`supabase/migrations/20260813170000_runner_icon.sql` adds `profiles.runner_icon`
with a check pattern matching the code format. Null stays null — nothing is
backfilled. No policy is added: `profiles` is already readable by crewmates and
writable only by its owner under the UI-18 policies, and an icon is exactly as
sensitive as the display name beside it. `updateRunnerIcon` encodes from a typed
value rather than accepting a string, so no user-supplied markup has a path into
the column. Crew membership, RLS, the safe projection contract, Build geometry
and personal AppState are all unchanged.

### Earlier phases

**UI-22 Final Product Polish + Onboarding is complete in merged PR #39.** It adds no product capability or data migration: Runs has a compact entry hierarchy, selectors/sheets/copy/formatters follow one product-wide system, and genuinely new users receive a short device-local conceptual introduction. Existing users migrate quietly and can replay the tour from Settings. UI-21 Crew Destination + Shared Crew Build and its runner-owned placement correction are complete and owner-accepted in merged PR #38. Personal STACK remains local-first at AppState schema 9 and works without Supabase configuration or an account. The Crew cross-device integrity hotfix, Run Data review-persistence/plan-matching hotfix, and focused Crew/Training Signals polish described below are implemented for owner review and predate UI-23.

UI-17 Performance Arcade remains the current presentation layer. STACK keeps its Today / Build / Runs / Plan structure — plus Crew for an active crew member — and readable system-sans body copy, while numbers, short machine labels, data modules, charts, selected states, and Build stamps share the locally bundled Space Mono/tabular language. Runs/Training Signals carries the strongest treatment; Today, Build, and Plan adopt it in progressively quieter ways.

UI-16 Trends 2.0 remains implemented beneath this presentation pass. Runs carries seven focused Training Signals with dedicated detail modules, plan-versus-actual views, accessible SVG/CSS charts, and deterministic week/run drill-downs. The analytics remain derived entirely from schema-9 plan and run snapshots.

Earlier core-loop, connected-training, Runs, and Build phases remain implemented as described below. Today is a daily dashboard, an actual run is an activity that may or may not satisfy the plan, Build is a deterministic eight-column tower, and the schedule itself is editable.

An **availability calendar** was added after UI-6 at the product owner's request. It is not in any phase document, and it contradicts locked decisions that are still on the books — see the section below. Reading a subscription link needs one server-side function, which is the first thing in this repository that is not a static asset.

## Current app shell

`src/app/App.tsx`

- Loads one versioned local `AppState` (schema version 9) into a `BootState` that is either an app or the reason there is not one.
- Owns the active Today / Build / Runs / Crew / Plan tab, and derives whether Crew is a destination at all from the Race Crew controller: signed in *and* an active member of a crew. When that stops being true while Crew is open, an effect corrects the selection to Runs; render never mutates state and the inaccessible Crew screen is not retained.
- Owns the block-placement handoff, keyed by run-log id rather than workout id.
- Saves every activity through `appStateRepository.saveRunLog`, passing the workout when there is one and `null` when there is not. Source, the external link and the imported metrics are the repository's to keep, not the shell's to resend.
- Subscribes to failed writes and hands the shell a banner when one happens.

`src/app/AppErrorBoundary.tsx` wraps the app in `main.tsx`. A render fault used to be a white screen with everything still safely in storage and no way to learn that; it now says what happened, in words that can be repeated, and offers a reload.

`src/app/AppShell.tsx`

- Renders the primary screens and passes plan, run logs, placements, and the save/place callbacks.
- Bottom navigation is Today / Build / Runs / Plan (D-044), with Crew inserted between Runs and Plan for an active crew member only (D-065). Every control in the bar is a destination and wears `aria-current` when it is the current one. Five destinations still fit a 320px bar at 64px each with no horizontal scrolling.
- Owns the global Settings sheet and its Account & Crew and Run Data child sheets. Runs owns its focused Training Signal and personal run-detail sheets; Crew owns the crew-safe run detail and Member Build sheets. Crew empty states can open the existing Account & Crew settings, which is still where account and crew management lives.
- The header is a small brand lockup — `StackMark` plus the wordmark — on the left, and one icon-only `Settings` gear on the right. Both sit in `.app-shell__header-row`, which carries the same 640px column the content and the nav use, so the gear lines up with the screen under it.

## The look, after UI-7

Three things made the app read as generic, and all three were structural rather than decorative.

**The screens led with their own names.** A large wordmark and tagline on every screen, then `Build`, then `Plan` — the app introducing itself in the space where it should be telling the runner something. The tab that got you here already said which screen it was. Each screen now leads with what it is *about*:

- Today: the date (`Thursday September 10`) as the `h1`, with the race line under it. `RaceContext` is folded into `src/features/today/TodayHeading.tsx`.
- Build: the miles the tower is made of, as a hero number. `BuildMetrics` is replaced by `src/features/build/BuildHeading.tsx`. UI-7 kept runs and streak beside the miles; UI-14 removed them, and `BuildSummaryMetrics` is now the single `totalActualMiles`.
- Plan: the week. `WeekNavigator` and `WeekHeader` — a stepper card above a description card — are one `src/features/plan/WeekLead.tsx`, which is also the screen's heading.

Every screen has exactly one `h1`, and it is content rather than a label.

**Everything was a card.** Five unrelated bands of content carried identical weight, so nothing was the thing to look at first. `src/components/ui/Section.tsx` is the quiet alternative: a hairline, an icon, a name, and the content. The card is kept for the one thing on a screen that can be acted on — the day's workout, and the completed-run summary that replaces it. This Week, Next, the build preview, `Blocks Ready` and the tower are all sections now.

**Almost nothing carried an icon.** `src/components/shared/ActivityIcon.tsx` maps every workout type to one lucide icon — Moon for rest, Footprints for easy, Zap for intervals, Timer for simulation, Mountain for the long run, Flag for the race — used on the day's card, plan rows, the pending tray and Next. Section headers, every row of the Settings sheet, and both empty states carry their own.

`src/components/shared/StackMark.tsx` is three courses of a tower, narrowing as they climb, in the piece colours. It is the same geometry `scripts/generate-icons.mjs` renders, so the header mark and the home-screen icon are one mark rather than two that resemble each other.

`src/components/ui/EmptyState.tsx` is the shared treatment for a screen with nothing on it yet: an icon, a reason, and what would put something there.

## Today — the decision surface

**Superseded by NEXT-4.** Through UI-22 this screen was a daily dashboard that composed, in the order D-020 asked for, `TodayHeading`, the day's workout, `ThisWeekStrip`, `NextWorkoutCard` and `BuildPreview`. NEXT-4 keeps every one of those parts and changes what the screen is organized around — see **NEXT-4 — Today / Home revision** below for the current composition, the element-by-element audit and the rules behind it.

What is unchanged from the earlier description and remains true:

- the date is the screen's `h1`, and the race is one quiet line under it. The large countdown card was deleted in UI-5.5 along with `RaceSummaryCard`; UI-7 folded the surviving `RaceContext` line into this heading;
- the day's workout is the only **card** on the screen, because it is the only thing on it that can be acted on. Everything else is a section, a note or a line;
- `CompletedRunSummary` is the completed state, with `Place Block`, `View Build`, `Edit Run` and delete-with-confirmation;
- the week reuses `selectPlanWeekViewModel`, so Today and Plan cannot disagree about what was scheduled;
- UI-16 removed the generic extra-run action from Today. Manual `Log Run` remains on Runs, while scheduled completion and Run Found stay on Today.

## Run entry — one form for both kinds of run

`src/features/run-entry/CompleteRunSheet.tsx` takes `workout: Workout | null`:

- **Date** (required, editable, never after today). Defaults to the scheduled date for a planned workout and to today for an extra run. Per D-022 it is the date the run happened, and the schedule never overwrites it after an edit.
- **Activity** — a native select over the five activity types, prefilled from the workout and defaulting to `Easy` for an extra run.
- Distance, duration, effort, notes, validation, guarded dismissal, and upsert behavior are unchanged.
- The sheet is titled `Complete Run`, `Edit Run`, or `Log Run` depending on what it is doing, and extra-run mode says plainly that the run earns a block without completing anything on the plan.

`runValidation.ts` gained date validation (present, `YYYY-MM-DD`, not in the future) and carries `completedDate` and `activityType` through to `ValidRunEntry`.

## Activities, completion, and the streak

`src/domain/build.ts`:

- `earnedBlocks` now reads from the run logs rather than walking the plan, because an extra run is a block the plan never knew about. Each earned block carries its `runLog`, its `workout` (or `null`), and its footprint, ordered by the date the run happened.
- `metrics.completedRuns` counts scheduled workouts satisfied; `totalActualMiles` counts every mile including extra runs. An extra run therefore adds miles and a block, and moves no completion number (D-019).
- `currentRunStreak` implements D-023: past incomplete scheduled runs break the streak, an unfinished run dated *today* is ignored until the day passes, completing today's run extends it, and rest days and extra runs do neither.
- `projectedCourses`, `projectedPhaseBands`, `MortarLine`, and `PhaseBand` are deleted along with the UI that showed them.

## Block geometry — explainable at a glance

`src/domain/footprint.ts` is now two lookups (D-018):

- Width from actual distance: `<3` → 1, `3–4.99` → 2, `5–7.99` → 3, `8+` → 4.
- Height from activity type: Easy 1, Long Run 1, Intervals 2, Simulation 2, Race 3.

`heightFor`, `medianOf`, `paceSecondsPerMile`, `PACE_SAMPLE_MINIMUM`, `projectedFootprint`, and `paceSampleFor` are deleted. Pace and effort cannot change a block, and a test asserts three very different paces and both effort extremes produce the same footprint.

## Build — the tower, and less of everything else

`src/domain/placement.ts` keeps the skyline/gravity rules unchanged but now runs on **eight** columns and identifies a placement by `runLogId`. At 320px a width-1 landing slot measures 96×52 in the isometric grid, comfortably clear of the 24px target-size floor the ten-column grid missed.

`src/features/build/`:

- `PendingBlocksTray`, `BuiltStructure`, `PlacedBlock`, `LandingSlot`, and `PlacementBar` are kept. **The legend is deleted**: five colours are learnable from the blocks and their detail sheets, and the tower is what the screen is for. `BuildMetrics` was replaced in UI-7 by `BuildHeading`.
- The projected-height shaft, capstone, summit readout, phase gauge, week mortar lines, and the `N of about M courses` scale readout are removed. `BuiltStructure` now shows the tower, the ground, a plain sky, and a block count.
- With nothing placed, `BuiltStructure` draws an `EmptyState` rather than an empty grid over a ground line, which read as a rendering fault instead of a beginning.
- `BlockDetailSheet` replaces the workout-detail sheet on Build: it opens the **run** behind a block (date, distance, duration, effort, notes), shows the scheduled workout as context when there is one, says "Extra run" when there is not, and offers `Move Block` on the newest placement only.
- The pending tray and the tower read type, colour, and date from the activity, so an extra run behaves exactly like a scheduled one and is tagged `Extra` in the tray.

### Two rendering fixes the first pass got wrong

- **Faces are culled per grid cell, not per block.** A three-wide brick with another resting on one of its columns used to draw its whole top face, so a sliver of it appeared from under its neighbour; the same happened along a side that was only partly abutted. `PlacedBlock.topFace` and `.rightFace` are now one flag per cell along each edge, and `PlacedBlock` renders a segment per flag. Each segment carries the same shear, so they tile seamlessly into the face they replace.
- **Openings are drawn.** The landing rule lets a wide block bridge a dip in the skyline, which is deliberate — `docs/BUILD_CONCEPT.md` calls them arches — but nothing drew the gap, so the block read as floating in mid-air. `BuildViewModel.voids` lists every empty cell with tower above it, and `BuiltStructure` draws each as a recessed opening.
- Courses are 26px rather than 20px, because eight columns made the bricks wide enough that 20px read as slabs.

### Placement is tactile without becoming a game

Per D-024 the chosen landing slot is draggable: `BuiltStructure.dragToColumn` maps pointer x to a column against the tower's own bounding box and snaps to the nearest **valid** option, which is the same list tapping and the steppers walk. `Drop` still commits, `Auto Place` is still the deterministic escape hatch, and tests cover drag, non-drag pointer movement, and tap plus keyboard placement side by side.

## Build after UI-14 — a trophy you can pick up

D-045 changed what Build leads with and how it feels to place a block. It changed no geometry: eight columns, width from distance, height from activity type, the same `placementOptions`/gravity, the same `BlockPlacement`, the same repack on delete, still one block per actual run.

**The heading is one number.** `BuildHeading` renders `XX.X miles built` and nothing else, and `selectBuildViewModel` no longer computes completed runs, planned runs or the streak for Build. `currentRunStreak` remains exported and tested for the screens that do report it. Nothing replaced the two figures — the point was to stop opening Build on statistics.

**The tower comes before the queue.** `BuildScreen` renders `BuiltStructure` above `PendingBlocksTray`, which had been pushing the object itself off the fold whenever a backlog built up. The tray is capped at `30vh` instead of `45vh`, and the stage carries a `44vh` floor so a six-block tower stands in a sky rather than hugging the heading.

**The blocks say what they are.** `PlacedBlock.faceLabel` derives a label from the RunLog: nothing at width 1, a one-decimal mileage at width 2, mileage plus `MI` from width 3, and `RACE` on the race whatever its distance. Nothing is stored — `formatCompactMiles` in `src/domain/distance.ts` rounds for display only, and the block's accessible name still carries the exact distance the rounding drops. The ink is `--bg` and the label sits centred, where the front face's gradient is light enough for every piece colour to clear 4.5:1; the darkest band at the very bottom of a Simulation brick does not.

**The race is a capstone once it is earned.** `data-capstone` is set from the activity type of a *placed* block, so there is nothing to draw until the race has been run and built in. The treatment is a brighter top face and an accent hairline under the top edge — existing colour, existing footprint.

**Release places it.** `BuiltStructure` holds a drag session: pressing any landing brings the block there and takes hold of it, movement past 8px makes it a drag, and letting go after a drag commits. A press and release without that movement is a tap — it selects, and `Drop` commits, so the tap and keyboard paths stay complete on their own. The move and release handlers sit on the tower rather than the slot because the slot that was grabbed stops being the chosen one as soon as the drag reaches the next column; the handlers were on the slot before, which is why a drag only ever moved one column. Landings overlap heavily — a 3-wide block has six of them — so gating the grab on "this is the chosen slot" meant a press in most of the tower started no drag at all.

**The payoff is CSS and it ends.** A 200ms settle with an impact at the end, a glow that has faded by 340ms, and a transient `X miles added · Y miles built` line that removes itself after 2.6s. The glow used to be permanent on the newest block, which made it a badge rather than a moment. `prefers-reduced-motion` drops both animations and marks the new brick with a static ring instead; nothing animates from JavaScript, which is what lets the media query switch the whole thing off. None of it touches persisted state.

**The placement copy stopped describing the packer.** No courses, no arches, no support counts — the placement bar says `Column 5`, a landing is named `Place Easy block in column 5`, and the live region says which columns the block is over. The block's own accessible name keeps its position, because that is how a non-visual user finds a brick in the tower.

While a block is in hand, `.build-screen[data-placing="true"]` drops the stage's sky floor and reserves 230px at the bottom. The placement bar is fixed over the last ~230px of a 320 x 640 screen, which is exactly where the ground line of a new tower sits, and without this the block being placed was behind it.

## Deleting a run

Added at the product owner's request during review; it is not in `CORE_LOOP_REVISION.md`.

`deleteRunLog` in the repository removes one activity and the block it earned. Pulling a placement out of the middle of the tower would leave everything above it floating, so the remaining placements are replayed through the packer in the order they were built: every block the user placed is still placed, and the tower settles into a valid shape. Deleting a run that was never placed touches no placement at all.

`Delete Run` lives in the run form beside the values it would discard, is offered only for a run that has been saved, and confirms first. Every recorded run is reachable from it:

- today's scheduled run, from Today's `Edit Run`;
- any scheduled run, from Plan's detail sheet;
- any run behind a placed block, from Build's block detail (`Edit Run`);
- any run still waiting in `Blocks Ready`, by tapping the row itself.

The last two are how an **extra run** gets corrected or removed: Plan lists scheduled days and cannot show one.

## Plan — the editable schedule

Review is as UI-5 delivered it: current week by default, all 18 weeks reachable, boundaries that stop, the `Current Week` shortcut, seven dated rows, and logging or editing a run from the detail sheet. `PlanWeekViewModel` gained `extraRuns` for Today's week strip. UI-7 merged the stepper and the week description into one `WeekLead`, which is also the screen's `h1`. The four settings that used to sit at the bottom — `Race`, `Run Days`, `Availability`, `Reset Plan` — have moved to the Settings sheet (D-041); one quiet `Training Trends` action is what is left there.

UI-6 makes the schedule editable. Two kinds of change live on this screen and stay separate: logging or editing a run records what *happened*; editing, moving, or clearing a workout changes what the plan *asks for*. Nothing does both at once, and nothing recommends a change — the plan only moves when the user moves it.

### The rules live in `src/domain/planEdit.ts`

Pure functions over a plan, returning a new one. Nothing here touches storage, run logs, or placements.

- `editPlannedRun` changes type, name, target, and instructions. The id and the date do not move, so a completed run stays attached.
- `addPlannedRun` turns a rest day into a run **keeping the day's existing workout id**, and `changeToRest` turns one back. A run with an activity logged against it cannot become rest: the recorded run names that workout, and a rest day is not something a run can satisfy.
- `moveWorkout` moves a workout to any date the plan covers. **Every date in the plan holds exactly one workout, so a move is a swap**: the workout takes the destination date and whatever was there takes the source date. That is the whole reason nothing is ever silently merged or dropped — moving onto a rest day trades the two days, and moving onto another run trades the two runs, which is exactly what the confirmation warns about. Both ids survive, so a logged run follows its workout.
- `rebuildWeeks` re-files every workout into the week whose dates contain it and re-derives what a week decides: `weekNumber`, `phase`, `build.weekRow`, and `orderInWeek`. A cross-week move therefore adopts the destination week's phase, because the phase describes the block of training a date falls in.
- `moveConflict` reports the planned run already on a destination date, which is what the UI warns about. A rest day is not a conflict.
- The race is refused everywhere: it cannot be edited, moved, changed to rest, or displaced by moving something else onto its day.
- A domain test asserts the plan's shape survives every operation — 126 dates, one workout each, seven per week, sorted, with week metadata agreeing — and that a move and a move back is byte-identical to the seed.

### The screens

- `EditWorkoutSheet` is one form for both adding a run to a rest day and editing a scheduled one; the fields are identical and only the wording changes. `workoutValidation.ts` requires a name, keeps the target as text (`5`, or a range like `4-5`, or nothing), and bounds instructions.
- `MoveWorkoutSheet` shows what is on the destination date *before* anything happens. Landing on a rest day is quiet; landing on another run turns the action into `Swap These Days` and names both days, which is the required confirmation made concrete rather than a yes/no about an unnamed collision. The date field is bounded by the plan's own range.
- Rest rows are now buttons that open straight into `Add Planned Run` — there is nothing else to say about a day the plan leaves empty.
- `WorkoutDetailSheet` gained a `Change the plan` group: `Edit Workout`, `Move Workout`, `Change to Rest`. It is absent on race day.
- A day with a run already logged against it confirms before the plan changes under it, and `Change to Rest` is not offered for one at all.
- `ResetPlanDialog` is the one action that destroys everything, behind two deliberate presses, with the counts of what will be erased on screen while the user decides. It is reached from the `Reset Plan` row at the foot of Settings, which says on the row itself what it erases.
- `savePlan` in the repository persists an edited plan; run logs and placements are untouched, which is what keeps a completed run attached to its workout across an edit or a move.

## The race, and the plan built for it

`src/domain/racePlan.ts` and `src/features/plan/RaceSetupSheet.tsx`, reached from `Race` in Settings.

**One race at a time.** A plan is for the thing you are training for, and two of those is two plans. Name, date, start date, distance (5K / 10K / Half / Marathon) and level (Novice / Intermediate / Advanced) are the answers, and changing any of them rebuilds the schedule.

### What the generator is, and is not

It is arithmetic over a template. The distance and level pick runs per week, where the long run starts and finishes, how many miles the first and biggest weeks hold, and how long the taper is; the weeks between the start and race day decide the rest. **Weekly volume is the primary progression and the long run is a share of it** — see "The load rules" below, which is the part of this that keeps somebody in one piece. Race week is two shakeouts and the race.

It is **not** coaching. It reads no logged run, knows nothing about how last Tuesday went, and will not adapt if it went badly. It produces a starting point, which every other screen then lets you edit. That is the line D-021 draws and this stays on the right side of it.

- The plan runs to **race day**, not to a round number of weeks, and nothing is scheduled after it.
- The weeks come from the calendar, clamped to what the template stretches to. A race further out than that starts later than today, and the sheet says so rather than inventing an eight-month 10K plan.
- Too close for the distance is a **warning, not a refusal** — it is the runner's race. A date already past is refused, because there is nothing to plan.
- Runs land only on the days `runDays` allows, spread across the week with the long run last. Race day is exempt: the race is when the race is.
- Every date holds exactly one workout, so plan editing, moving, and the run-day reshape all work on a generated plan exactly as on the seeded one.

### The load rules (D-043)

The first version of this generator made every run in a week a fixed fraction
of that week's long run. That one decision produced most of what was wrong with
it: cutting the long run by a third on a down week cut *the whole week* by a
third, and returning to the ramp put the whole week back up by half. Half and
marathon plans had week-on-week rises of **+65% and +70%**, repeatedly, and the
week-on-week rise is not even the metric that matters — measured properly, four
to seven build weeks per plan exceeded the biggest week already run by more than
a tenth, by as much as 18%.

Weekly volume is now the thing that progresses, and the runs are budgeted out of
it. Five rules, all asserted over every distance × level × {min, ideal, max}
weeks in `racePlan.test.ts`:

1. **No week exceeds the biggest week so far by more than a tenth**, or two
   miles, whichever is larger. Measured against the biggest week *already run*,
   not against last week — a down week is a step back on purpose, so the rebound
   off one says nothing about load. The two-mile floor is there because ten
   percent of a six-mile week is a rule about nothing.
   This is enforced on the **scheduled miles**, not on the ladder: every run is
   rounded to the half mile, and on a small week three of those roundings add a
   tenth on their own. `runsForWeek` takes a cap and shaves half a mile at a
   time off the longest easy run until the week fits. The long run and the
   quality sessions are never trimmed; the easy miles are what is negotiable.
2. **A down week is a fifth off the week before it**, not a third off the ramp
   ahead, and the long run comes off harder than the week does (0.7 against 0.8)
   because easing the long run is what a down week is for.
3. **The long run grows by miles, not by percent** — at most 1 mile a step for a
   5K or 10K, 1.5 for a half, 2 for a marathon. A percentage is the wrong model:
   a mile is a third of the way up from three and a twentieth of the way up from
   twenty. These ceilings do not bind on a full-length plan. They exist so a
   squeezed one climbs as far as it safely can rather than opening at the peak —
   a four-week marathon used to prescribe a twenty-miler in week one.
4. **Hard days are spaced.** The week's runs are built in the order they will be
   run, and the two quality sessions of an advanced week take slots 0 and 2, so
   they are never consecutive and neither lands the day before the long run. An
   advanced marathon block used to run intervals on Monday and race pace on
   Tuesday for 21 of its 24 weeks.
5. **A taper cuts distance, not frequency.** Dropping a run while keeping three
   quarters of the volume concentrated what was left — taper weeks were
   scheduling easy runs longer than any in the block they were resting from.

Two smaller things went with them. Easy runs in a week are no longer identical:
they descend (`EASY_SHARES`) so the day before the long run is the gentlest, and
no easy run may outgrow the long run. And race week's shakeouts are chosen from
the days that actually **precede** race day — picking two weekdays and then
deleting whatever fell after the race silently cost the second shakeout on every
race that was not on a Sunday.

### Sessions that say what the session is

`Intervals: 4 Miles` used to carry the sentence "Warm up, then repeats at a hard
but controlled effort with easy jogging between" — no count, no rep length, no
recovery, which is the entire part of the session that is a decision. The seed
plan STACK ships with has always said `4 × 30 seconds hard with 60 seconds
rest`; a generated one now says `6 × 800 m at 5K effort with 2 minutes of easy
jogging between`, with the rep length and the effort taken from the race
distance and the count from the session's own mileage. Race-pace runs say how
many of their miles are at race pace.

### Reading the level off the plan (D-043)

`RaceSetupSheet` used to open on **Novice** whenever no race setup was saved —
which is exactly the state the plan STACK ships with is in. That plan has 15
interval sessions and 4 race-pace runs; a novice plan has none. So opening Race
for any reason at all, including to set a start date, and pressing the button
replaced every one of them with an easy run, silently.

`inferRunnerLevel(plan, distance)` reads the level off the plan instead, and
weights **how often it runs at ten times what it runs**. The shipped plan runs
four days a week *and* has speed work, a combination none of the three levels
expresses; reading it as Advanced because of the speed work would hand the
runner a plan with 60% more mileage in its biggest week. Frequency is the honest
proxy for load, so frequency decides and the quality content only breaks ties —
the shipped plan reads as Novice.

That makes the default safe rather than silent, so the sheet also says what the
choice costs: it names the hard sessions the current plan holds and states that
the chosen level will replace them, and the summary line now gives **the biggest
week in miles** as well as the peak long run, because how much running this is
was the part of the choice the sheet never mentioned.

### Regenerating never costs a run

`relinkRunLogs` re-attaches recorded runs to the new plan **by date**: a run keeps its scheduled link when the new plan asks for a run that day, and becomes an extra run when it does not. Nothing is ever discarded — the miles are real and the block is already built — and two runs on one date cannot both satisfy it, so the earlier keeps the link. `saveGeneratedPlan` is the only writer that touches the plan and the run logs together, and it is why offering a rebuild is reasonable at all.

## Run days — the shape of the week

`src/domain/runDays.ts` and `src/features/plan/RunDaysSheet.tsx`, reached from `Run Days` in Settings.

The plan arrives with a shape — Tuesday, Thursday, Saturday, Sunday — and that shape is a suggestion about spacing, not a fact about anybody's life. Somebody who never runs on Sundays should not have to move eighteen Sundays by hand, one sheet at a time.

The picker starts on **every day**, not on the days the plan happens to use. Those are different facts, and conflating them makes the obvious gesture useless: unchecking Sunday from Tue/Thu/Sat/Sun leaves three days for four runs and answers "17 runs have nowhere to go" — true, and no help at all. From the whole week it answers "16 runs move", which is what was meant. The plan's current shape is stated beside the picker as information.

- Each run moves to **the nearest unblocked rest day in its own training week**, earlier breaking ties, and no two runs land on the same day. The same rule the availability calendar uses, for the same reasons: the week is the unit that carries the training, and a swap onto another run would just move the problem.
- Race day never moves. Neither does a day in the past, nor one with a run already logged against it.
- Every swap goes through UI-6's `moveWorkout`, so a bulk reshape holds the same invariants a single hand-made move does — one workout per date, 126 dates, weeks re-derived.
- **What it will do is shown before it does it**, down to the first four moves and a count of the rest, including the weeks it cannot help. A week asking for more runs than the days allow says so rather than silently leaving them.

It is a preference, not a prohibition: it reshapes the plan when asked, and does not police edits made afterwards. Stored as `runDays` so a later plan can be built to fit it; null means the runner has not said.

## Availability — days you cannot run

Added at the product owner's request, and **not covered by any phase document**. It needs an explicit decision entry before the docs are consistent again, because it sits against three things `AGENTS.md` and `DECISION_LOG.md` currently lock:

- "No account, auth, backend, API…" — an imported calendar is external data, and reading a subscription link now needs one server-side function (see below). There is still no account, no auth, and nothing stored off the device.
- "Manual logging only" — still true of runs; this imports commitments, not activity.
- D-021's "no adaptive coaching" — the plan is never changed automatically, which is what keeps this on the right side of the line, but the line is close enough to be worth writing down.

### How the data gets in

`src/features/availability/AvailabilitySheet.tsx` takes **either a subscription link or the contents of an `.ics` file**, in one box, plus a file picker.

The picker is deliberately unrestricted, and the file it is handed goes through the same two paths as a paste. Both are lessons from a phone. A calendar downloaded on iOS often arrives with no extension and no type — Safari saves one as plain `text` — and an `accept` list greys exactly that file out, which breaks the fallback for the person who has already been let down once. And such a file frequently holds *the subscription link* rather than a calendar: 68 bytes of URL is what "download the calendar" produces more often than not. So a chosen file whose contents are a link is followed like a pasted one, and remembered as a link so refreshing stays one tap. `nameFromFile` throws away the names a phone invents (`text`, `Untitled`, `calendar`) rather than naming an import after them.

The first version took file contents only, on the reasoning that a subscription URL is a standing credential worth not storing. That was the wrong trade in practice: a rostering system hands out a link, and on a phone the link is usually the only form of it you can get at — extracting the file behind it means downloading it, finding it in Files, opening it in something that shows text, and copying the lot. Pasting the link is the obvious move, so the app understands one.

`src/domain/calendarSource.ts` decides which was pasted, rewrites `webcal://` to the HTTPS request it really is, and fetches.

The page asks the calendar host itself first, so when the host permits it nothing but the browser ever sees the link. Rostering systems generally do not permit it: a browser cannot read a cross-origin response unless the host sends `Access-Control-Allow-Origin`, and QGenda — the calendar this was built for — does not. That refusal is reported to the page exactly as a dead network is, an opaque failure, and no amount of client code can get around it.

So a refused read falls through to **`api/calendar.ts`, the one piece of server-side code in STACK**. It fetches the link where the same-origin rule does not apply and hands the calendar back. A host that answers with an *error status* has genuinely answered and is not retried — the server would get the same reply.

The three ways this can fail are told apart on purpose, because standing in front of the app with a link that will not import, the useful question is *which* of them happened:

- **No reader on this build** — a POST to `/api/calendar` answers 404 or 405, or answers 200 with something that is not a calendar, which is what a static host does when it rewrites unknown paths to the app's own HTML. The message says so and suggests waiting if the deploy is fresh. A reader that exists always answers a POST, so these responses can only mean it is absent.
- **The reader failed** — it explains itself in short plain text (the upstream status, an unreachable host, a link that is not a calendar), and those words are shown as they are.
- **Nothing reachable at all** — the request itself threw. The message names the file picker, which needs no network path whatsoever.

Both requests are bounded: eight seconds for the direct read, twenty-five for the reader, which is allowed ten seconds of its own upstream. A host that accepts a connection and then says nothing is otherwise indistinguishable from a broken app — the promise simply never settles. And while a read is in flight the sheet says so in words, because the shared button's loading state is a drop to 60% opacity, which on a dark screen reads as nothing happening at all.

The function is deliberately small and deliberately dull:

- It answers `POST` only, with the link in the body, so a standing credential never lands in a request log or a browser history. A `GET` answers in plain English that the reader is deployed — opening the path in a browser is how you find that out from a phone.
- `https` only, and never an address that is not on the public internet — loopback, link-local, and the private ranges are refused, on every redirect hop as well as the first, and redirects are followed by hand up to three times for that reason.
- It returns nothing that does not contain `BEGIN:VCALENDAR`, which is also what stops it being a general-purpose fetcher for other people's pages, and nothing larger than 2 MB.
- It stores nothing, logs nothing, and reads nothing from the request but the link.
- Fifteen seconds is the budget for the **whole** read, spent across redirects rather than granted afresh to each — three hops at a fresh timeout each could outlast the platform's own limit, and a function killed mid-read tells the page nothing.
- It answers whichever way the runtime calls it: the web-standard `(Request) → Response`, or the older pair where the response must be written to a second argument. Guessing wrong is not a visible error — nothing is ever sent, the invocation runs until the platform kills it, and the dashboard reports a **timeout with no error beside it**. That is what happened in production, and it costs twenty lines to make impossible.
- It sends a browser-shaped `User-Agent` and allows fifteen seconds. Rostering hosts answer a request that looks like a browser and refuse one that does not; a working import against the same feed from another app is where both numbers come from. Nothing is being disguised — this is the user asking for their own calendar, with a link they already hold, in response to something they did.

### Keeping it current

`src/features/availability/useRosterRefresh.ts` re-reads a remembered link **once when the app opens**. A shift calendar is somebody else's document and it changes without warning; requiring a tap on Refresh means the blocked days are only ever as current as the last time the user thought about them, which is the opposite of the point.

It is quiet when it fails — the stored roster is still the best thing available, and an error on every cold start for a link that is briefly down is noise. The sheet's own Refresh button is where a failure is worth reporting, because there the user asked. It does not touch which shifts block a run or whether the calendar is used at all, and it never changes the plan: new blocked days surface as proposals on Plan, one accept at a time, exactly as an import does. It reads what was stored when the app opened rather than reacting to the current value, so importing a calendar by hand does not immediately re-read it.

A link that worked is remembered so refreshing is one tap. It is shown in full wherever it appears, carries a plain warning that anyone holding it can read the schedule, and can be forgotten without discarding the shifts already imported. It is sent to the calendar host, by way of the reader when the host refuses the browser, and nowhere else.

`api/` is typechecked as its own TypeScript project (`tsconfig.api.json`) because it runs on Node rather than in the browser, and `api/calendar.test.ts` runs in a Node environment rather than jsdom.

`vercel.json` exists for one line: `maxDuration` of thirty seconds on this function. A Hobby deployment stops a function at ten by default, which is *less* than the fifteen the reader allows its upstream — so a rostering host having a slow morning would be cut off by the platform mid-fetch, and the page would be told something vague instead of the truth. Naming the file there also states plainly that it is meant to be a function, which is worth something the day somebody wonders why it is not.

`src/domain/ics.ts` parses it: RFC 5545 line unfolding, `VEVENT` extraction, `DTSTART`/`DTEND`/`SUMMARY` in all-day, UTC and `TZID` forms, multi-day expansion with the exclusive all-day end date, and escaped text. A `TZID` value is read as wall-clock time and used as written; converting properly would need a timezone database, and the calendar being imported is one the user reads in their own zone. Recurring events are **skipped and reported**, never expanded — a half-implemented `RRULE` would invent working days that do not exist. A `STATUS:CANCELLED` event is dropped silently rather than reported: rosters keep a cancelled shift around instead of deleting it, it is a day *off*, and blocking a run for one would be exactly backwards.

### Which shifts matter is the user's call

`shiftKinds` groups the import by shift name with day counts and times, and the sheet asks which of them stop a morning run. A night shift may free the morning or ruin it, and only the user knows. Nothing blocks anything until they say so. The whole calendar can be switched off without losing the import.

### What it does with them

- `blockedDates` is the set of days, each with the shifts responsible and the hours they cover. Two shifts on one day span both; an all-day shift swallows the rest.
- Blocked days are marked **only on days that ask for a run**, on Plan's rows and Today's This Week strip. A rest day is not owed, so a work shift is not in its way, and marking one says a run is at risk when none was asked for.
- What a row shows is the **hours**: `Blocked 6 AM – 6 PM`, or `Blocked all day`. A shift's name belongs to the roster it came from — `CCM ORMC APP Day 1R 6a-6p [Turco St]` is precise and it is also a wall of somebody else's shorthand on a screen whose job is to say what to run. The names stay in the availability sheet, where choosing them is the task, and in the row's spoken label, where there is no room cost.
- `findAvailabilityConflicts` reports scheduled runs on blocked days that could still move: today or later, not already logged, never the race.
- `proposeDateFor` offers **one** destination: the nearest unblocked rest day in the workout's own training week, earlier date breaking ties. Only rest days, because a swap onto another run would push that run onto the blocked day and just relocate the problem. Only the same week, because the week is the unit that carries the training. When there is no room it says so rather than inventing something.
- `ConflictReviewSheet` lists the conflicts and their proposals. **Every move is accepted individually and applied through UI-6's `moveWorkout`**, so the plan's invariants hold. Nothing is ever applied automatically: sliding an easy run a day is nothing, moving a long run reshapes a week, and only the runner knows which they meant.

There is no pace model, no ranking of sessions, and nothing that chooses *what* to run — only *when*, and only when the user says yes.

## Persistence

`AppState.schemaVersion` is **8**. The storage key is unchanged.

- `raceSetup` holds the race a plan was generated for, or null for the plan STACK shipped with. Version 7 migrates to null: there is no setup behind the seeded plan to reconstruct, and guessing one would claim the generator produced something it did not.

- `runDays` holds the weekdays the runner will run on, or null. Version 6 migrates to null rather than to the days the plan happens to use: the runner has not said anything yet, and inventing a preference from the schedule would put words in their mouth.

- `availability` holds the imported calendar — name, import time, shifts (date, label, times), the blocking labels, and its on/off state — or null. Version 5 migrates by setting it to null; there is nothing to derive one from and nothing to guess.

- `RunLog.workoutId` is `string | null`, and `RunLog.activityType` records what the run was.
- `BlockPlacement.runLogId` replaces `workoutId`; `height` is `1 | 2 | 3`.
- `saveRunLog` takes an optional `id`: a scheduled run is still found by its workout, an extra run is found by its own id, and saving an extra run without one records a new activity. Two extra runs on the same day never merge.
- `placeBlock` validates against the run log's own footprint.
- `migrateAppState` upgrades versions 1–4 to 5: every run keeps its values and timestamps, its activity type comes from the workout it satisfied (falling back to Easy if that workout is gone), placement identity moves to the run log, geometry is re-derived from the activity, and the tower is replayed through the packer because the grid narrowed. **Migration never invents an extra run**, and a placement whose run log is missing is dropped rather than orphaned.

## When storage cannot be read

Everything STACK knows lives in one browser, which makes unreadable storage the
one failure that can cost a season of training. The old behaviour was to catch
it, warn the console, and hand back a fresh state — a recoverable problem
turned into an unrecoverable one, silently, and then overwritten on the first
save.

`loadAppState` now distinguishes three failures and never destroys anything:

- **Corrupt** — the stored text is not JSON, *or* it is JSON that no migration recognises. The second case used to escape the `try` altogether and take the whole app down with it. Either way the raw value is copied to a timestamped backup key before anything else happens, and a `StorageLoadError` carrying that key is thrown.
- **Unreadable** — the browser refused local storage outright (a private window, or site data switched off). There is nothing to keep and nothing to repair, only a session that will not survive being closed.
- **Absent** — no state yet, which is not a failure: the seed plan.

`src/features/recovery/StorageRecoveryScreen.tsx` is what the app *is* while a load has failed. It names the backup key, offers to download the damaged copy as a file, puts `Start Fresh` behind a second deliberate press with what will be lost on screen, and offers `Try Again`. Nothing in storage is touched until the user chooses. Unreadable storage gets different words and one action — `Continue Without Saving` — because none of the others would do anything.

A **failed write** is the other invisible loss: the screen already shows the run, and it is gone at the next cold start. `saveAppState` no longer throws into the render. On a quota error it drops the oldest backup and retries once — those backups are the largest thing the app owns that nothing reads on a normal run — and otherwise reports through `onStorageWriteError`, which the shell turns into `StorageWriteBanner`. One listener rather than a threaded result: every mutation in the repository ends in `saveAppState`, so this costs nothing at fifteen call sites.

## Installability

`public/` is copied verbatim into the build:

- `manifest.webmanifest` — standalone display, portrait, `#071018` on both colours, and three icons (192, 512, and a 512 maskable with everything inside the middle half).
- `icon-192.png`, `icon-512.png` — rounded, transparent outside.
- `apple-touch-icon.png` — 180px and square, because iOS applies its own mask and pre-rounded corners would show as dark ones.
- `icon-maskable-512.png`, `favicon.svg`.

`scripts/generate-icons.mjs` draws all of them. There is no image tooling in this repository and no reason to add a dependency for four flat shapes, so it rasterises rounded rectangles at 4× and encodes the PNG with Node's own zlib. The PNGs are committed; a normal build never runs it.

`index.html` carries the description, `theme-color`, the Apple web-app meta, `viewport-fit=cover`, and Open Graph tags. The shell pays the safe-area insets back in CSS, so the header clears the notch and the bottom navigation clears the home indicator.

**There is no service worker.** UI-7 allows one only if offline behaviour is explicitly tested, and it is not, so there is none: an untested service worker is a cache that serves a stale app and cannot be talked out of it.

`src/app/installability.test.ts` reads `index.html` and the manifest through Vite's `?raw`, and asserts they agree with each other and with the files in `public/` — and that `DevDataPanel` has left the source tree rather than merely being gated.

## Accessibility, after the final pass

- Exactly one `h1` per screen, and it is the content the screen leads with. No level is skipped.
- `--text-subtle` was raised from `#6f7a84` to `#848e98`. It carries small text — inactive tab labels, row status, uppercase metric labels — and at the old value it measured 3.7:1 on `--surface-strong`, under the 4.5:1 WCAG AA asks of body text. It is now 4.9:1 at worst and 5.8:1 on the page.
- Every interactive control on every screen and in every sheet measures at least 44px tall at 320 and 390px, checked by driving a production build rather than by reading the CSS.
- Icons are decorative throughout: every one sits beside text that carries the same meaning, and none is the only way to know something.
- Motion, focus rings, and the reduced-motion escape hatch are unchanged from UI-5.5.

## Dev tools

There are none. `src/dev/` is deleted, along with the gate test that guarded it: gating a panel is a thing you do while it is still useful, and UI-7 is where it stops being.

## Tests

510 tests pass. New or substantially rewritten coverage:

- `src/storage/migrations.test.ts` — the 4 → 5 upgrade: values and timestamps preserved, activity type from the workout, no invented extra runs, identity moved to the run log, repack into eight columns, pace-derived height discarded, orphaned placements dropped, and versions 1–3 still upgrading.
- `src/domain/footprint.test.ts` — every width band and type height, and proof that pace and effort do not move geometry.
- `src/domain/build.test.ts` — extra runs earning blocks, miles counted but completion not, and every streak boundary in D-023.
- `src/storage/appStateRepository.test.ts` — extra-run creation, non-merging, edit-by-id, and placement by run log.
- `src/features/run-entry/` — date defaults for both modes, the future-date rejection, and the activity type on save.
- `src/features/today/TodayScreen.test.tsx` — the whole dashboard: race line, week strip, extra chip, Next, `+ Log Run`, and the build preview.
- `src/features/build/BuildScreen.test.tsx` — eight-column slots, the removed engineering UI, the run-first detail sheet, extra runs in the tray, and the drag layer.
- `src/app/App.test.tsx` — an extra run end to end through real storage, a stored schema-4 state migrating without losing the run or its block, planning a run on a rest day and finding it after a reload, and the two-step reset.
- `src/domain/planEdit.test.ts` — every edit rule, the plan's shape invariant, cross-week moves and the phase they adopt, race protection in both directions, and the move round trip.
- `src/features/plan/PlanEditing.test.tsx` — the flows: edit, add to a rest day, change to rest, move onto rest, the swap warning, out-of-range refusal, the confirmation on a completed day and what happens when it is declined, race day offering no plan edits, and the two-step reset.
- `deleteRunLog` — removal, the block leaving the tower with it, the tower re-settling after a block is pulled from underneath, and a no-op for an unknown id. Today and Build cover the confirmation, the decline, and the absence of delete on an unsaved entry.
- Per-cell face culling, including an edge covered over only part of its length, and the openings a bridging block spans.

Added by UI-7:

- `src/storage/appStateRepository.test.ts` — a stored shape no migration recognises being backed up rather than thrown into the render, storage the browser refuses to open at all, a write failure reported instead of raised, and the oldest backup dropped on a full quota so the retry succeeds.
- `src/features/recovery/StorageRecovery.test.tsx` — the recovery screen end to end through the real `App`: the damaged value untouched and named on screen, `Start Fresh` refusing to act on one press, the seed plan afterwards with the backup still in storage, the damaged copy downloaded as a file, unreadable storage offering only `Continue Without Saving`, and a failed write raising a dismissible alert.
- `src/app/installability.test.ts` — document metadata, the manifest, the icons it names, the icons it does not, and the absence of `DevDataPanel` from the source tree.

## Known limitations

1. A moved workout swaps days with whatever was on the destination. That is the non-destructive reading of "do not silently merge workouts", and the sheet says so before committing, but it is a choice: the alternative — refusing the move, or pushing the other workout to the next free day — would behave differently on a full week.
2. A block can only be moved while it is the newest placement; there is still no way to remove one.
3. The activity type is editable for a scheduled run as well as an extra one. The UX spec says "prefilled from scheduled workout otherwise", and one editable field for both modes was the smaller implementation; a scheduled run that was actually intervals therefore earns an intervals block.
4. `Log Run` from Today always creates a new activity; extra runs are edited and deleted from Build, which is the only screen that lists them. There is still no chronological list of activities.
5. The tower's stage keeps a fixed sky above the blocks, so a two-block tower sits under some empty space. That is scenery, not a projection.
6. The run form's Date field is a native `input[type="date"]`. Its intrinsic width is wider than a 320px sheet on iOS, which used to push the sheet sideways; it is now pinned with `min-width: 0`, `max-width: 100%`, and `-webkit-appearance: none`, with `overflow-x: hidden` on the sheet body as a backstop. There is no iOS Safari in this environment, so that combination is reasoned rather than measured here — worth a look on the phone.
7. There is no way to export or import the stored state. Recovery can save a *damaged* copy off the device, but a healthy one cannot be moved to another browser or another domain, and local storage belongs to an origin. Changing the production domain therefore strands the training behind it.
8. Nothing works offline, deliberately: no service worker was added because none was tested. Opening the installed app without a network shows the browser's own failure page.
9. `apple-mobile-web-app-status-bar-style: black-translucent` and `viewport-fit=cover` are paid back with `env(safe-area-inset-*)` in the shell. That is reasoned from the spec and checked in Chromium; it is one of the things `docs/RELEASE_CHECKLIST.md` asks to be looked at on the actual phone.

## Update rule

After each implemented phase, update this file with:

- New source directories/components
- New state/persistence behavior
- Features delivered
- Features intentionally deferred
- Tests added
- Known product/technical limitations

## UI-8 — Connected Data Foundation

UI-8 adds a narrow `api/intervals.ts` GET proxy. It accepts only status,
bounded activity/wellness ranges, and validated activity detail ids; requires
the separate `X-Stack-Sync-Token`; keeps the Intervals personal key on the
server; and returns private responses with `Cache-Control: no-store`.

`src/connected/intervals.ts` owns the browser client, raw-response
normalization, meters-to-miles boundary, optional metric validation, external
id/ignored-id suppression, and deterministic scheduled/manual match helpers.
Raw Intervals objects do not enter React or AppState.

Schema 9 adds manual/imported source metadata and optional normalized metrics
to run logs plus `intervalsSync` activity-sync/ignored-id state. Migration 8 →
9 is additive. The local proxy token is deliberately outside AppState at
`stack.intervals.sync-token.v1`, through
`src/storage/intervalsTokenRepository.ts`.

The three-tab shell opens a secondary **Run Data** sheet, from Today and from Settings. It can
test/connect, perform 90-day first sync and 14-day normal sync, review planned
or extra imports, attach data to a likely manual run without changing its id,
ignore candidates, clear ignored ids, and forget only the connection token.
Manual run entry and the availability-calendar route remain independent.

The deployed Vercel/iPhone smoke test and June 10 real-field catalog update
cannot be performed in the secret-free repository environment. UI-8 must not
be marked complete until those checks are recorded in
`docs/CONNECTED_DATA_FIELDS.md`; no raw activity or location payload belongs
in the repository.

## UI-9 — Connected Run Detail

`src/features/workout-detail/RunResultDetail.tsx` is the shared actual-run
presentation used by both scheduled workout detail and Build block detail. It
keeps date, distance, duration, effort, notes, and planned/extra context,
derives pace from the stored STACK distance and duration, and progressively
adds present imported HR, elevation, training-load, and HR-zone values. Missing
metrics do not produce placeholder zeroes. Cadence remains deliberately hidden
until its HealthFit → Intervals semantics and units are recorded as Verified in
`docs/CONNECTED_DATA_FIELDS.md`.

An imported run with a locally stored sync token offers **View intervals**.
Only that explicit action calls the already-whitelisted activity-detail proxy;
normal activity sync still makes no detail requests. The browser normalizer
keeps only explicitly named, positively timed groups and drops the rest of the
upstream activity object. Detail arrays are held only in component memory and
are never added to AppState/localStorage. Failure and rate-limit responses stay
retryable without hiding the saved run facts.

HR zones use a text list containing zone name, duration, and percentage, not a
chart-only encoding. Structured interval rows likewise include readable names
and durations, with distance and average HR only when present. No cadence,
wellness, trends, maps, raw streams, FIT parsing, chart dependency, persistence
migration, or upstream write was added.

## UI-8/UI-9 connection repair

Connecting failed on a correctly entered sync token, and every distinct cause
arrived on the phone as the same sentence: "Run Data could not be reached."
Four things were behind that.

**The connection test asked for an endpoint the contract does not name.**
`resource=status` read `/api/v1/athlete/0`, which is not one of the three
activity endpoints this integration is specified against; an upstream refusal
became a generic `502` and the owner could never get past **Test / Connect**.
Status now runs a one-day query against the same activity endpoint sync itself
uses — a broken setup and a working one now answer differently — and returns
`{ ok: true }` rather than any of the data it read.

**The reader answered only one of the two calling conventions.** A Vercel Node
function may be invoked web-standard (`Request` → `Response`) or Node-style
(`req`, `res`). `api/intervals.ts` assumed the first, so under the second it
either dropped its answer until the platform killed the invocation or threw on
a path with no origin. It now handles both, forwarding method, query and the
token header, exactly as `api/calendar.ts` has since UI-7.

**Nothing the reader said reached the screen.** The client threw away the
response body, so a missing deployment secret, an undeployed route, a rejected
Intervals key and a bad argument were indistinguishable. Each reader error code
now maps to the thing to go and fix, `503` names the missing variable, `404`
says the function is not deployed, and a request that never left the device is
reported separately from one that was refused.

**Two smaller repairs.** The sync token is compared in constant time and both
secrets are trimmed, so a value pasted into a dashboard with a trailing newline
authorizes instead of mysteriously failing; and the upstream read carries its
own timeout, so a slow Intervals returns `504 upstream_timeout` instead of a
bare platform timeout.

Imported distance is also now rounded to two decimals where it enters STACK —
`src/domain/distance.ts` formats what is already stored — because a converted
distance is a fifteen-decimal float and every screen, including the edit
sheet's text field, prints the stored number directly.

## UI-10 — Connected Today + Week

Sync stops being an errand. `src/features/connected/useConnectedSync.ts` owns
one sync for the whole app: it runs when the app opens and when it comes back
to the front, and only when the last successful sync is older than thirty
minutes. Between those moments STACK asks Intervals nothing at all — there is
no polling anywhere in the app. Returning to a phone app fires `focus` and
`visibilitychange` together, and again when a sheet closes, so an in-flight
guard and a five-minute floor between automatic attempts keep that from
becoming a request storm. `Sync Now` is unconditional, because there the user
asked.

The lookback is deliberately not "everything newer than the last sync": the
first sync reaches back ninety days, and every later one re-reads a rolling
fourteen. HealthFit can deliver an activity days after the run happened, and a
window anchored to the last sync would step over a late upload permanently.

Candidates now live above both screens rather than inside the Run Data sheet,
so Today and Run Data cannot show different answers. Today renders at most one:
`selectRunFound` takes the newest candidate within three days, preferring one
that matches a scheduled workout. `RunFoundCard` states the objective facts —
distance, duration, derived pace, average HR when present — and offers the one
judgement a watch cannot make. Neither action imports anything by itself; both
open the same review UI-8 already had, which is where effort, notes and the
earned block are settled. `Not now` hides a run for the session and the next
sync offers it again; `Ignore this run` writes it to the persisted ignored
list.

`selectWeekActuals` adds actual miles, total run time and the longest run to
This Week. These sit below the progress bar rather than inside it, and count
every run in the week by the date it was run: an extra run is real mileage but
it still cannot tick off a workout the plan never scheduled, so "1 of 4 runs"
is computed exactly as before.

A failed sync stays quiet. The plan, the manual log and the Build are all still
true without Intervals, so a failure sets a retry line low on Today and gets
out of the way — and says nothing at all while there is a run to offer.

## UI-11 — Training Trends foundation (superseded by UI-16)

UI-11 introduced five derived trend answers and an all-in-one Trends sheet.
UI-16 retains the useful actual-date and coverage rules from that foundation,
but the old sheet and its chart components are now deleted. This Week on Today
switches to Runs; it does not open an analytics overlay.

Two rules run through the selectors. Runs are placed by the date they were
actually run, never by the date of the workout they satisfied — a Sunday long
run confirmed against Saturday's slot is Sunday's mileage. And a run is a run:
a typed one and a synced one are the same thing once recorded. Consistency is
the one measure that stays about the plan, so it counts only scheduled
workouts whose day has arrived, and extra runs are excluded from it by
construction.

Coverage remains a first-class rule. Missing HR, zone time, or Training Load is
omitted rather than converted to zero. Easy Pace compares a latest-four median
with the previous four only when all eight runs exist.

Deliberately absent, and to stay absent: any readiness score, any CTL/ATL or
form dashboard, any predicted finishing time, and any language that coaches.
STACK says what happened and which way it is moving.

## UI-13 — Runs, the fourth pillar

`src/features/runs/RunsScreen.tsx`. Actual run history had no home: a run was
findable through the day it satisfied (Plan), the block it earned (Build), or
not at all. Runs is the chronological record, and per D-044 it is a real
destination rather than a view hanging off one.

**No new store, and no migration.** `RunLog[]` has always been the whole actual
history. `src/domain/runs.ts` joins and sorts it and writes nothing:
`runHistory(plan, runLogs)` returns every run newest first, scheduled and
extra, typed in and synced, each with the workout behind it when there was one.
Ordering is by the date the run actually happened; two runs on one day fall
back to when they were recorded and then to id, so the list cannot reorder
itself between renders. Schema stays at 9.

The screen leads with `N runs` and the total actual miles rather than the word
"Runs", per the UI-7 content-first rule, with a compact `Log Run` beside it.
After UI-16, Runs is the only generic manual-entry location.

**A row is the run.** Activity icon and type, the actual date, distance,
duration and derived pace, and a quiet `Extra` only where no workout was
behind it. The whole row is one button with an accessible name that spells the
same facts out in full. Where a run came from is deliberately not a badge:
source is implementation context, not the identity of a run.

**Detail is the existing detail.** `RunDetailSheet` is `RunResultDetail` with
the date above it and the planned workout or `Extra run` below, the same shape
Build's block detail has. The imported metrics, HR zones and on-demand
interval detail are UI-9's, not a second renderer. UI-13 added one thing to
`RunResultDetail`: when a synced run's elapsed time differs from its moving
time by half a minute or more, both are shown as `Moving` and `Elapsed`.
Closer than that they are the same fact twice and one `Duration` row stands.

**Editing history never edits the plan.** `saveRunLog` keeps the existing
run's `workoutId` whenever it is updating a run rather than creating one. An
edit sheet opened from Runs or Build holds a run, not a workout, and handing
back `null` used to unlink a scheduled run from its day — the run vanished
from the week's completion count and reappeared as an extra one. Deleting
still goes through the existing repository path and repacks the tower, and
deleting a synced run ignores its activity id so the next sync does not offer
it back. Focus moves to the list heading afterwards, because the row the
browser would have returned to has gone with the run.

**Training Signals lives here now** (D-047–D-051). The top of Runs carries a
responsive grid of factual signal cards. Every card is a native button into
its own focused detail. At 360–430px the grid is two columns, at 320px it
becomes one column, and wider layouts use three. Signals with unavailable
required imported data are omitted and the grid reflows.

## UI-16 — Trends 2.0

`src/domain/trends.ts` derives one `TrainingSignals` snapshot from the active
plan, actual run history, and local date. Nothing is persisted and AppState
remains schema 9.

- **Weekly Mileage** uses the latest 12 started plan weeks. Actual miles use
  actual run dates and include extras; planned miles use the midpoint of an
  exact/range target and become unavailable when a scheduled target cannot be
  interpreted. Solid actual columns and dashed plan markers select a week,
  whose run list opens existing run detail.
- **Long Run** compares actual Long Run activity points with scheduled Long Run
  targets and reports latest, longest, prior delta, and next target. Selecting
  an actual point opens that run.
- **Easy Pace** shows actual-date pace points, latest-four versus previous-four
  medians when eight Easy runs exist, and an aligned average-HR graph only for
  the runs that carry HR. Its language is descriptive and keeps terrain and
  weather context explicit.
- **HR Zones** aggregates the latest 28 days only from runs carrying zone data
  and states coverage. `DonutChart` also replaces the former `ZoneBars` in run
  detail. Its SVG is presentational; the ordered text legend is authoritative,
  supports dynamic source zone counts, and retains honest zero-time zones
  without drawing zero-angle arcs.
- **Training Load** uses only the verified imported per-activity metric. Weekly
  gaps remain unavailable, selected-week run values reconcile to the total,
  and no fitness/form/readiness score is derived.
- **Consistency** is a plan-week completion grid. It links only scheduled
  workout ids, so extra runs are context and cannot repair completion.
- **Run Mix** is a latest-28-day donut of actual miles by STACK activity type;
  the legend also carries run count and share, and `Extra` is never an activity
  type.

`src/features/trends/TrainingSignalDetailSheet.tsx` is a shared sheet
controller, not a shared analytics dump. It dispatches to seven dedicated
detail modules. `PlanActualColumns`, `SelectableTrendLine`, and `DonutChart`
are small reusable SVG/CSS primitives with native 44px selector buttons and
complete adjacent text equivalents. No chart dependency, canvas, or WebGL was
added. The retired `TrendsSheet`, `TrendColumns`, `TrendLine`, `TrendSection`,
and `ZoneBars` files are deleted.

## UI-17 — Performance Arcade Design Pass

`src/styles/tokens.css` now owns one small presentation vocabulary for the
phase: the locally bundled Space Mono data stack, instrument surfaces/borders,
technical-grid line, chart actual/reference/selection treatments, and the
ordered seven-zone HR palette. `src/styles/components.css` exposes the opt-in
`.data-value`, `.machine-label`, `.data-module`, and `.technical-grid`
primitives. Body copy, instructions, notes, forms, and ordinary reading text
remain on the system sans stack in `base.css`.

The screen treatment follows D-052 rather than creating a second UI shell:

- **Runs/Training Signals** leads with a four-stat instrument panel and compact
  grid-backed modules. Every visible signal now carries its own factual mini
  visualization through `MiniBars`, `MiniSparkline`, `MiniDonut`, or
  `MiniMatrix`; the adjacent text remains the accessible authority. Confident
  per-signal accents, larger tabular facts, square/block-inspired columns,
  crisp line points, and explicit selected states make Runs the strongest
  expression while run history remains calmer below a matching **Recent Runs**
  section heading. The instrument strip uses four equal full-width cells, with
  a 2x2 fallback at 320px. Signal cards use compact 116px composition at 390px,
  while an odd final card becomes a deliberate 94px horizontal module with its
  visualization centered at the right. Sparse one-to-three-point histories
  consume only factual points and use deliberate block states instead of
  placeholder zero slots.
- **Weekly Mileage detail** is rebuilt around a larger plan-versus-actual chart,
  compact current/average/plan/delta facts, an explicit selection instruction,
  and the selected week's underlying run list.
- **Run Detail** is rebuilt around a date/activity header, three primary result
  facts, a compact secondary imported-metric bank, a larger colored HR-zone
  donut and legend, and a columnar interval list. Schedule context and editing
  remain lower in the sheet, and absent health fields remain omitted. Donut
  legends suppress zero-value segments while preserving original source-zone
  identities, so Zone 2 never becomes Zone 1 merely because Zone 1 is empty.
- **Today** adds a concise machine-date/race line and stronger workout/Run
  Found result hierarchy without adding analytics or changing the daily order.
- **Build** adds a local technical stage grid, stronger block edges, and
  stamped mono mileage while preserving the deterministic eight-column
  geometry, placement behavior, and storage contract exactly. Its centered
  miles-built lead, lower horizon/glow, technical corner brackets, stronger
  piece faces, and compact width-1 mileage stamps make early Builds intentional
  without shrinking the field.
- **Plan** uses machine week/date/status facts and thin workout-color edge
  accents while keeping the schedule rows and body copy restrained. The current
  week chip is angular and today's row uses a quiet edge/background rather than
  a fluorescent selection box. Persistent bottom-nav selection is now an icon,
  label, subtle background, and top rule; keyboard focus remains distinct
  without surrounding the whole cell with a neon rectangle.

Cards, buttons, selected controls, sheets, run rows, and schedule rows use the
approved squarer, more angular shape language. The approved Performance Arcade
mockup is the visual-fidelity acceptance artifact for this revision; it guides
hierarchy, density, data emphasis, and color without importing its source or
assets.

`src/domain/accomplishments.ts` derives two session-only factual moments when a
new run is recorded: **New Longest Run** within the active-plan period (after a
prior run exists), and the highest newly crossed **Miles Built** threshold
(50/100/150/200, then each 100). `AccomplishmentMoment` presents them briefly
and stores nothing. Reloading cannot replay them, edits cannot masquerade as a
new run, and there is no badge collection, score, XP, level, coin, or quest.
Biggest Week and Four Weeks Consistent were not added; UI-17 does not need a
persistent achievement ledger to claim completeness.

UI-17 verification on 2026-08-10:

- the final polish makes `SignalFacts` adapt to one through four facts: phone
  layouts use two columns, a third fact spans the final row, four facts form a
  2x2 grid, and desktop can expand to three or four columns. Values wrap without
  clipping or horizontal overflow;
- HR Zones and Run Mix details now lead with a compact period, chart, and facts;
  redundant coverage/explanatory copy is removed, while incomplete HR coverage
  keeps one concise factual note. The shared instrument close control is neutral
  by default and reserves lime for interaction/focus;
- `npm run check` passes: lint, 51 test files / 793 tests, and the production
  Vite build;
- in-app browser QA passed Today, Runs/Training Signals and Run Mix detail, Run
  Detail, Build, and Plan at 320×844, 390×844, an iPhone-equivalent 393×852,
  and 1200×900;
- every reviewed viewport had `scrollWidth === clientWidth` and no browser
  warning/error output;
- new small label/data contrast measured 7.0:1–17.2:1 on instrument surfaces,
  focus remained visibly distinct, and Training Signal targets measured 116px
  high at 390px;
- all seven zone tokens resolved and labels remain authoritative; reduced
  motion rules remain active;
- no schema migration, router/state-library, canvas/WebGL,
  Race Crew/backend, sound, pixel/CRT/device-shell, or copied external asset was
  added.

## Settings — one place for everything the plan is built from

`src/features/settings/SettingsSheet.tsx`, opened by the gear in the top-right
of the global header.

UI-18 adds an **Account & Crew** row without making accounts mandatory. It opens `src/features/crew/AccountCrewSheet.tsx`, which presents graceful unconfigured state, account create/sign-in/sign-out, display-name editing, crew create/join/leave, and owner invite/member controls. Closing it returns to Settings. Joining a crew whose race differs from the local race requires explicit confirmation and never edits the local race or plan.

Five things were in two wrong places. **Race**, **Run Days**, **Availability**
and **Reset Plan** were a two-column grid of look-alike buttons under eighteen
weeks of schedule — which is where a screen ends, not where settings live — and
**Run Data** was a header button whose label wrapped onto two lines at 390px,
next to a brand lockup that was supposed to be the only thing up there. They
are all settings, and they are all here now.

This is **not a destination** (D-041, D-044). The gear opens a dialog: it is
never `aria-current`, it carries `aria-haspopup="dialog"` and `aria-expanded`,
and it is not in the bar at all, so Today / Build / Runs / Plan are the only
places the app can be. Its visible icon is 20px and its target is 44 x 44,
reusing `IconButton`. Closing the sheet leaves the user on whichever of the
four they were already on — the tab never changed, so there is nothing to
restore.

- Each row states **what that setting is currently set to** — the race and its
  date, the run days (falling back to the shape the plan already has, marked as
  such, while the runner has not said), the Cross Training days (or `None`,
  since most plans want none), the calendar's name and how many days it blocks
  or that it is switched off, and whether Run Data is connected and when it
  last synced. The list answers most of its own questions without being
  opened, and the label and the value are one accessible name.
- Dismissing a sheet opened from here **comes back here**; committing a change
  closes both, because the point of the change is to go and see it. Both paths
  end in the dialog's own `close` event, so which one happened is remembered
  rather than inferred.
- `Run Data` is opened by the shell rather than by this sheet, because Today
  opens the same sheet with a candidate already chosen. The shell remembers
  which one asked, so dismissing it goes back to the right place.

## UI-18 — Race Crew production foundation

`src/crew/` contains the optional cloud boundary. `supabaseClient.ts` reads only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; absent values produce an unavailable controller rather than an app failure. `auth.ts` enforces `/^\d{8}$/` before passing the PIN to Supabase Auth and never persists it in STACK. `invites.ts` generates 32 random bytes, places the raw token in `#join=`, hashes it with SHA-256 for database calls, and clears the fragment after capture. `crewService.ts` wraps the membership/invite RPCs and table reads, while `useRaceCrew.ts` coordinates the authenticated session and stale-aware projection uploads.

`src/crew/projection.ts` is the only local-to-crew projection boundary. A shared run is assembled field by field from local data and contains only local run id, local date, STACK activity type, distance, duration and nullable sanitized Build `row` / `columnStart`; pace and block footprint derive from the approved facts. Placement coordinates are matched by local run id, validated against the eight-column footprint, and included in the projection fingerprint so rearranging a personal block updates its shared position. The member summary derives current-week miles, trailing-28-day longest run, up to four current/prior plan weeks of completed/due consistency, and total miles built. It never spreads or serializes `RunLog` or a complete `blockPlacements` object, so placement timestamps/internal state, external ids, routes, exact start time, heart data, Training Load, effort, notes and source payloads cannot cross this boundary. Projection writes occur after authentication/crew changes, local run or placement changes, and stale open/focus events; there is no polling loop.

`supabase/migrations/20260810212106_race_crew_foundation.sql` creates `profiles`, `crews`, `crew_members`, `crew_invites`, `shared_runs`, and `crew_member_summaries`, enables RLS on every table, and exposes constrained security-definer RPCs for create/invite/preview/redeem/revoke/leave/remove operations. `20260810212506_race_crew_function_grants.sql` removes Supabase's inherited anonymous function grants everywhere except the deliberately public high-entropy invite preview. The database stores only invite hashes. `supabase/tests/0001_race_crew_rls.sql` is a repeatable transactional two-user/two-crew/outsider isolation check for the deployed project, including repeated invite creation preserving the exact `crew_members` set.

Intervals credentials remain outside AppState in `src/storage/intervalsCredentialRepository.ts` under `stack.intervals.api-key.v1`. `src/connected/intervals.ts` supports direct browser calls using `Authorization: Basic base64("API_KEY:<personal key>")`; the existing `/api/intervals` owner proxy remains a separate supported connection mode. The existing normalization, review/match confirmation, dedupe, snapshot and manual fallback paths remain shared by both modes. `RunDataSetup.tsx` implements the Apple Watch/HealthFit and Garmin/COROS/other-device paths from the setup guide.

The only UI-18 production dependency is `@supabase/supabase-js`. No local AppState migration was introduced.

## UI-19 — Crew Runs + Comparisons

`src/features/runs/RunsScreen.tsx` owned an accessible, keyboard-operable `YOU | CREW` tab control that defaulted to `YOU` and swapped only the content inside Runs. **UI-21 removed that control**: Crew is its own destination now, and Runs is the personal summary, Training Signals, Recent Runs, Log Run and private detail again, with nothing social on it. The rest of this section describes behavior that still exists, in Crew.

`src/crew/dashboard.ts` is the Crew read boundary. It first loads current `crew_members`, resolves only `profiles.display_name`, then reads the existing `crew_member_summaries` columns and a generously bounded set of newest `shared_runs`, ordered by local date and creation time newest first. UI-20 allows up to 128 shared blocks per member (maximum 1,280 rows for the private ten-person crew) so a normal full training-cycle Build is not silently reduced to a recent sample. The shared-run select remains limited to id/user/date/activity/distance/duration/sanitized placement plus row and Crew-placement timestamps. It defensively drops any row dated before the Crew's `build_start_date`; `joined_at` remains membership history/order only. No personal `RunLog`, Intervals id/source, exact start time, HR/zones/load, effort, note, route or plan detail is requested or mapped.

`useRaceCrew` keeps this dashboard independent from personal AppState. Entering Crew performs a stale-aware read, a manual Refresh forces one, foreground refresh is allowed after five minutes, and no polling or Realtime subscription exists. Account/roster refreshes are serialized around explicit mutations: an invite reload is pinned to the Crew that created it, and a foreground request started before that mutation cannot replace its post-mutation roster. Projection updates invalidate the local Crew read cache so a later Crew entry can show the runner's newly projected work. Membership removal and display-name changes force a safe refresh.

`src/features/crew/CrewScreen.tsx` (UI-19's `CrewRunsView.tsx`, moved and re-led in UI-21) renders a quiet crew/race identity surface and makes the approved Weekly Miles, Longest Run, Consistency and Miles Built comparison the primary visual object. A keyboard-operable four-option metric control replaces the native select. Every row keeps its numeric fact visible beside an honest proportional bar; consistency stays on its natural 0–100 scale and Miles Built uses a restrained segmented strip. Equal values retain membership order rather than inventing tie-breakers. Consistency shows percentage plus completed/due, while zero due is the neutral `—`. Stable hashed member colors are identity cues only; the current account receives a quiet `YOU` marker and lime edge rather than a podium treatment. Normal freshness timestamps are hidden and stale projections use a relative label. One-member, signed-out, no-crew, unavailable and no-shared-run states are intentional.

`CrewRunRow.tsx` and `CrewRunDetailSheet.tsx` consume only `CrewSharedRun`. Pace is derived from shared distance/duration. Member markers strengthen identity and the existing STACK activity icon/color remains the semantic run-type cue. Even the current runner's row opens the same crew-safe detail, with no edit/delete/private-data actions. `ActivityTypePicker.tsx` is the reusable icon-card control used by manual/edit run entry and extra imported-run confirmation; imported scheduled matches still take the linked planned type, and unscheduled imports still default to Easy. UI-20 reactions, comments, member profiles and mini Builds remain deferred.

UI-19 introduced no database migration, AppState migration, router, global state, Realtime subscription or new production dependency. UI-21 later added only the Crew-placement database migration/RPC; the other boundaries remain.

## UI-20 — Props + Mini Builds

`supabase/migrations/20260810230000_crew_reactions.sql` adds one narrow `crew_reactions` table with primary key `(shared_run_id, user_id)`. The table contains only crew, shared-run, member and creation-time relationships. A composite foreign key prevents attaching a reaction to a run in another crew. RLS limits reads to active members, inserts to the authenticated member's own id and a teammate's run, and deletes to the member's own Prop. Leaving or removal cleans Props the former member gave; run deletion cascades reactions attached to that run. `supabase/tests/0002_crew_reactions_rls.sql` transactionally covers member add/read/remove, duplicate rejection, self-Prop denial, another member's delete denial, outsider denial and removal cleanup.

`src/crew/reactions.ts` owns the idempotent reaction upsert/delete and optimistic state transition. `useRaceCrew` prevents concurrent mutations for the same run, changes the button/count immediately, rolls only that run back on failure and leaves the chronological run array in place. Dashboard refresh remains stale/manual with no polling or Realtime. Reaction read failure leaves shared runs visible with Props unavailable; shared-run failure leaves comparisons intact and renders explicit Recent/Mini Build unavailable states.

`supabase/migrations/20260811090000_shared_run_build_placement.sql` is a new forward-only migration that adds nullable, constrained `build_row` and `build_column_start` columns to `shared_runs`. It does not alter the previously applied Props migration or any RLS policy. Existing rows remain valid and unplaced until the owning runner projects a placement. `supabase/tests/0003_shared_run_build_placement_rls.sql` checks nullable legacy rows, coordinate constraints, owner-only mutation, active-member reads and anonymous denial.

`src/crew/dashboard.ts` makes one generously bounded shared-run read. Its newest 20 rows remain the Recent Runs pool while all available placed rows feed Member Builds. One crew-scoped reaction read covers those runs; there are no per-run or per-member queries.

`src/crew/miniBuild.ts` is the sanitized social Build boundary. Its input contains only shared-run id, member id, local date, STACK activity type, distance and nullable row/column. Width derives from distance and height/color from activity type. Supplied coordinates are preserved exactly; legacy/missing/invalid coordinates are omitted rather than silently auto-arranged. The generous 128-block safety ceiling covers a normal training cycle without uploading complete personal placement objects.

`CrewMiniBuild.tsx` renders exact shared coordinates as a decorative, aria-hidden SVG. Each keyboard-focusable card opens `CrewMemberBuildSheet.tsx`, a read-only eight-column stage using the same coordinate/footprint model; each block opens the existing crew-safe Run Detail. Activity type controls lime/blue/yellow/purple/white block color, while the stable member accent remains identity only. `THE CREW` stays a compact horizontal rail and members with zero placed runs remain visible. Aggregate Miles Built uses one decimal on personal Build, comparisons, cards and Member Build.

`PropsButton.tsx` uses Lucide `ThumbsUp` plus `PROPS`/`PROPPED`, a 44px target and `aria-pressed`. The Props action is a sibling of the main Run Detail control inside the same compact visual card; it no longer creates a footer row and never nests interactive controls. Self-Props remain non-interactive and show only a quiet nonzero count. Reaction failure never presents zero as factual: Run Detail reports `Props unavailable` while all other safe run facts remain usable. Counts never affect feed or comparison order.

UI-20 adds no AppState migration or production dependency. Personal placement data, complete `RunLog` objects, Intervals ids/credentials, exact start times, routes, HR/zones/load, effort and notes remain outside the UI-20 query and rendering contracts.

The owner applied the Props migration and its deployed transactional RLS verification passed on 2026-08-11; that applied migration was not modified. The final polish repository check passes: lint, 67 test files / 882 tests, TypeScript and production build. The new placement migration is ready but still requires separate owner application and deployed verification. UI-20 remains in review until 320/390/desktop/iPhone Safari visual QA is accepted.

UI-20 still does not add a combined Crew Build, communal placement logic, fifth Crew navigation destination, comments, notifications, profiles, ranking, Realtime or full AppState sync.

## UI-21 — Crew destination + shared Crew Build

The whole-product review after UI-20 found that Race Crew had become more than "Runs with friends": STACK's defining mechanic is BUILD, and a crew that builds one tower together owns something no other screen does. UI-21 authorizes Crew as a **conditional fifth destination** on that basis (D-065). The owner correction in D-066 replaces automatic arrangement with runner-owned placement.

### Three Build models, deliberately distinct

| Model | Arrangement | Who arranges it | Coordinates |
| --- | --- | --- | --- |
| **Personal Build** | manual, private | the runner | local personal placement |
| **Member Build** | read-only reproduction of safe shared personal placement | the runner, reproduced | `build_row` / `build_column_start` |
| **Crew Build** | communal, placed deliberately | each runner for their own earned blocks | `crew_build_row` / `crew_build_column_start` |

The coordinate pairs are independent. Dashboard reads preserve both for their separate consumers; projection writes do not copy or reset Crew placement when personal placement changes.

### Persistence and authorization

`20260811150000_crew_build_placement.sql` adds nullable Crew coordinates and the authenticated `place_crew_build_block` RPC. The RPC verifies run ownership and active membership, locks the Crew placement transaction, derives the block footprint from safe run facts, rejects out-of-grid or overlapping rectangles, and updates only the two Crew coordinates. Direct authenticated updates to those coordinates are not granted. The same transaction supports initial placement and movement while excluding the moving run's old rectangle.

`src/crew/projection.ts` mirrors Crew's own storage rules before uploading, because the projection is a single `upsert` and one refused row fails every run in it, for every crew, on every retry — while personal STACK, which saves runs one at a time, stays healthy and hides the cause. Nullable columns pass through `crewSafeHeartRate`, `crewSafePercent` or `crewSafeNonNegative` and become `null` rather than failing the batch; `isShareableWithCrew` leaves a run that violates a NOT NULL or CHECK column out of the batch entirely. `syncCrewProjection` returns a `CrewProjectionOutcome` naming how many runs were left behind, which `useRaceCrew` surfaces, so a contribution that is not arriving is stated rather than discovered. `upsertSharedRuns` falls back to one upsert per run when a batch fails anyway, bounding a constraint this code has not learned about to the rows actually at fault. See `docs/CREW_PROJECTION_CONTRACT.md` and D-082.

`src/crew/crewBuildPlacement.ts` is the narrow client boundary. `useRaceCrew.ts` owns pending/error state and refreshes after success or server conflict. A specific collision keeps the block READY or in its prior position and reports: `That space was just taken. Choose another spot.`

`20260820150000_crew_build_canonical_occupancy.sql` makes that collision check mean the same thing as the tower on screen. `crew_build_items()` returns only rectangles the client would draw — a run inside its Crew's Build window, both coordinates present, and the whole footprint inside the eight columns rather than just the anchor — and `canonicalize_crew_build()` writes that definition back to storage: non-renderable coordinates return to READY, an overlap is resolved in the client's own acceptance order (runs by earned date, then awards by week), and whatever is left floating settles through the mixed support repair. Both placement RPCs canonicalize under the Crew advisory lock they already hold, immediately before they validate, so a landing the client offered can only be refused by a block a refresh will actually show. `heal_crew_build_support()` delegates to the same pass, which also retires its runs-only view of support — that view demoted any run resting on a Special Block. Healing only ever demotes; nothing is relocated and no contribution is deleted. `supabase/tests/0023_crew_build_canonical_occupancy.sql` is the standing coverage.

### READY and placement interaction

`src/crew/crewBuild.ts` preserves valid stored Crew coordinates and never invents them. Unplaced, invalid, colliding, or structurally unsupported rows enter READY order by `localDate`, `createdAt`, then id. Width still derives from distance; height and activity color still derive from activity type. Geometry helpers power snapped placement options and client-side overlap checks.

`CrewBuild.tsx` shows literal `placedMiles`: the sum of blocks physically present in the communal tower. READY mileage is never called built. Generic run/runner/built/READY accounting is absent from the hero; the current runner alone sees `1 BLOCK READY · PLACE BLOCK` or `N BLOCKS READY · BUILD NOW`. Teammate READY items are not promoted because the viewer cannot act on them.

Placement mode focuses the stage, shows a snapped preview, rejects invalid or colliding cells before confirmation, and offers `Next Open Spot`, Confirm, and Cancel. No server write happens before Confirm. Only the owner's placed block exposes a quiet `Move Block` action from the tower and crew-safe Run Detail. Every placed block remains one accessible detail target. `crew_build_placed_at` records successful placement and movement; blocks changed in the last 24 hours receive a restrained top-edge/glow treatment and “newly placed” in the accessible label. Existing null timestamps render normally.

The eight-column stage shows at least six courses when empty or shallow, grows with tower depth until a phone-height cap, then scrolls internally with the newest/top courses accessible. Stronger top/side/depth cues keep the object physical without gradients or new rendering libraries.

### Bounded reads, navigation, and unchanged surfaces

The existing bounded dashboard payload still feeds the Crew Build, comparisons, Recent Crew Runs, Props, and Member Builds without an N+1 query. Miles Built comparison is derived per runner from physically placed Crew blocks; Member Build continues to reproduce sanitized Personal Build placement and is unchanged. Truncation, no-run, READY-only, unavailable, and one-member states remain explicit and factual. Removing a member deletes their placed and READY rows; remaining coordinates do not reflow.

Crew remains conditional. When the session or active membership disappears while Crew is selected, `App.tsx` performs the fallback to Runs in an effect rather than setting state during render. No router is introduced. The UI-19 comparison and UI-20 social surfaces remain visually secondary and behaviorally unchanged. Refresh stays stale-aware entry, foreground, manual, and post-placement only; there is no polling or Realtime.

UI-21 adds a database migration and RPC, but no AppState migration, router, global state library, Realtime subscription, new production dependency, pace leaderboard, ranking, podium, comments, notifications, or profiles. On 2026-08-11 the owner confirmed the deployed migration/RLS verification, two-account placement and permission QA, and 320px/390px/desktop/real iPhone Safari acceptance all passed. PR #38 is merged.

## UI-22 — final product polish + onboarding

UI-22 is a whole-product consistency pass, not a new feature phase. The persistent destinations and all personal/social data boundaries remain unchanged.

### Runs and interaction hierarchy

`RunsScreen` keeps an accessible visually hidden page heading, but no longer spends the first mobile viewport on a decorative `RUNS` title. A compact summary of run count, total miles and active weeks now shares the entry row with the existing Log Run action; Training Signals and Recent Runs remain the primary content below it.

Sheets now focus their title when opened instead of applying the focus ring to Close. Their top-right close control uses one neutral 44px treatment across settings, setup, run detail and editing flows. Settings is grouped by Training, Run Data, Account & Crew and App so ownership follows the product model rather than the order features were implemented.

### Selector taxonomy

The current control rules are explicit:

- use a segmented or button group for a small finite choice that benefits from seeing every option, including activity type, effort and Crew comparison metric;
- use `StackSelect`, a styled native select, for a longer list such as matching an imported run to a planned workout;
- use native date inputs for dates and the existing specialized calendar interaction for availability;
- never create a one-off native select for activity type or effort.

`ActivityTypePicker` is shared by manual completion, imported-extra review and planned-workout editing. `EffortPicker` is shared by manual and imported run review. The raw `<select>` element is owned only by `StackSelect`.

### Copy, formatting and freshness

Steady-state Build and Crew screens no longer repeat placement instructions when nothing is being placed. Empty states explain the next useful action once. Run Data still explains the Apple Watch → Apple Health → HealthFit → Intervals.icu → STACK path and privacy boundary, but setup steps use direct product language rather than implementation narration.

Shared domain formatters own miles, duration, pace and relative update age. Display pace uses uppercase `/MI`; connected-data and Crew freshness is hidden while normal and becomes relative only when it is useful. Imported-run dates use the same human-readable labels as the rest of the app rather than raw ISO dates.

### Local onboarding

`src/storage/onboardingRepository.ts` owns best-effort device-local `stack.onboarding.v1` preferences separately from AppState schema 9. A genuinely new install receives a brief welcome followed by the conceptual loop Plan → Run → Build → Today. The non-modal coachmark preserves access to the app, supports Escape/Skip and persists completion; an interrupted first tour resumes from Plan on the next launch. Settings → App Tour replays it.

Existing stored AppState is migrated quietly to completed onboarding so UI-22 never forces a legacy runner through an introduction. Existing crew members are also marked as having seen the Crew explanation. A genuinely new runner sees the one-time Crew explanation only after becoming eligible for Crew and opening that destination.

### Crew owner lifecycle

`AccountCrewSheet.tsx` now completes the existing owner model with owner-only Edit Crew and Delete Crew actions. Edit reuses the Crew-creation fields and validation for Crew name, race name, race date and positive distance. `crewService.updateCrew` performs a narrow direct update on the selected `crews` row; existing RLS returns a row only for its owner. The controller reloads account/dashboard metadata so Crew identity and countdown update without a page reload. Crew race metadata remains independent from every member's local race and training plan.

Delete lives in a restrained danger area and opens an explicit confirmation view. `crewService.deleteCrew` deletes only the selected `crews` row after owner RLS approval. Existing foreign keys cascade `crew_members`, `crew_invites`, `shared_runs`, `crew_member_summaries` and `crew_reactions`; Auth users, profiles and device-local personal STACK data are not deleted. After success the controller keeps the session signed in, reloads to `crew: null`, clears invite/dashboard/Props/placement state, and the existing App effect removes Crew navigation and falls back to Runs. Foreground and dashboard-error refreshes also reload membership so another member resolves a remotely deleted Crew without polling or Realtime.

`supabase/tests/0005_crew_owner_management_rls.sql` is repeatable verification for owner update/delete, member and outsider denial, cascade cleanup, and Auth/profile survival. No migration is required.

### Plan lifecycle semantics

`currentWeekNumber()` still clamps to Week 1 before training and the final week after the race because Plan navigation should remain useful for preview. That clamped selection is not lifecycle truth. `selectPlanWeekViewModel().isCurrentWeek` is true only while `today` is inside that week's actual dates and not after race day.

`TodayScreen` derives an explicit active-plan state from `rest`, `run` or `completed` and renders `ThisWeekStrip` only for those kinds. Before training it shows Plan Starts Soon, the exact start date, the next scheduled run when one exists, and any real extra-run Build progress without activating Week 1. After the race it shows Race Complete with no final-week `This Week` or fake next workout. Plan still opens the boundary week, labeled `Preview` before start and `Plan complete` after race rather than `This week`.

UI-22 adds no production dependency, router, global state, database migration or AppState migration. It is the final currently planned product phase.

## Focused Crew polish + Training Signals availability (post-UI-22)

This correction is not UI-23. `crews.build_start_date` is the authoritative shared contribution boundary for all members. Projection upserts only runs whose `completedDate` is on or after that date; same-day and later-imported in-window runs count, while join time, plan linkage, import time and local creation time do not. `joined_at` remains membership history/order/audit only. Ordinary device absence remains non-destructive.

Create Crew exposes `Build starts`, defaulted to today, and Settings shows the date quietly. Owner editing validates it on or before race day. Moving it later shows an explicit personal-data-safe confirmation, then the owner-only `update_crew` RPC atomically updates metadata/date, removes pre-window contributions for all members, cascades Props, and recursively demotes unsupported surviving blocks to READY without relocation. Moving it earlier removes and invents nothing; the date-bearing projection fingerprint causes each member's next normal projection to add eligible local history. `shared_runs` write policies reject pre-window member uploads, direct Crew table updates cannot bypass cleanup, and dashboard reads defensively apply the same Crew date.

The Crew header is now one crew-name line and one compact race/countdown line before the Build. Comparison is a lighter non-grid section with four equal-width, icon-only, keyboard-operable tabs in one row; its heading states the active metric. Today may reuse the loaded/stale-aware Crew dashboard to show at most two teammate runs from today/yesterday, with the existing optimistic Props handler. It renders no section when nothing qualifies and shares no additional fields.

Actual-data Training Signals—Weekly Mileage, Long Run, Easy Pace, HR Zones, Training Load and Run Mix—derive from actual RunLogs through today even before plan start or after plan end. Weekly Mileage and Training Load use trailing Monday–Sunday calendar weeks and attach a planned overlay only where a real plan week matches; no planned zero is invented. Consistency, planned long-run progression and next planned target retain plan-dependent semantics. On phones the existing cards form one overflow-x row with a visible next-card peek; desktop retains the multi-column grid and card/detail designs.

## Hotfix — Crew cross-device data integrity

`src/crew/projection.ts` is now additive/update-only. It no longer compares the
current browser's run ids with all server ids and never deletes a server row
because it is absent locally. Upserts keep the unique
`crew_id + user_id + local_run_id` row identity; omitted personal placement uses
PostgREST `defaultToNull: false`, so a secondary device cannot clear Member
Build coordinates. Crew Build coordinates remain absent from the payload and
RPC-only, preserving placements and Props on the same shared row.

The projection reads the runner's safe cloud run union after upsert and derives
Weekly Miles, trailing-28-day Longest Run and Miles Built from it. Consistency
updates only when this device contains every shared run and has local history;
otherwise the last server value is preserved. A blank device therefore cannot
publish misleading zeroes, while time-window metrics can still decrease
legitimately as dates move.

Explicit run deletion is wired from `App.tsx` after the personal repository has
saved the deletion. `deleteCrewRunProjection` targets one crew/user/local-run
tuple. `src/storage/crewDeleteTombstoneRepository.ts` stores failed cleanup
intent separately at `stack.crew-delete-tombstones.v1` and removes it after an
idempotent retry succeeds. Ordinary absence never creates a tombstone.

`20260811200000_crew_integrity_support.sql` replaces the Crew placement RPC
without editing the applied UI-21 migration. The existing Crew advisory lock,
ownership, membership, bounds and collision checks remain. The transaction now
also requires ground or valid support under a new block and verifies that a
move leaves every other block supported. Its bridge rule matches Personal
Build gravity: one highest supporting footprint may carry a wider block across
intentional voids. The client mirrors these checks for preview only; the server
remains authoritative.

Intervals status now says `Connected on this device`. The import audit and a
regression test document that same-day extra-run ordering can give the same
Intervals activity different local ids across devices. Canonicalizing existing
Crew identity without recreating rows/Props/placements requires a separate
forward migration and is not attempted here. Personal AppState, plan, runs,
Build, onboarding and Intervals credentials remain device-local.

## Hotfix — Run Data review persistence and plan matching

Two bugs in the same feature, fixed together because a user meets them
together (issues #41 and #40). No AppState migration, no Supabase migration and
no Crew change: `AppState.schemaVersion` is still 9.

**A read is not the review queue.** `useConnectedSync` used to hand
`setCandidates` whatever the latest network window returned, so the rolling
14-day sync silently replaced everything the first 90-day read had found. A run
discovered on day one and left unreviewed was gone on day two — still in
Intervals, not imported, not ignored, not dismissed, and unrecoverable short of
a fresh connection.

`src/storage/intervalsPendingRepository.ts` now holds the unresolved queue at
`stack.intervals.pending.v1`, outside AppState: normalized `IntervalsCandidate`
snapshots only, no raw responses and no credential. A successful read merges
into it by `externalId` (`mergeCandidates`), where the newest network snapshot
refreshes an existing row in place rather than adding a second one, and
`unresolvedCandidates` then removes anything imported, attached or ignored. The
queue is loaded and filtered the same way when the hook initializes, so a
settled activity is never resurrected even from a stale file. `settle` removes
from storage as well as from state; `dismiss` stays session-only and
deliberately leaves the entry where it is. An explicit Forget Connection clears
the slot from `App.tsx`, because the next key entered on this device may be a
different runner's; setting up a personal API key over the legacy proxy does
not, because that is the same runner on the same device.

Run Data offers **Find Older Runs**, which performs the 90-day first-connection
read regardless of the last successful sync and merges the result. It exists
for devices that already lost candidates to the old behavior. It imports
nothing, clears no ignored ids and resets no sync history; ordinary Sync Now
keeps the rolling window. Today is unchanged: `RUN_FOUND_WITHIN_DAYS` still
limits it to one recent run, and older ones stay in Settings → Run Data.

Storage failure is honest rather than fatal. An unreadable queue loads as
empty; a failed write leaves the session fully usable and says the runs waiting
to be reviewed could not be saved, instead of implying a durability that is not
there. A failed write during `settle` is quiet, because the load filter settles
the activity again from the run log or the ignored list regardless.

**Suggestion is not eligibility.** `suggestScheduledMatches` keeps its narrow
±2-day job: it is what STACK proposes by itself, the Run Found card's match and
the review sheet's default selection. It was also the entire contents of the
Match dropdown, which meant a run whose real workout had moved further than two
days could not be matched at all. `availableScheduledMatches` is the manual
choice set — every non-rest workout in the active plan not already linked to
another RunLog, ordered by absolute distance from the actual run date, then
planned date, then workout id. The dropdown renders `Add as Extra Run`, a
`Suggested` optgroup and an `Other plan runs` optgroup, with no workout in
both. A workout another run already satisfies is in neither list: one scheduled
workout still links to at most one RunLog. Choosing a workout takes its planned
type and never touches `candidate.completedDate` — the run happened when it
happened, and the sheet keeps stating both dates when they differ.

`VERIFIED_RUNNING_TYPES` is unchanged. `Run` is still the only Intervals
running type any fixture, captured payload or document in this repository
contains, so no alias was invented; the allowlist and its rejections are now
covered by explicit tests rather than being invisible behavior.

`PlanScreen` keeps what is about the training rather than the setup: the week,
the blocked-day banner and its review, run entry and the plan edits, and one
quiet `Training Trends` action at the foot. It no longer takes `onResetPlan`,
`onSaveAvailability`, `onGeneratePlan`, `onSaveRunDays`, `raceSetup`, `runDays`
or `blockPlacements`; `availability` stays, read-only, because marking the days
it rules out is still Plan's job.

The header is now the brand lockup and nothing else, which is what UI-7
designed it to be before the Run Data button was added beside it.

## Choosing when the plan starts

`RacePlanSetup.startDate` is optional (D-042). Absent means "derive it from the
race", which is what every plan built before this field existed did and what
every stored setup already means — so this needed no schema migration and
`AppState.schemaVersion` is still 9.

- `plannedWeeks` and `planStartDate` both take the chosen date and take it at
  its word, over and under the template's range. The template is a suggestion
  about how long a plan wants to be; the runner saying when they start is a
  fact about their life.
- A chosen date is snapped back to **its Monday**, because training weeks run
  Monday to Sunday and a plan beginning on a Wednesday would have a first week
  that was not a week. The sheet says which Monday when they differ.
- A start **before today** is allowed and worth allowing: somebody already six
  weeks into training wants the weeks to line up with what they have done. The
  sheet says the first weeks are already behind you.
- A start **after race week** is refused in the sheet and in
  `generateTrainingPlan`, because there would be no race in the plan.
- The field is prefilled with the suggestion and keeps following the distance
  and the race date until the runner changes it, at which point it stops moving
  under them. `Use the suggested start` gives it back.

## Two things the polish pass fixed on the way

**The Run Data sheet was the only screen with unstyled native controls.** Its
token input, its three selects and its notes field carried no class, so on a
dark panel the token box rendered as a light-grey system input. They use
`.run-input` like every other field in the app now, the pile of ghost buttons
became one quiet row per group, and the sheet is written out rather than packed
onto single lines.

**One control was under the 44px floor.** Today's `Retry`, on the line a failed
sync leaves behind, measured 14px: it only appears when a sync has failed, which
is why UI-7's sweep never saw it. The type stays 12px and the target grew around
it. Every interactive control on every screen and in every sheet — including the
new ones — measures at least 44px at 320 and 390px, and nothing scrolls
sideways at 320.

**A 200 that is not JSON reached the phone as `Unexpected token '<'`.** That is
what a static host answers when `/api/intervals` is not deployed — it rewrites
the unknown path to the app's own HTML — and it is the same failure the 404
branch already explains in words. `src/connected/intervals.ts` now says the same
thing for both: this deployment has no reader, redeploy so the function ships.

## Tests added by the settings and start-date pass

616 tests pass.

- `src/features/settings/Settings.test.tsx` — the rows and the values they
  state, a calendar that is off saying so rather than counting days, Run Data
  handing off to the shell, one sheet on screen at a time, coming back to
  settings when a sheet is dismissed and not when a change is committed, the
  two-step reset, and the bottom-bar control that is deliberately not a tab.
- `src/domain/racePlan.test.ts` — a chosen start honoured above and below the
  template's range, snapping to Monday, a plan that begins before today and
  still holds one workout per date, and a start after race week refused.
- `src/features/plan/RaceSetup.test.tsx` — the suggestion following the race
  until it is changed and then holding still, the Monday a mid-week start
  really begins on, the refusal, and getting the suggestion back.
- `src/connected/intervals.test.ts` — a 200 of HTML reported as a missing
  reader rather than as a parser error.
- The Race, Run Days, Availability and reset tests now drive the Settings sheet
  through `src/test/OpenSettings.tsx`, which holds the open state the shell
  holds. Availability's blocked-day and conflict-review tests still drive
  `PlanScreen`, because that half of the feature did not move.

## Several crews at once, and a crew's own emblem (post-UI-22)

This is D-072, not UI-23. `crew_members` was already many-to-many, so nothing
about membership storage changed; what changed is that the client stopped
reading one row and started reading the list.

`crewService.loadCrewAccount(client, user, preferredCrewId?)` now returns every
membership, oldest first, alongside the one being viewed. It reads all of the
account's crews in a single `in` query and, in `loadCrewDirectory`, all of their
rosters and profiles in two more, so a runner in four crews still costs the same
five reads as a runner in one. The viewed crew is the preferred id when it is
still a membership and the oldest membership otherwise, which is what makes a
left, removed or deleted crew resolve quietly rather than error. That directory
read also returns `takenAccentColors`, the union of crewmate colors across every
crew the account is in, because the `profiles` uniqueness trigger enforces that
same union — a picker that knew only the visible roster would have offered
colors the database was about to reject.

`src/storage/activeCrewRepository.ts` holds the viewed crew per account under
`stack.crew.active.v1`. It is a device preference, so every read and write is
best-effort; losing it opens the oldest membership. Two runners sharing a
browser profile keep separate entries.

`useRaceCrew.ts` keeps projection freshness in a per-crew map and syncs to every
membership in turn, each against that crew's own `build_start_date`. One crew's
failure is reported without stopping the others, and standing in one crew never
starves the rest of contributions. `deleteRunContribution` writes one tombstone
per crew and withdraws the run from all of them; as before, a tombstone is
retired only by a completed projection sync, because that sync is what proves
the smaller local view is authoritative. `switchCrew(crewId)` refuses a crew the
account is not in, remembers the choice, clears crew-scoped client state and
reloads. The dashboard in-flight guard is now keyed by crew id, so switching
crews can no longer be answered with the previous crew's load. A forced
refresh is a read barrier rather than another read: it waits out any request
that was already running — that request may have queried before the write — and
then issues its own, so a placement is confirmed against the Crew as it is now.
A read that fails proves nothing either way and is reported as a dashboard
error rather than as a rejected placement.

Projection still refuses to publish until this device owns the account's
canonical personal cache, but the refusal is now visible and recoverable.
`projectionWaitingForPersonal` says so on the Crew screen and in Account &
Crew, and `notePersonalSyncReady()` — called by `App.tsx` when
`usePersonalSync` reports the account initialized — forces the projection that
join time could not safely publish, then re-reads the crew. Existing eligible
runs therefore become READY Crew blocks as soon as the handoff completes,
instead of waiting for an unrelated later focus or edit.

`src/crew/emblem.ts` owns crew emblems. See "The three-layer Crew Emblem"
below for the current model; the four-part `E1-…` library this section
originally described was replaced outright.

Crew shows a switcher rail only when there is more than one crew to switch
between, and the viewed crew's emblem now stands beside its name. Account & Crew
lists every crew with its emblem, role and race, marks the one being viewed, and
offers Create Another Crew — an addition, never a replacement, so creating or
joining one crew leaves the others alone. The invite preview shows the inviting
crew's emblem and says plainly when the viewer is already a member.

`supabase/migrations/20260812210000_multi_crew_and_emblem.sql` adds
`crews.emblem` with a check pattern matching the code format, carries the emblem
through `create_crew` and `update_crew` (both re-created with the new trailing
defaulted parameter), and extends `preview_crew_invite` with the emblem and an
`already_member` flag. Build-start behavior, Crew Build placement, RLS and the
safe projection contract are unchanged, and no personal AppState migration was
introduced.

## UI-23 — Run Detail 2.0

Personal Run Detail (`src/features/runs/RunDetailSheet.tsx`, still built on the
shared `RunResultDetail` also used by Build's block detail) is reworked around
richer activity analysis and a cleaner mobile hierarchy. Crew-safe run detail
(`CrewRunDetailSheet.tsx`) is untouched — this phase is personal-only, and the
Crew-safe projection boundary carries no new field.

The August 13 real-device review against a HealthFit → Intervals activity
corrected several things the first pass got wrong; `docs/CONNECTED_DATA_FIELDS.md`
records the readings, and D-073 records the rule they established.

**Header and status are metadata again, not a section.** The old standalone
`Extra Run`/`Scheduled workout` heading-and-paragraph block is gone.
`run-detail__context` now carries the date and, when the run satisfied a
workout, one concise `Week N · Title` line, plus two small tags next to the
activity type: `Plan` for a linked scheduled run, `Extra` for one the plan
never asked for.

**Secondary metrics fit mobile, two by two.** `Elevation gain`/`Training Load`
are shortened to `Gain`/`Load`, and the grid stays two columns for the whole
phone range, widening only at 700px. Three across with a stranded fourth
underneath read as a layout accident. `Gain` remains the imported Intervals
aggregate: on the August 13 run Intervals reports 115 ft of Climbing and STACK
shows 116, while the altitude series only spans about 41 ft — three different
questions, and recomputing gain from the stream would produce a number
agreeing with nothing the runner can check.

**Streams give shape; aggregates give numbers.** This is the rule the review
established and the one the whole Run Profile hangs on. `RunProfileChart`
never derives a summary statistic:

- **Pace** states the run's own `RunLog` pace (10:59 /mi, against Intervals'
  10:58 and HealthFit's 11:00). It does not state a mean of instantaneous
  samples, and it never presents the fastest or slowest single sample as a
  best or worst — those had been showing as 6:07 and 53:32 for a run that was
  neither.
- **Heart Rate** states the imported `average_heartrate` and `max_heartrate`
  (153 and 174).
- **Elevation** states the series' own low and high (72 ft, 113 ft), which
  genuinely are properties of the series. Total gain stays in the grid above.
- **Cadence** states the imported `average_cadence` verbatim.

**Cadence is no longer hidden.** Five phases of withholding it ended when the
August 13 activity established what the source actually reports: 79, matching
Intervals' own display and its interval rows of 79 / 79 / 80. STACK shows 79.
It does not double the figure into a steps-per-minute reading and prints no
unit beside it, because the number and its agreement with Intervals are the
only source-verified facts. Cadence lives in Run Profile, which keeps the
summary grid at a clean four; a run whose stream carried no cadence but whose
imported average exists shows it in the grid instead, spanning the row rather
than stranding a fifth cell.

**Run Profile** (`src/components/charts/RunProfileChart.tsx`) is one chart
area with selectors — `Pace`, `Heart Rate`, `Elevation`, `Cadence` — that
appear only for metrics the fetched data actually contains, never as a fixed
set of buttons. An `0:00 → duration` axis gives elapsed-time context. Two
display rules matter:

- **Gaps are preserved.** A time position whose value is missing breaks the
  line instead of joining its neighbours, so a stream that stopped recording
  is never drawn as though it kept going. A zero cadence or a near-stopped
  velocity is treated as absent for the same reason — the runner was stopped,
  not measured at zero.
- **The pace axis is robust, and the data is not touched.** A few near-stops
  were flattening the useful majority of the series into a flat line. The
  visible y-domain now comes from Tukey IQR fences, and outlying samples are
  clamped to the edge of that window for drawing only. No sample is dropped,
  rewritten, or excluded from anything else. A fixed high percentile was tried
  first and rejected: on a short series it interpolates straight back into the
  outlier it was meant to exclude.

The data comes from `fetchIntervalsRunProfile` in `src/connected/intervals.ts`,
a second on-demand Intervals read alongside the existing `?intervals=true`
detail read — both fire once, when a synced run's detail sheet opens, never
during ordinary sync, and neither is persisted past the open sheet's component
state. The per-sample stream *shapes* remain `Expected` rather than `Verified`:
the review confirmed the aggregates STACK states, not the streams payload, and
this repository has no network path to check it. `normalizeIntervalsRunProfile`
resolves an unrecognized shape to `null`, so Run Detail renders no Run Profile
section — exactly what a run without profile data looks like. Because no
stated number depends on a stream, an unverified shape can cost a chart but
cannot produce a wrong figure.

**Heart-rate zones are the donut, without a legend beside it.** `DonutChart`
gained an `interactive` mode rather than a second donut implementation, so the
behaviour stays available to Training Signals' HR Zones. Each arc carries a
44px hit target, the ring opens on the dominant zone, and the centre reports
that zone's share, name and time (`26%` / `ZONE 3` / `7:43`); tapping or
keyboard-activating another arc moves the centre to it. Selection is weight
and a soft glow, never a colour change, so the zone palette keeps its meaning.
The six-row visible legend is gone — the ordered list stays in the document as
`visually-hidden`, so a screen reader still gets the complete composition and
the visible legend is not what made the chart accessible.

**`View intervals` is gone.** The explicit button and its
"No understandable interval groups were found" empty state are replaced by the
same on-demand `fetchIntervalsActivityDetail` call firing automatically when
the sheet opens (still never during sync): a source-verified structured
`Intervals` section appears only when `icu_intervals` actually produced rows,
and nothing is shown for an ordinary run with none. A genuine fetch failure
still surfaces a concise error with a `Retry` action.

**`Connect to Plan` is a compact action.** The always-visible inline
select-and-link form is gone from Run Detail; a `Connect to Plan` button
(shown only when the run is unlinked and a candidate workout exists) opens
`src/features/runs/ConnectToPlanSheet.tsx`, a small picker sub-sheet using the
same `availableWorkoutsForRunLog` candidate logic Run Detail used inline.
`RunsScreen` orchestrates the hand-off the same way `PlanScreen` hands off
from a workout's detail sheet to its edit/move sheets — only one `<dialog>`
is ever open, and confirming or cancelling the picker returns to the run's
own detail. `Unlink from Plan` remains inline and visually secondary.

No Supabase migration, no new dependency, and no change to Intervals
credential handling, HR-zone calculation, run edit/delete, or plan
linking/unlinking rules.

## DATA-1 — Personal account sync

`src/personal-sync/usePersonalSync.ts` owns the signed-in lifecycle. It switches
the browser to an account-scoped schema-9 cache before paint, performs explicit
initialization or second-device reconciliation, records local changes in a
persistent outbox, and rehydrates only validated server snapshots. Failed or
malformed hydration leaves the last valid account cache visible.

`src/personal-sync/personalCloudRepository.ts` is the sole browser boundary for
the four private personal tables and their revision-enforcing RPCs.
`reconciliation.ts` owns legacy external aliases, ambiguous manual collisions,
tombstones, placement reference rewrites and no-repack second-device Build
adoption. `src/storage/personalSyncRepository.ts` owns account cache metadata,
revisions, outboxes and recoverable backups.

New RunLogs are `run-<random UUID>` and no production code parses their shape.
Imported identity is independently constrained by user/provider/external id in
Postgres, including tombstones. Training configuration and Intervals review
state are revisioned documents; each run has its own revision; Personal Build
structural writes are validated and reject stale revisions.

The training row also carries the account reset generation. Every outbox write
uses its last observed generation; reset increments it, so a never-synced run
from an older offline device is backed up and rejected instead of being
inserted. Run deletion batches tombstones and the existing deterministic
Personal Build repack into one RPC, which returns the new Build revision and
canonical placements. Mutations arriving during a request trigger one queued
follow-up pass after the current request releases its in-flight guard.

Canonical hydration reconstructs schema-9 and passes it through the shared
storage migration/domain validation before replacement. Legacy unscoped
Intervals credentials are adopted on first initialization or first canonical
account adoption on that device, never uploaded, never overwrite a scoped
credential, and are marked to prevent same-browser account leakage.

Crew remains a separate narrow projection. `useRaceCrew` will not project until
the active account cache is canonical. `reconcile_crew_run_identity` merges
legacy shared rows in place, retaining a survivor UUID, Props, Member Build and
Crew Build position where possible. Shared Member Build rows freeze width and
height; editing a placed communal contribution across a footprint boundary
demotes it to READY before recursive support healing.

## Crew contribution identity

A canonical personal run contributes to a crew exactly once.
`reconcile_crew_contributions` resolves every one of the runner's stored
`shared_runs` rows to the canonical run it represents: by run id, by a
registered legacy alias, or — for a row a pre-DATA-1 device wrote under an id
the account never recorded — by the crew-safe facts the row already shares, and
only when exactly one canonical run has those facts. Anything ambiguous is left
untouched, because an unreconciled duplicate is repairable later and a wrong
merge is not.

Each resolved group collapses onto the richest existing row rather than a
freshly projected one, so its shared-run UUID, Props and both placement systems
survive. Props move and placements fill before any duplicate is removed, and
removal is followed by the established support healing, so a communal block
left unsupported becomes READY instead of invalid construction. Personal
revisions are never rewritten from here.

`src/crew/projection.ts` reconciles after upserting and before reading the
server rows back, so Weekly Miles, Miles Built, comparisons and Recent Crew Runs
are derived from repaired stored data. Canonical adoption in
`usePersonalSync` reconciles the whole account for the same reason. Nothing is
deduplicated in the dashboard: the stored projection is the crew's data.

## Reusable Crew invites and share previews (issues #77, #81, #84)

`src/crew/invites.ts` makes private links `/join/<capability>`. Vercel rewrites
that path to `api/crew-invite.ts`, which resolves only a valid capability
through the public-safe `preview_crew_invite` RPC, emits the first-response OG
and Twitter metadata, then returns the browser to STACK with the capability
captured in session storage. The shared metadata is canonical: `og:url` is the
`/join/<token>` link itself, not the `/?join=` app URL the browser is then sent
to.

`api/og/crew-invite.ts` returns the 1200×630 identity card as **PNG**. Messages
would resolve an invite's title and then hang on an SVG `og:image`, so the card
is rasterised on the server and declared with `og:image:type=image/png`. The
emblem on it is the crew's own: `crewEmblemDrawing()` in `src/crew/emblem.ts` is
the one description of a crew's mark, and `CrewEmblem.tsx` serialises it to SVG
while the card rasterises the same operations. The image URL carries the saved
emblem code as its cache version, so an emblem change is a new image URL.

`api/_render/` is the renderer, and adds no dependency: `geometry.ts` flattens
SVG path data and converts strokes to fillable outlines, `canvas.ts` is an
anti-aliased scanline fill, `png.ts` encodes with Node's zlib the way
`scripts/generate-icons.mjs` does, and `text.ts` sets Space Mono from glyph
outlines that `scripts/generate-og-font.mjs` extracts from the same font file
the browser loads. Files under `api/` whose names begin with an underscore are
shared modules rather than functions, which is how Vercel treats them.

Relative imports inside `api/` carry an explicit `.js` extension. Vercel
compiles each API file separately rather than bundling it and leaves the
specifier as written, so an extensionless relative import resolves during the
build and then fails at runtime; TypeScript and Vite map `.js` back to the
`.ts` file.

`20260814010000_reusable_crew_invites.sql` makes one active reusable capability
per Crew. The owner-only RPC returns that current link on future visits and
`reset_crew_invite` immediately revokes the prior capability before issuing a
new one. `redeem_crew_invite` adds a membership idempotently without consuming
the link. The full invite landing lives in `CrewInviteLanding.tsx`, ahead of
the normal shell: it shows Crew identity first, then create/sign-in or join;
the pending capability binds to the first authenticated account so it cannot
leak to a later account in a shared browser.


## The three-layer Crew Emblem (issue #96)

A Crew Emblem is four independently colored layers rather than four stacked
plates: a **main** mark (29 options, half of them running and training — stride,
tread, shoe, track, lanes, finish, checker, stopwatch, split, route, peak, pace,
pulse, podium), **two secondary** accents drawn from one library of 15 plus
`None`, and a **background** field (12 plus `None`). Eight crew colors — four
light, four dark — apply one per layer. Two accents rather than one because a
single piece can only do one job: a ring *or* a lower stripe, a burst *or* a
pair of rails. One library offered twice rather than two libraries, because two
would be two half-sized ones. `src/crew/emblem.ts` owns all of it: the libraries, the `E2-…` code,
the drawing, and the color arithmetic.

One 200×200 coordinate space, and three concentric budgets, are what make the
libraries free to combine rather than merely stacked:

- a main mark is drawn inside x/y 58–142, whose corners sit 59 units from the
  center;
- an accent stays within 74 units of the center, so either of them can reach
  past the mark on any side — a ring, a burst, a crossbar, a rail — without
  leaving the field behind it;
- every background silhouette holds a 78-unit disc, which is the widest a Main
  and Secondary pair can ever be.

`src/crew/emblem.test.ts` asserts those three budgets against every path in the
library, so a new shape is safe exactly when it respects the budget for its
layer. It also holds every shape to the small path grammar the invite card
rasteriser understands (`M/L/H/V/Q/C/Z`), because a shape written with anything
else would look right in the app and lose part of itself in a shared preview.

Layers paint background → secondary → secondaryTwo → main, so the mark is never
obscured by a choice made on another layer and a crew can add an accent without
it costing them the symbol they picked. Each layer is wrapped in its own SVG
group.
`CrewEmblem.tsx` takes an optional `focusLayer`, which is only a `data-` hook:
the builder's tiles dim the two layers they are not offering entirely in CSS.

`CrewEmblemBuilder.tsx` follows `RunnerIconBuilder.tsx` rather than the arrow
cycler it replaces: a pinned preview with Surprise Me, then one row per layer —
a horizontal rail of option tiles, each drawing the whole emblem with that
candidate swapped in, and the layer's color swatches directly beneath it. The
rails scroll sideways on a phone and wrap into a grid at 560px; thirty tiles in
a fixed grid at 320px would be too small to judge art from.
`src/styles/crewEmblemBuilderStyling.test.ts` guards that, since there is no
visual-regression harness here.

Colors are paired, not picked independently. `readableCrewEmblemColorRecipes()`
computes every triple whose main-on-background contrast clears 1.6 and whose
secondary clears 1.35 against both neighbours, and `Surprise Me` draws from
that list — which is the only thing standing between a shuffle and a violet
mark on a blue field.

A fourth choice sits beside the three layers: the **ink style**. On, the mark
and its accent are outlined and the mark carries a dropped shadow; off, both
are flat colour straight onto the field. The background keeps its own edge
either way, because that edge separates the badge from the surface it is
sitting on rather than separating the layers from each other. The style rides
along in the stored code as a trailing group, and the builder offers it the way
it offers everything else — the emblem drawn both ways, not a switch labelled
with a word for a look.

`resolveCrewEmblem(stored)` returns the saved emblem or one fixed neutral
default. There is deliberately no decoder for the retired `E1-` codes and no
crew-id-derived mark: the old library is gone, so translating a retired Crown
into the nearest new piece would be inventing a decision the crew never made.
`20260815000000_three_layer_crew_emblem.sql` clears every legacy value to null
and replaces `crews_emblem_check` in place with the `E2-` pattern, which allows
three digits of shape index so these libraries can grow without another
migration; `20260815120000_crew_emblem_ink_style.sql` widens it again for the
optional trailing style group. A future index — or a future style digit — this
client does not have still fails soft, to that layer's first option and to the
outlined emblem respectively.

## NEXT-1 — Historical Data Foundation (STACK Next)

The first STACK Next engineering phase, on `feature/historical-data`. It adds a
history layer beside the existing application and changes nothing that was
already working: no AppState migration, no schema change, no Supabase
migration, no new dependency, and no screen.

**Why it exists.** Connected runs arrive through Run Data as *candidates the
runner is asked about* — a rolling 14-day window, a persisted review queue, one
decision at a time. That is the right model for "did you just run", and the
wrong one for "what has this runner been doing all year". Weekly volume, run
frequency, long-run progression, pace and HR trends, zone distribution and
training-load history all need a wide, complete, deduped record of actual
activity that nobody has to review first. `src/history/` is that record.

### The modules

`src/history/historicalActivity.ts` owns the model. A `HistoricalActivity` is a
**mirror of the source**, deliberately not a `RunLog`: source id, local date,
local start time, source type, name, distance, moving and elapsed time, average
and max HR, HR-zone durations, elevation gain, cadence, training load and
`sourceUpdatedAt`, plus STACK's own `firstSeenAt` / `lastSeenAt` /
`reconciledAt` bookkeeping. Three rules hold it together:

- **Source units, source values.** Metres, seconds, and cadence exactly as
  Intervals reports it. Conversion lives in `historicalMeasures.ts` and happens
  at read time, so no rounding is frozen into storage and nothing here doubles a
  cadence or invents a unit — the same rule `docs/CONNECTED_DATA_FIELDS.md`
  established in August.
- **Missing is `null`, never `0`.** Every optional key is always present and
  explicitly null when the source had nothing, so "no HR strap that day" cannot
  be read as a heart rate of zero. An all-zero HR-zone array is no coverage; a
  zero *inside* a populated one is a real zero and is kept.
- **Source facts only.** No classification, no derived pace, no plan link, no
  Build state. Keeping derived things out is what makes a re-sync safe.

The validity floor matches the existing import contract — verified running type,
readable local date, positive distance, positive duration — so history and an
importable candidate agree about what counts as a run. Rows that miss it are
*counted by reason* rather than logged, because the reason is engineering
information and the row is the runner's private data.

`src/history/historicalWindows.ts` is the pagination. The Intervals activities
endpoint pages by date range rather than by cursor, and `api/intervals.ts`
refuses a span over 120 days, so a historical read is a sequence of ≤90-day
windows that tile the requested range exactly — contiguous, non-overlapping,
inclusive at both ends, clipped to the oldest date asked for. They are read
**newest first**, so a sync that is rate-limited or interrupted halfway leaves
STACK holding the recent history rather than the far end of it. The lookback is
an argument (`DEFAULT_HISTORICAL_LOOKBACK_DAYS`, 365) with a 10-year ceiling so
a bad value cannot spin out thousands of requests.

`src/history/historicalReconciliation.ts` is dedupe and update. `provider +
sourceId` is the only identity; date and distance are never matched on, because
two real runs on one day at one distance are two runs. A new id is added, a
known id whose source facts are identical moves only `lastSeenAt`, and a known
id whose facts differ has them **replaced in place**, keeping `firstSeenAt`,
moving `lastSeenAt` and stamping `reconciledAt`. A field that has gone missing
upstream is written back to null rather than left stale — the activities
endpoint returns whole objects, so absent means the source no longer claims it.
That overwrite is safe here and would not be on a `RunLog`: this record holds
nothing a person decided, and the existing rule that normal sync never silently
rewrites an accepted imported run is untouched. Activities outside the current
window are **kept, never pruned**: a narrower lookback is a smaller question,
not a deletion.

`src/history/historicalSync.ts` is the service boundary. Everything above it
asks for a lookback and gets a normalized, deduped, persisted history; nothing
above it knows that Intervals pages by date, that the proxy caps a request, or
that the history is in `localStorage` at all. Windows are read sequentially —
the source rate-limits, and a burst of parallel requests is the fastest way to
be refused. A failed window **stops the sync** rather than pressing on, because
a rate limit, a dead connection and a rejected credential all fail the next
window too; everything already read is still reconciled and still persisted, and
the result names the window that stopped it and how many were left.

`src/history/historicalLinks.ts` derives the relationship between a historical
activity and an accepted `RunLog` **at read time and never stores it**. Storing
it would mean a re-sync could rewrite something the runner decided.
`unacceptedHistoricalActivities` is explicitly not a review queue: Run Data's
queue is still `stack.intervals.pending.v1`, and a year of history is context
rather than a backlog of decisions.

`src/history/historicalCoverage.ts` answers the question every later phase has
to ask before it can promise a trend — *is this metric actually populated on
this runner's runs?* — as counts, ratios, a date range and a rejection tally.
Aggregates only: no activity name, id, time or credential, so a coverage report
is safe to paste into an issue. `historicalFixtures.ts` supplies the synthetic
payloads the tests summarize; every value in it is invented, per the standing
rule that a real payload never enters this repository.

### Storage

`stack.history.activities.v1`, account-scoped with the same
`.<user-id>` suffix the other credential and queue slots use, through
`src/storage/historicalActivityRepository.ts`. Outside AppState, so introducing
it costs no migration, it cannot corrupt one, and it is in no backup, export or
Crew projection. Loads never throw — unreadable history is history the next
sync rebuilds. Writes throw `StorageWriteError` so a caller can say the history
will not survive the session rather than quietly promise a persistence it did
not get.

Every write is built key by key from an explicit allowlist rather than spread,
so a raw Intervals payload, a route, a coordinate pair, a stream array or a
credential cannot reach the slot even if a caller hands one in. A test asserts
exactly that against a fixture payload carrying all of them.

`clearHistoricalActivities` exists but nothing in the product calls it: the
current Forget Connection deliberately leaves personal review data in place, and
discarding a year of history is a product decision rather than a side effect of
changing a credential.

### The development diagnostic

NEXT-1 ships no screen, which leaves two questions only real data can answer:
does a long lookback actually come back from the owner's account, and which
optional metrics are genuinely populated? `src/history/historyDiagnostics.ts`
installs `window.__stackHistory` **only** when the device has explicitly set
`stack.history.diagnostics.v1` to `on` and reloaded. No UI sets it, it adds no
authority a connected device did not already have — it reuses the stored
credential through the same repositories the app uses — and it returns counts,
ratios and date ranges only, never a credential and never an activity's
identity. `main.tsx` calls it once. The deployed smoke-test procedure it exists
for is in `docs/STACK_NEXT_IMPLEMENTATION.md`.

### What NEXT-1 deliberately did not do

No Today or Home change, no runner-profile or Training Signals UI, no plan
change, no wellness, no streams or GPS, no cloud sync, no Crew change, and **no
Build block for any newly discovered historical activity** — historical Build
backfill remains an explicit later product decision (NEXT-6). No classification
of historical runs either: labelling them is NEXT-2's call to make once the
information architecture exists, and the persisted record is a source mirror
precisely so that call stays open.

### Tests

59 new tests across eight files, all on fake fixtures and fake credentials:
`historicalActivity.test.ts` (Tier 1 normalization, cadence verbatim, elevation
from the source aggregate, absent metrics staying null, rejection reasons,
private payload fields dropped), `historicalWindows.test.ts` (the range tiled
exactly with no gap or overlap, every window inside the reader's 120-day limit,
newest-first, nonsense lookbacks clamped), `historicalReconciliation.test.ts`
(added/unchanged/updated, `firstSeenAt` preserved, missing-upstream written to
null, out-of-window history kept), `historicalSync.test.ts` (multi-window paged
retrieval, a year of history recovered, repeated sync adding nothing, upstream
correction reconciled, a rate-limited window stopping the sync while keeping
what it read, account scoping, a refused write reported),
`historicalCoverage.test.ts` (per-field coverage and the printable fixture
summary), `historicalCompatibility.test.ts` (AppState byte-identical across a
historical sync, manual runs and plan links intact, accepted connected runs
mirrored without duplication or alteration, no Build blocks earned, the Run Data
review queue untouched, a manual-only device unaffected),
`historicalActivityRepository.test.ts` and `historyDiagnostics.test.ts`.

`npm run check` passes: 111 files, 1,462 tests.

## NEXT-2 — Runner History + Profile Foundation (STACK Next)

The second STACK Next engineering phase, on `feature/runner-profile`, and the
first one a runner can see. It adds **no navigation destination**: all of it
lands on the existing Runs screen.

**Why it exists.** NEXT-1 gave STACK a year of normalized source activity and no
way to look at it, deliberately. Two records now describe running and they mean
different things — a `HistoricalActivity` is a mirror of what Intervals knows,
a `RunLog` is a STACK activity carrying an effort, notes, a plan link and a
block — and neither one alone answers *what has this runner actually done*. The
mirror does not know about a treadmill run typed in by hand; the run log does not
know about the ten months before this plan existed.

### The unified read model

`src/history/runnerRun.ts`. `unifiedRunnerHistory({ activities, runLogs,
blockPlacements })` returns one `RunnerRun` per physical run, newest first. Pure:
it reads three lists and returns a fourth, and writes nothing anywhere.

- **One physical run is one row.** An accepted Intervals run has both records and
  is one run that happened once. They reconcile on `externalSource.activityId`
  against `sourceId` — the external identity the existing import already dedupes
  on. Date and distance are never matched on: two real runs on one day at one
  distance are two runs, and a source that renumbered its ids is a different
  problem than a merge can solve.
- **The run log wins on a shared fact.** Distance and duration come from the
  `RunLog` when there is one, because that is the number Build, Crew, the plan
  and Training Signals already count, and the runner may have corrected it after
  importing. A history row that disagreed with the rest of the app about how far
  a run was would be worse than no history row.
- **The mirror fills the gaps.** Local start time, the source's own name and
  type, and any metric the run log was imported without — a run accepted before
  STACK read HR zones gets them from the mirror.
- **STACK-owned facts are overlaid at read time.** Effort, notes, the plan link,
  whether the run was extra, and whether its earned block has been placed hang
  off `run.stack`, which is `null` for a run nobody logged. None of it is ever
  written into the historical mirror — that record stays a source mirror
  precisely so a re-sync can replace every field in it without destroying a
  decision.
- **Missing stays missing**, and a historical run **earns no Build block**.
  Historical Build backfill remains NEXT-6's explicit decision.

### The calculation layer

Four pure modules beside it, none of which import React, read storage or know
the plan exists. NEXT-3 is expected to build on these rather than reimplement
them beside a chart, which is why every window is an argument and every answer
carries the dates it was computed over.

`runnerVolume.ts` — calendar-week mileage (Monday–Sunday, the product-wide
boundary from `mondayOfLocalDate`, shared with Training Signals so the two cannot
disagree about the same seven days) and trailing windows (`today - (n-1) …
today`, inclusive, so a run finished an hour ago is in "the last 7 days"). The
current calendar week counts only through today: a week that has not happened
cannot have zero miles in it.

`runnerFrequency.ts` — run count, runs per week and active weeks over one shared
window of N calendar weeks. The rate divides by **elapsed** weeks (complete weeks
plus `daysIntoCurrentWeek ÷ 7`), because dividing eight weeks of runs by eight
when only 7.86 have happened reports a rate the runner has never run at. No
score and no label: STACK does not call anybody consistent, because it has no
documented rule that would make the word true.

`runnerLongRuns.ts` — the longest run of each week and of a trailing window. The
longest run of a week is *the longest run of that week*, not "the long run"
unless a plan link says a planned long workout is what it was; the run behind
each point is exposed so source fact and STACK interpretation stay separate. A
week with no running is `null`, never `0`. Ties go to the earlier run, decided
consistently so a selection cannot flip between renders.

`runnerCoverage.ts` — per-metric coverage, and the thresholds that decide whether
a view may exist at all: `RUNNER_METRIC_MINIMUM_RUNS` (8) **and**
`RUNNER_METRIC_MINIMUM_RATIO` (0.6). Both, not either: eight of eighty passes the
count and describes a tenth of the training. The thresholds live here rather than
inside a component, so a screen asks whether a metric is presentable and is told.

`runnerSnapshot.ts` assembles the four readings the top of Runs leads with.

### Pace and heart rate are shown per run and not compared

NEXT-2 states no aggregate pace or HR comparison, and that is a documented
omission. A historical activity carries no STACK activity type — NEXT-1 stored
none so classification would stay open — so there is no comparable-run grouping,
and none is available from source facts alone: *all runs* compares a 400m session
with a 20-mile Sunday, *a distance band* controls distance and nothing else, and
*a pace band* is circular. Per-run pace and HR are facts about one run and are
shown everywhere; the comparison is NEXT-3's, and must arrive with its qualifying
runs, window, sample minimum and coverage requirement documented.

### The sync lifecycle

`src/history/historySyncPolicy.ts` is pure policy;
`src/features/runs/useRunnerHistory.ts` is the thin React layer that performs it,
and it is the only thing in the product that triggers a historical sync.

A historical sync is expensive in a way the rolling Run Data sync is not — five
sequential requests against a source that rate-limits, versus one. So:

- **no connection, no request** (a manual-only runner never causes one);
- **event-driven, never polled** — app open and return-to-front, the same two
  moments the connected sync uses, with no timer anywhere;
- **a full year at most once** — 365 days when this device has never *completed*
  a read, then `HISTORY_REFRESH_LOOKBACK_DAYS` (45, one window) forever after,
  which is safe because reconciliation keeps history outside the window;
- **fresh history is left alone** — `HISTORY_STALE_AFTER_MS` is 24 hours;
- **a failure buys quiet** — every attempt starts a `HISTORY_RETRY_AFTER_MS`
  (1 hour) cooling-off period, because a rate limit, a dead connection and a
  rejected credential all fail the next attempt too;
- **a runner-initiated refresh** skips freshness and cooling off, but not the
  connection or in-flight checks.

Six states are exposed rather than a boolean, because "no history" has causes
that deserve different words on screen: `no-connection`, `never-synced`,
`syncing`, `fresh`, `stale`, `partial`. A manual-only device is not in an error
state and is never told its history failed.

Nothing here can break the app. Every path is inside a `try`, a failure sets a
message and nothing else, and the unified history is computed from whatever is
stored — which for a manual-only runner is nothing at all, and their run logs
alone are still a complete history.

### Storage

`stack.history.sync.v1`, account-scoped with the same `.<user-id>` suffix as
every other personal slot, through
`src/storage/historySyncStateRepository.ts`. Five values: last success, last
complete, last attempt, last failure message, stored count. Outside AppState, so
no migration and no backup/export/Crew exposure. Neither reading nor writing it
can fail an app — an unreadable record is a device that has not synced, and a
refused write is one wasted request later. The hook holds an in-session attempt
floor so a browser that refuses writes cannot loop on focus events.

No AppState change, no schema change, no Supabase migration, no new dependency.

### The screens

`RunsScreen` keeps its hidden page heading, its `N runs` lead and `Log Run`, and
gains four things in this order:

1. **`RunnerSnapshot`** — four readings, each carrying its own window: last 7
   days, last 28 days, runs/week over 8 weeks, longest run of the last 28 days. A
   window with nothing in it shows `—`, never `0`. Under it, how far back the
   history reaches, and a status line that is silent for a manual-only runner and
   for fresh history — the existing rule that freshness is hidden while normal.
   Two-by-two on a phone, four across at ≥480px: four across a 320px screen
   truncates `Longest 28d` and crushes `runs/wk` against its value.
2. **`RunnerVolumeStrip`** — twelve calendar weeks of actual mileage, reusing
   `PlanActualColumns` with no `planned` series at all, which is the phase in
   one component: this is what happened, with nothing beside it to be measured
   against. Weeks before the runner's first recorded run are dropped rather than
   drawn as zeroes — zero is a true statement about a week STACK has history for
   and a false one about a week it does not.
3. **Run History** — `RunnerRunRow` over the unified history, 25 at a time with
   `Show N more`. A row for a run STACK does not own leads with the source's own
   name or a neutral `Run`, is quieter than a logged run, and offers no accept,
   import or review affordance: Run Data's queue is where a run is a decision,
   and a year of facts must not read as a year of chores. `HistoricalRunSheet`
   opens it factually and read-only, omitting every metric the source did not
   supply rather than printing a zero. A STACK run still opens the existing
   `RunDetailSheet`, unchanged.
4. **Training Signals** — moved *below* the history rather than above it.
   STACK Next's ordering rule is actuals before intentions, and the first thing
   a runner meets on their own history screen should be their history. NEXT-2
   left the v1 cards in that slot unchanged; NEXT-3 replaced them (see below)
   without moving them.

`RunnerProfileSheet` ("Your Running") is the drill-down, opened from the
snapshot: Volume, Frequency, Long runs, and *What STACK has* — the per-metric
coverage report and the note explaining what is deferred and why. Everything
deeper lives here rather than as another card above the list.

One shared-component fix went with it: `PlanActualColumns` now drops a stepped
x-axis label immediately beside the last or selected one. At 320px with twelve
columns those two dates printed on top of each other, in the new strip and in the
existing Weekly Mileage detail alike.

### What NEXT-2 deliberately did not do

No Today or Plan change, no Training Signals v2, no historical Build backfill, no
automatic plan changes, no AI coaching, no readiness or recovery score, no
wellness, no GPS or routes, no Crew change, no cloud storage of historical data,
and no new persistent navigation destination. The larger navigation hierarchy is
revisited in NEXT-4/NEXT-5.

### Tests

108 new tests, all on fake fixtures and fake credentials. `runnerRun.test.ts`
(historical-only run present, accepted run once, manual and extra runs once,
overlay without mutating the mirror, run-log precedence, gap filling, nulls not
zeroes, mixed chronology), `runnerVolume.test.ts` (calendar weeks, partial
current week, trailing boundary dates at both ends, mixed historical/manual),
`runnerFrequency.test.ts` (count, elapsed-week denominator, partial weeks, empty
history), `runnerLongRuns.test.ts` (longest per week and per window, ties,
sparse data, gaps rather than zeroes), `runnerCoverage.test.ts` (missing,
partial and sufficient HR coverage, and runs with no optional metrics at all),
`historySyncPolicy.test.ts` (every trigger and phase rule, including a failed
first sync waiting out its cooling-off period), `historySyncStateRepository.test.ts`
(round trip, account scope, corrupt values, refused reads and writes),
`useRunnerHistory.test.tsx` (no connection, first year in bounded windows, fresh
avoids a refetch, stale refreshes with one window, a rate-limited window keeps
what it read, the app usable after a total failure, no retry storm on focus),
`runnerCompatibility.test.ts` (AppState byte-identical, no Build block earned,
plan and links intact, Crew projection and Training Signals unchanged,
manual-only device, and the snapshot agreeing with Training Signals about this
week's mileage) and `RunnerHistory.test.tsx` (the screen and its sheets).

`npm run check` passes: 121 files, 1,570 tests.

## NEXT-3 — Training Signals v2 (STACK Next)

**Status: implemented on `feature/training-signals-v2`, awaiting owner
acceptance.** Formulas, thresholds, coverage rules and the full audit of the v1
signals live in `docs/STACK_NEXT_IMPLEMENTATION.md`; this section describes the
code.

**Why it exists.** The v1 signals were built around *did the runner follow the
plan?* Four of the seven read a STACK activity type or a plan link, which exist
only on runs a person logged by hand — so on a runner with ten months of
connected history they described the fraction of training that happened to be
typed in. STACK Next asks a different question: *what is actually changing in
this runner's training?* NEXT-3 answers it from the unified history NEXT-2 built.

### The domain layer

`src/signals/` is new, pure and React-free, a peer of `src/history/` rather than
part of it: history answers *what did I do*, signals answer *what is changing*.

`trainingSignal.ts` holds the model. A `TrainingSignal` is a discriminated union
on `family`, so a detail view narrows to exactly the facts its family produced
and cannot read another family's numbers. Every signal carries a stable id, its
family and priority, the headline and supporting sentence, both windows with
their exact inclusive dates, the underlying facts, coverage where relevant,
supporting run ids, `isPresentable`, and an `unavailableReason` when it has
nothing to say. The shared window helpers, the threshold classifier, the
availability checks, the coverage-parity rule and the ordering function all live
here, with the reasoning for each threshold beside the constant.

Six family modules produce the signals: `volumeSignal.ts`, `frequencySignal.ts`,
`longRunSignal.ts`, `workloadSignal.ts`, `zoneSignal.ts` and
`planContextSignal.ts`. `runnerSignals.ts` assembles and orders them.
`presentableRunnerSignals` is what a screen calls.

Three rules the file layout enforces:

- **No formula in a component.** Every threshold is a named constant here, every
  comparison is a pure function over the unified history, and the words a runner
  reads are produced beside the arithmetic that justifies them. A component that
  decided `+1%` was "improving" would be inventing a claim nothing documented.
- **No word without a rule.** *Building*, *easing*, *steady*, *more often*,
  *holding* each map to a documented calculation. There is no *good*, *bad* or
  *failing*, no overall score, and nothing derived from Training Load that reads
  as readiness, recovery or fatigue.
- **Reuse, not reimplementation.** The three NEXT-2 calculation modules gained a
  window-anchored form each — `volumeInRange`, `runFrequencyInRange`,
  `longestRunInRange` — and the trailing-window functions now delegate to them.
  There is one implementation of "miles between two dates" in the product, so
  the signal card, the Recent Volume strip and the runner snapshot cannot
  disagree. Coverage is `metricCoverage` from `runnerCoverage.ts` at NEXT-2's own
  thresholds, not a second coverage vocabulary.

### The screen

`src/features/signals/` holds the UI, and computes nothing.

`SignalCards` renders the list the domain hands it. v1 was a two-up grid of KPI
tiles; a number that size reads as a score, and two side by side invite a
comparison nobody defined. A v2 card is a full-width row led by a sentence, with
the evidence and the window beneath it in progressively quieter type. Nothing is
coloured by direction — the only colour is the family's accent rail, and the
direction glyph is muted and `aria-hidden`. A signal with nothing to say is not
rendered at all; when none is available, one compact line says so once.

`SignalDetailSheet` opens the working behind a card and dispatches on `family`
to `VolumeSignalDetail`, `FrequencySignalDetail`, `LongRunSignalDetail`,
`WorkloadSignalDetail`, `ZoneSignalDetail` or `PlanContextSignalDetail`. Each
states the claim, the two values and the change, both windows' exact dates, a
chart, the runs or weeks behind the numbers, coverage where the metric is
optional, and one sentence explaining what the signal means. `SignalDetailParts`
carries the two pieces every detail shares. The charts are the existing shared
components — `PlanActualColumns`, `SelectableTrendLine`, `DonutChart` — and the
plan-context detail reuses `ConsistencyDetail` and `WeeklyMileageDetail`
unchanged.

`RunsScreen` keeps the NEXT-2 hierarchy exactly: Runner Snapshot, Recent Volume,
Run History, Training Signals. It asks the domain which signals are presentable,
renders them in the order it is given, and opens the detail behind whichever is
tapped. A run reached from a signal's detail returns to that signal when closed,
whether it is a STACK run or a connected-history row.

### Removed

`TrendCards`, `TrainingSignalDetailSheet`, `EasyPaceDetail`,
`HeartRateZonesDetail`, `LongRunDetail`, `RunMixDetail` and `TrainingLoadDetail`
are deleted, along with their stylesheet rules. `ConsistencyDetail`,
`WeeklyMileageDetail` and `TrendDetailShared` remain — the first two are the plan
instruments the retained plan-context signal is built from, and the third is
shared by the runner profile sheet.

`src/domain/trends.ts` is untouched. It remains the plan-relative domain model,
`selectTrainingSignals` still backs plan context, and its now-unrendered fields
stay in place: NEXT-2's compatibility test asserts that function's output is
unchanged, and NEXT-5 is the phase that decides the plan domain's future.

### What NEXT-3 deliberately did not do

No aggregate pace or HR comparison — the NEXT-2 deferral stands, because no
defensible comparable-run grouping is available from the data STACK holds and
inventing an effort classification to produce a metric is ruled out. No Today or
Plan redesign, no navigation change, no Build or Crew change, no historical
Build backfill, no automatic plan changes, no AI coaching, no readiness,
recovery or overall score, no wellness, no GPS or routes. No new persistence of
any kind: signals are recomputed from the normalized history rather than cached,
because a derived cache would be a second source of truth for numbers the runner
can already check against their own run list.

### Tests

126 new tests, all on fake fixtures. `trainingSignal.test.ts` (windows,
threshold classification at both boundaries, baseline history coverage, coverage
parity, ordering, stable ids, absent signals, no input mutation), one file per
signal family covering increase, decrease, stable, both thresholds, empty
history, a single available window and every coverage failure mode,
`planContextSignal.test.ts` (plan present, no plan, nothing due, extras counted
separately, historical-only and manual-only runners), `signalCompatibility.test.ts`
(AppState byte-identical, Build blocks and placements, plan and links, accepted
run, Crew projection carrying no health metric, historical mirror and sync
bookkeeping, no new storage key), `TrainingSignals.test.tsx` (card order,
suppression, evidence and window on the card, the "more history needed" state,
detail contents and dates, keyboard activation, drill-through to a run and back)
and `signalCardStyling.test.ts` (one card per row at phone widths, no
direction-coloured rule, no animation for reduced motion to suppress, no v1 tile
rules left behind).

`npm run check` passes: 131 files, 1,660 tests.

## NEXT-4 — Today / Home revision (STACK Next)

**Branch:** `feature/today-next` → PR into `feature/stack-next`.

Today used to answer one question — *what does my plan say today?* — and on a
rest day, before a plan started or after a race it had almost nothing to say. It
now answers **what matters now?**

The plan is not hidden to achieve that. A runner with a scheduled run today is
almost certainly looking at their most important immediate action, so that
workout still leads and still carries `Mark Complete`. What changed is that the
rest of the screen understands the runner beyond that one workout.

### The screen

`src/features/today/TodayScreen.tsx` composes, in order:

1. `TodayHeading` — the date as the screen's `h1`, and under it the race as
   quiet goal context in the smallest type on the page. The countdown is dropped
   once race day has passed rather than reading `Race day` forever.
2. **The immediate action.** `TodayWorkoutCard` for a scheduled run,
   `CompletedRunSummary` once it is logged, or a one-line `TodayNote` for a day
   that asks nothing — rest, before the plan starts, after the race.
3. `RunFoundCard`, unchanged, sitting with the other actions. A run waiting to
   be told what it was is something the runner can do, so it is not buried under
   analytics; it never displaces today's scheduled workout.
4. `TodayContext` — two or three orienting facts from the NEXT-2 history layer.
5. `ThisWeekStrip` — actuals first, the plan's intent beside them.
6. `TodaySignalNote` — at most one NEXT-3 observation.
7. `NextWorkoutCard`, retitled `Up next` — compact upcoming intent.
8. `BuildPreview`, tightened.
9. `TodayCrewActivity`, unchanged, below the runner's own hierarchy.
10. The quiet sync-failure line and retry, still silent while a run is waiting
    for review.

Only item 2's workout state is a card. Everything else is a section, a note or a
line: the screen has fewer boxes than it did, which is what makes room for what
the runner is actually doing.

### The model

`src/features/today/todayModel.ts` is pure, React-free and separately tested. It
resolves the whole screen from four inputs — the plan, the STACK run logs, the
unified actual history and a local date — and the component renders what it is
handed. Four rules govern it:

1. **Nothing is recalculated.** Trailing mileage is `runnerVolume`, frequency is
   `runnerFrequency`, the recent longest run is `runnerLongRuns`, the week's
   intent is the existing `selectPlanWeekViewModel`, and the observation is
   NEXT-3's signal domain. There is no Today-specific definition of a mile, a
   week or a run, and no new metric window.
2. **Actuals before intentions.** The week model leads with what was actually
   run and carries the plan's intent alongside it.
3. **Useful omission.** A reading STACK cannot state is left out. There is no
   "not enough history" card on Today.
4. **One fact, one job.** `READING_STATED_BY` maps each context reading to the
   signal family that would state the same number, and a reading the chosen
   observation already states is dropped.

`todayContextReadings` offers at most `TODAY_CONTEXT_READING_LIMIT` (3) readings
in a fixed order: 28-day miles, runs per week over 8 weeks, longest run of the
last 28 days. Trailing-7-day miles is deliberately absent — This Week directly
below already answers "how much lately". A fully known empty 28-day window is
still `0 mi`, which is NEXT-2's own distinction between a measured zero and an
unknown value; frequency and longest run are omitted when null.

`selectTodaySignal` applies five documented rules to NEXT-3's ordering unchanged:
keep only presentable signals; drop plan context, which Today states directly
twice over; drop anything measured as `steady`; take the highest-ranked survivor
of `orderTrainingSignals`; show nothing if nothing survives. The result is an
observation and never a recommendation — no signal is translated into advice.
`TodaySignalNote` routes to Runs rather than building a second detail
implementation beside NEXT-3's.

`todayWeek` takes its boundaries from the plan whenever the plan has a week
covering today, so Today and Plan agree by construction; outside the plan it is
the calendar week from `mondayOfLocalDate`, because a runner between plans still
ran this week. Its actual figures come from `volumeInRange` over the unified
history, so a run recorded by a watch and never accepted into STACK still counts
as running this week — while scheduled completion still counts only what the
plan asked for, exactly as before. The section is omitted when nothing ran and
nothing was scheduled.

### Data flow

`AppShell` already held `runnerHistory`. Today now receives `runnerRuns` through
that existing boundary, exactly as Runs does, and falls back to
`unifiedRunnerHistory({ runLogs, blockPlacements })` — which is precisely what a
manual-only runner has, and what every existing test that renders the screen
with run logs alone gets.

```text
App / useRunnerHistory → AppShell → TodayScreen → todayModel.ts
```

Today opens no second history hook, no second sync, no Today-specific
persistence and no second stale/fresh lifecycle, and it refetches nothing.

### What changed on each existing element

| Element | Verdict |
|---|---|
| Date heading | KEEP |
| Race countdown | REFRAME — quiet goal context, stated once, dropped after race day |
| `TodayWorkoutCard` (run) | KEEP — still the one card, still leading |
| `TodayWorkoutCard` (rest) | COMPRESS — a rest day is a `TodayNote`; the rest branch and its `--rest` styling are gone |
| Before-plan / after-race | COMPRESS — same words, `TodayNote` instead of a full-card `EmptyState` |
| `CompletedRunSummary` | KEEP |
| `RunFoundCard` | KEEP, moved up beside the other actions |
| `ThisWeekStrip` | REFRAME — evolved in place; actual miles and runs lead, plan progress follows. Run time and the week's longest run removed as unactionable or duplicated |
| `NextWorkoutCard` | KEEP, retitled `Up next` |
| `BuildPreview` | COMPRESS — three rows became two; no Build domain logic touched |
| `TodayCrewActivity` | KEEP |
| Sync error + retry | KEEP |
| Run entry | KEEP |
| `TodayContext` | NEW |
| `TodaySignalNote` | NEW |

Preserved in full: scheduled completion, editing and deleting a completed run,
Run Found review with `Not now` and `Ignore this run`, manual fallback, sync
retry, the earned-block handoff into Build, Crew access, and the existing
accessible focus and `aria-live` behaviour.

### Styling

`src/features/today/todayDecisionSurface.css`, imported by the screen, following
the `signalPresentationCleanup.css` precedent. Presentation only. The observation
is never coloured by direction — that would be scorekeeping — the readings carry
no tile chrome, and both stay legible at 320px. The rules for the deleted
week-actuals list and the rest-day card were removed from `components.css`
rather than left to fight with the new ones.

### What NEXT-4 deliberately did not do

No Plan architecture redesign: `TrainingPlan` in AppState, plan editing, plan
generation, week navigation and the plan domain are untouched, and NEXT-5 remains
the phase that decides the plan's future. No Build domain change — no historical
backfill, no change to block ownership, earning or deterministic placement, which
stay NEXT-6's. No Crew change and no new projection field. No navigation change,
no new persistence, no schema change, no migration, no dependency. No readiness
state, no score, no adherence grade, no red/green success-failure semantics, no
coaching or medical language.

### Tests

53 new tests, all on fake fixtures. `todayModel.test.ts` covers the signal
selection rule at every exclusion and its determinism under reordering, the
reading order and limit, unknown-versus-zero, the dedup rule, week boundaries
inside and outside the plan, the signed race countdown, and that the model
mutates neither input. `TodayScreen.test.tsx` is extended for actual-first This
Week, a connected-only run counted as this week's running, the week surviving
outside the plan, the compact rest/before-plan/after-race states, the
recent-training strip and its absence, exactly one observation with its evidence
and dedup effect, that it advises nothing, and that it routes to Runs.
`todayDecisionSurfaceStyling.test.ts` asserts the presentation decisions that are
product decisions rather than taste.

`npm run check` passes: 134 files, 1,709 tests.

## Runs Reframe R1 — visual overview (STACK Next)

**Status: implemented on `feature/runs-overview`, awaiting owner acceptance.**
R1 is not owner-accepted by this document. R2 is now implemented as the stacked
child described below; R3 Run Detail enrichment and NEXT-5 remain paused.

### Runs Overview hierarchy

`src/features/runs/RunsScreen.tsx` remains the Runs destination owner and now
renders this primary-screen sequence:

1. `RunnerSnapshot` — the existing 28-day mileage leads, with the unchanged
   7-day mileage, eight-week runs/week, 28-day longest run and history freshness
   facts supporting it;
2. `RunnerVolumeStrip` — the existing compact weekly-volume series under
   `Recent Training`;
3. visual Training Signal summaries — up to three, in existing domain order;
4. `Recent Runs` — the three newest `RunnerRun`s;
5. an explicit complete-history boundary (R1's bridge is replaced by the R2
   child screen below).

The overview no longer paginates the complete archive inline. Its run rows still
use `RunnerRunRow`, preserve STACK-owned versus historical-only identity, and
route to the existing `RunResultDetail` or `HistoricalRunSheet` surfaces.
`Log Run` remains in the Runs entry actions.

### Signal overview presentation

`src/features/signals/signalOverview.ts` provides a pure presentation selector
and visual model. It accepts the existing `TrainingSignal` outputs, removes only
signals without presentable facts, keeps their existing order, and caps the
overview with `RUNS_OVERVIEW_SIGNAL_LIMIT = 3`. It does not create a ranking or
change a signal's formula, threshold, window, direction wording or availability.

`SignalOverviewVisual` maps the six existing families to compact factual forms:
Volume paired bars, Frequency block-textured paired bars, Long runs an eight-week
gap-preserving progression, Workload paired load bars, Zone mix current/prior
lower-zone share composition, and Plan context completed/due progress. Overview
items expose a current result, change/reference, compact visual and prior/window
context; their existing interpretation is not shown as a paragraph by default,
while the accessible name retains the complete factual comparison. R1 used an
`AllSignalsSheet` bridge for more than three signals; R2 replaces it with inline
continuation while retaining `SignalDetailSheet` for one selected Signal.

The owner-reviewed refinement makes the surface deliberately less container-led:
the snapshot is typographic rather than boxed, weekly-volume grid/frame weight is
reduced, previous weeks are quiet and current selection remains accented. Normal
STACK sans is used for screen, section and sheet titles; machine typography is
reserved for values, units, dates, axes and window labels. Lime primarily marks
current/selected state, while signal-family colors stay on small visuals and
rails. Signal Detail uses result, comparison, chart, supporting evidence and
prior/reference order. Methodology and exact periods remain available once behind
the native `How STACK calculates this` disclosure instead of being permanently
visible or repeated.

### Full History boundary

R1 used `FullHistorySheet.tsx` as a small bridge: the existing rows, 25 at a
time, with existing detail routing. R2 deletes that bridge and replaces it with
the History Explorer child screen documented below.

### Data and regression boundary

R1 adds presentation helpers and CSS only. It does not change
`unifiedRunnerHistory`, reconciliation or sync, snapshot/volume/frequency/long-
run calculations, Training Signal formulas or ordering, RunLog, Build placement,
Crew projection, Plan state, schemas, migrations or persistence. Run Detail 2.0
and its on-demand Intervals profiles are preserved; QA stream fixtures remain R3.

## Runs Reframe R2 — history explorer (STACK Next)

R2 is implemented on `feature/runs-history-explorer` as a stacked child of the
current R1 branch, and has since had one product-polish pass over that
implementation. It is awaiting owner visual review, is not accepted and is not
merged.

### Overview continuation

`RunsScreen` now treats small continuation and historical browsing as different
jobs. Training Signals still show the first three presentable domain-ordered
signals, but `Show all` reveals the remaining presentable families inline and
`Show fewer` restores the featured state. Recent Runs likewise grows from three
to a bounded ten inline. Both continuations are quiet sans utility actions.
Underneath them a named destination row — `History`, with how many runs it holds
and how far back they go — enters a child screen inside Runs; neither
continuation opens a collection modal. The retired
`AllSignalsSheet.tsx` and `FullHistorySheet.tsx` files are deleted. Selecting one
Signal or one run still uses the existing focused detail sheet and returns to
the same Runs depth.

### History Explorer

`src/features/runs/HistoryExplorer.tsx` owns presentation-only browsing state:
metric, range, selected bucket and progressive row count. It is rendered inside
`RunsScreen`, so it adds no router or bottom-navigation item and Runs remains
the active destination.

Entering and leaving it behaves like navigation rather than a re-render.
`RunsScreen` remembers the Overview scroll offset, a layout effect puts History
at its own top on the frame the view swaps, and returning restores the remembered
offset; History focuses its own `History` title on mount. Arriving on the Runs
tab moves nothing. The app shell above already carries `env(safe-area-inset-top)`,
so the title and back affordance never begin under the status bar.

The screen exposes Miles, Runs, recorded Time, source-provided Training Load,
source-reported Gain and recorded HR-zone composition over 4W, 3M, 6M, YTD, 1Y
and ALL. `src/features/runs/historyExplorerModel.ts` is the pure boundary over
normalized `RunnerRun` values. It resolves local-calendar ranges against actual
known coverage, buckets 4W/3M/6M and short YTD weekly, buckets long YTD/1Y/ALL
monthly, retains measured empty buckets, and aggregates source summaries without
recomputing them from streams. Optional missing values remain `null`; known
values render with compact contribution coverage instead of zero-filling the
unknown runs.

History is filtered by metric and date range only. The R2 Planned / Extra /
History-only row is removed: it exposed STACK's own ownership model rather than
the runner's, and its helper is gone rather than left unused. Historical workout
type is still never inferred.

One readout above the chart owns the result — metric label, value, covered
dates, one context line, and a compact selected-period line — and nothing repeats
it beneath the chart. The context line states the equally long prior window when
that window is inside known coverage, then either a weekly rate or, for an
optional metric that some runs lack, its contribution coverage. `Runs in period`
lists the whole selected range newest-first; selecting one period from the chart
narrows the list to that period, names it, and offers `Show the whole range`.
Large lists reveal 25 at a time, and each row keeps the existing STACK-owned or
historical-only detail route.

`4W` aggregates as exactly four trailing seven-day buckets rather than the five
Monday weeks a trailing 28 days usually touches; 3M, 6M and short YTD stay
weekly; long YTD, 1Y and ALL stay monthly. A calendar bucket clipped by today is
marked in progress, drawn as unfinished, and excluded from the default chart
selection.

Rows are flatter: `RunnerRunRow` keeps its identity and detail routing, but run
name and date sit on the left, the run's own facts in machine type on the right,
and rows are separated by spacing and a hairline instead of one outlined card
each. A historical-only run's origin stays subtle metadata and no longer dims its
name. Runs presents mileage at one decimal everywhere through
`formatRunsMiles`, so a range total, a chart readout and a row agree and no
aggregation precision leaks into the UI.

### Chart readability and QA

Chart form follows what the metric means. Miles and recorded Time are discrete
per-period totals and stay columns; Runs, source Training Load and source
Elevation Gain are read as movement and are drawn as lines that break rather
than join across a period with no recorded value; Zone Mix stays a horizontal
composition and is never a single line.

History charts put the exact selected period/value in the readout above the plot,
show three y-axis ticks, and use a full-plot native range control whose
transparent thumb is 44px and whose `touch-action: pan-y` leaves vertical page
scrolling alone. `src/components/charts/chartTickDensity.ts` shares the
deterministic sparse-label choice with `PlanActualColumns`: about four evenly
spaced dates, both ends anchored, and a guaranteed fifth-of-the-plot gap between
visible labels. The selected bucket is no longer forced into the axis — it is
named in the readout — which is what removed the overlapping `Jun 15Jun 29`
labels found in owner review. History ticks are positioned over their own bucket
rather than laid out in a column grid, so a label cannot be pushed into its
neighbour.

`src/components/charts/chartDefaultSelection.ts` holds one product rule for what
a chart opens on: the latest completed, non-empty period. Recent Training,
History and the column-based Signal details share it, so no surface opens on a
current week with nothing in it yet. `SelectableTrendLine` and `DonutChart`
retain their existing 44px interaction targets.

The reusable QA Runner still carries roughly a year of synthetic unified
history and now omits Load, Gain and Zones on deterministic subsets, which
exercises honest partial coverage. It remains in-memory, credential-free and
network-free. R2 adds no page-specific demo, persistence/schema change,
history fetch, stream fixture or R3 Run Detail work.

## Runs Reframe R3 — Run Detail enrichment + QA stream review (STACK Next)

**Status: implemented on `feature/run-detail-enrichment` (PR #122, draft),
awaiting owner visual acceptance.** R1 and R2 are merged into
`feature/stack-next`. NEXT-5 remains paused.

R3 changed no product concept. It removed a duplication and closed a review
gap, and both were solved by the same seam.

### The external read boundary

`src/connected/sourceDetail.ts` names the only two things Run Detail needs from
outside the app:

```ts
interface SourceDetailReader {
  readDetail(activityId: string): Promise<IntervalsActivityDetail>;
  readProfile(activityId: string): Promise<IntervalsRunProfile | null>;
}
```

A `SourceDetailReaderFactory` turns this device's connection into a reader, or
into `null` when there can be none. `intervalsSourceDetailReader` is the
production factory and the React context default, so ordinary product code
never opts in: it delegates to the unchanged `fetchIntervalsActivityDetail` and
`fetchIntervalsRunProfile`, and still refuses to produce a reader without a real
connection. Nothing about the token/network boundary was relaxed.

`useSourceDetailReader(connection)` memoizes on the connection's **value** —
mode plus credential — rather than its object identity. `App.tsx` rebuilds its
`IntervalsConnection` object on every render, so before R3 an open detail sheet
re-issued its source reads whenever anything in the app changed. It no longer
does: the source is read because a run's detail opened.

### One source-owned presentation

`src/features/workout-detail/SourceRunDetail.tsx` is the source-owned half of
Run Detail 2.0, extracted once instead of copied:

- primary result — distance, moving/duration, average pace;
- the Run Profile with its Pace / Heart Rate / Elevation / Cadence selectors;
- the imported secondary aggregates;
- the heart-rate zone donut;
- the structured source-interval list and its concise retry.

`src/features/workout-detail/sourceRunFacts.ts` is its input vocabulary:
`SourceRunFacts` plus `sourceRunFactsFromRunLog` and
`sourceRunFactsFromRunnerRun`. No `RunnerRun` is ever dressed up as a `RunLog`
to reach the shared surface, which is what keeps STACK-owned semantics from
leaking onto a run nobody has decided anything about.

Two callers wrap it:

- `RunResultDetail` keeps exactly what a historical-only run does not have —
  the `Synced via` / effort / elapsed meta line, and the runner's notes — and
  passes them as slots. Its props are unchanged, so Runs, Plan, Build and Crew
  call it as before.
- `HistoricalRunSheet` renders the shared surface from a normalized `RunnerRun`
  and `run.externalActivityId`, plus its date/source-name/`History` context and
  the existing "not logged in STACK" note. It adds no effort, notes, plan link,
  activity classification, Build block, import or accept action.

`RunsScreen` passes its existing `syncToken` to `HistoricalRunSheet` as
`connection`. Detail routing from Overview and History Explorer is unchanged.

### Historical-only enrichment behavior

1. the normalized `RunnerRun` summary renders immediately — it is already held;
2. with `externalActivityId` **and** a reader, detail and profile reads start on
   open, independently of each other;
3. a usable profile appears when it resolves;
4. an unrecognized shape, a `null` profile or a failed profile read leaves the
   summary intact, shows no chart frame and raises no alert;
5. a superseded run's late answer cannot land in the run now open;
6. nothing here touches historical sync, resync, reconciliation or identity.

### Source-truth discipline, unchanged and now in one place

Streams provide shape; aggregates provide the stated numbers. Pace is the run's
own distance over duration; Avg/Max HR and Gain are the source's aggregates;
cadence is verbatim, undoubled and unlabelled; elevation Low/High are the only
facts read off a series, because they are properties of that series. Missing
stays missing. `normalizeIntervalsRunProfile` still answers `null` for a shape
it does not recognize.

### QA review states

`src/qa/qaSourceDetail.ts` is the QA factory. It answers from deterministic
**raw** payloads routed through the production `normalizeIntervalsRunProfile`
and `normalizeIntervalsActivityDetail`, so QA exercises the real normalizer,
chart, selectors and summary discipline rather than a QA-only renderer. It
holds no credential, issues no request, writes nothing, and is mounted only by
`QaRunnerApp`.

The fixture adds one run for each corner of the review:

| Activity id | Ownership | Source detail |
| --- | --- | --- |
| `qa-detail-rich` | accepted, extra run, today−2 | 150 samples over 49:40, all four metrics, strap/position gaps, one standing-still sample, seven structured groups, zones |
| `qa-detail-aggregate` | accepted, extra run, today−4 | aggregates and zones only |
| `qa-detail-history-rich` | historical-only, today−9 | 200 samples over 1:20:03, all four metrics, gaps, zones, no structured groups |
| `qa-detail-history-aggregate` | historical-only, today−11 | distance and duration only |

Synthetic cadence stays around 79, never 158. There is no route, coordinate,
FIT payload or personal data in the fixture, and nothing is persisted.

### Accessibility and phone behavior

Run Profile selectors became R2-style controls: a real `button` at the 44px
interaction floor with a smaller visible chip inside it, `aria-pressed` for the
selected metric. The primary result grid sizes itself to the facts the source
stated (`data-count`), and pace shrinks because it is pace
(`[data-metric="pace"]`) rather than because it happens to be last — which is
what keeps a duration-less historical run from leaving two empty columns.

### Boundaries R3 did not cross

No maps/routes/GPS, FIT parsing, PR or best-effort detection, cross-run trends,
VO2 max, readiness/recovery/fatigue, prediction, wellness, historical Build
backfill, automatic plan change, new workout-type inference, durable raw-stream
storage, persistence/schema/migration, or NEXT-5 work.
`docs/CONNECTED_DATA_FIELDS.md` is unchanged: the Run Profile stream rows stay
`Expected`, because synthetic QA data verifies rendering and never a source
field.

`npm run check` passes: 147 files, 1,844 tests.

## NEXT-5 — Plan role revision (STACK Next)

The governing rule, from `docs/NEXT5_PLAN_ROLE_REVISION.md`:

> **Actual history says what happened. Plan says what was intended. A link says
> how an actual run relates to that intent.**

Plan remains useful, editable, race-specific structure. It no longer gets to
define whether the runner ran.

### The three separate readings

`src/features/plan/planWeekContext.ts` is pure and React-free.
`planWeekActualContext` reports actual miles and run count from the unified
`RunnerRun[]` history inside the viewed week's exact dates — including
historical-only activity, because it happened — and links nothing.
`planWeekIntentContext` reports what the schedule asked for, and states planned
mileage only when every scheduled run has a numeric target; a missing target
keeps the number missing rather than inventing a zero.

`WeekLead` therefore reads: which week, phase and dates → planned intent →
actual running in those dates → `X of Y plan runs linked` as quiet relationship
metadata → the seven day rows. There is no completion hero, no progress bar, no
percentage, no adherence grade and no red/green pair. A future week shows the
intent reading alone; the summary collapses to one column rather than leaving an
empty `0 actual` cell.

`PlanScreen` receives `runnerRuns` through the `AppShell` boundary Today and
Runs already use. It opens no second history hook, no second sync and no
Plan-specific persistence.

### Lifecycle

`src/features/plan/planLifecycle.ts` is pure: `planLifecycle` resolves
`before-plan` / `active` / `after-race` (the start date and race day are both
inside the window), and `planLifecycleNote` returns the one quiet line Plan says
about itself, or null while training is underway.

- **Before the plan starts** — Plan still opens on Week 1 as a preview.
  `Plan starts Aug 3` plus *training has not started yet* is stated once, in a
  line rather than a card. Every scheduled day reads `Planned`; nothing is
  missed, unlinked or incomplete, no zero-actual reading appears, and running
  done before the start date stays outside Week 1 because it is outside Week 1's
  dates. Plan editing and setup are unchanged.
- **During training** — no lifecycle line at all; the week carries the screen.
- **After the race** — `Plan complete`, the race it was built for, and the
  weeks kept as the structure that race was built on. The final week is not
  presented as the active training surface: `This week` is absent, because
  `isCurrentWeek` was already false after race day. Every earlier week stays
  browsable, and the week shortcut becomes `Final Week` so browsing has a way
  back. Nothing is deleted, archived or mutated.

The shortcut label follows the lifecycle (`Current Week` / `First Week` /
`Final Week`) because outside the training window there is no current week to
return to.

### The next race

Once the race has passed, Plan offers one compact `Set up next race` action that
opens the **existing** `RaceSetupSheet` — the same component, inputs and
`onGeneratePlan` contract Settings opens. Plan owns no plan generation of its
own and there is no second setup implementation. `AppShell` passes the
`raceSetup`, `runDays` and `onGeneratePlan` it already held; without
`onGeneratePlan` the action is simply absent. After a plan is generated the
screen lands on the new plan's own opening week rather than on a week number
that no longer means anything.

### Language

`PLAN_DAY_STATUS_LABEL.missed` is `No linked run`, in Plan rows, in the Workout
Detail sheet and in Today's This Week day list, which reads the same map. The
underlying `missed` scheduling state is unchanged, so logging, editing, moving
and rest-day behavior are unaffected. Nothing infers that a nearby historical
activity was the intended workout: no date, distance, title, pace, type or
proximity matching exists anywhere in this phase, and an explicit `RunLog`
plan link remains the only relationship between an actual run and a planned
workout.

An unlinked past day also lost its warning colour — it used to be drawn in the
long-run hue, which read as a verdict — and its label moved from cramped
uppercase machine type into interface sans, because a relationship is interface
language while dates and values stay machine type.

### What NEXT-5 deliberately did not change

Navigation is untouched: Plan remains a bottom-navigation destination, which
`docs/NEXT5_PLAN_ROLE_REVISION.md` reasoned about explicitly rather than
removing for novelty. Today keeps its recent-training context, Training Signal,
Build summary and Crew, and its `View Plan` handoff is unchanged. Runs remains
the only place for historical trends, Signals, complete history and Run Detail;
Plan gained no chart and no second Runs screen. No Build earning, ownership or
placement change; no Crew change; no schema, migration, persistence or
dependency change; no R1–R4 Runs behavior change.

### Deferred: no active plan

STACK's persistent model always contains a `TrainingPlan`. Representing *no
active plan* properly — an empty Plan destination, a Today with no schedule, a
Build with no race, onboarding without a generated plan — is an AppState schema
decision that cascades through Today, Build, Crew and onboarding. NEXT-5 does
not force it: the after-race plan stays available as historical intent and the
existing setup flow is the path to the next race. The nullable-plan question is
recorded here as a later explicit decision, not as work this phase skipped.

### Tests

`planLifecycle.test.ts` (window boundaries, silence during training, and that
neither lifecycle line grades the runner), `PlanLifecycle.test.tsx` (before-plan
Week 1 implying no failure, no zero-actual noise, pre-plan running staying out
of Week 1, the final week not reading as active, earlier weeks staying browsable
with a way back, the next-race action routing into the existing sheet, its
absence during training and without a setup flow, no input plan/run-log/runner-run
mutation, and a plan move leaving what a run earned untouched),
`planPresentationStyling.test.ts` (no scoring rules, the single-reading week, an
11px floor for supporting labels, the 44px next-race target, and no warning
colour on an unlinked day), plus the existing `PlanScreen.test.tsx`,
`planWeekContext.test.ts`, `PlanEditing.test.tsx`, `RunDays.test.tsx`,
`RaceSetup.test.tsx`, availability conflict and `App.test.tsx` coverage, updated
to the truthful language.

`npm run check` passes: 152 files, 1,875 tests.

## NEXT-6 — Build + Crew compatibility (STACK Next)

NEXT-1 through NEXT-5 rebuilt what STACK knows about the runner. Build and Crew
were never revisited, so this phase asked what they should mean now — and found
that both already behaved correctly for reasons nobody had written down.

### What earns a block

> **A block is earned by a run the runner brought into STACK.**

`earnedBlocks(plan, runLogs)` maps over `RunLog`s, so a run the runner logged by
hand or accepted from Run Data earns exactly one block. Connected history that
was never accepted has no `RunLog`, appears in the unified read model as a
`RunnerRun` with `stack: null`, and earns nothing.

**Owner decision, August 19, 2026: it stays that way, and STACK ships no
backfill.** Not on install, not on sync, not on request. The reasoning is in
`docs/NEXT6_BUILD_CREW_COMPATIBILITY.md`; the short version is that the tower
means *what I built*, an opt-in conversion is a real feature rather than a
toggle, and a backfill built from `RunLog`s would also make that running
Crew-visible as a side effect.

An accepted run and its source mirror are one physical run: they reconcile on
external activity identity, produce one history row, and earn one block.

### What Crew sees

> **Crew sees only what the runner accepted into STACK, never the source mirror.**

Every projection path — `projectSharedRuns`, `projectMemberSummary`,
`projectionFingerprint` and both upsert paths in `useRaceCrew` — takes an
`AppState` and reads `state.runLogs` and `state.blockPlacements`. Historical
activity is not in `AppState`: it lives under its own account-scoped key
(`stack.history.activities.v1`), so Crew cannot project it.

That was a property of where a value happens to be stored. It is now a rule with
tests: the projected field list is asserted item by item, and syncing a year of
history leaves the Crew payload byte-identical to what it was before the sync.

### Language that stopped being true

- `BuildSummaryMetrics.totalActualMiles` was documented as *"every mile actually
  run"*. It is every mile the runner **recorded** — the tower's material, which
  is why Build says `miles built`. Runs owns how much the runner actually ran.
- `Every completed run earns a block` became `Every run you record earns a
  block` in the welcome sheet, the app tour, Getting Started and the Runs empty
  state, because with connected history a completed run can exist that earns
  none. Getting Started's Build destination answers *What have I built?*
- Crew's `Consistency` comparison is now **`Plan Runs Linked`** (`Linked` on the
  compact tab). Same window, same stored `consistency_completed` /
  `consistency_due` columns, same bars and ranking — only the display name moved.
  The reading is how much of the plan has a linked recorded run, and calling that
  `Consistency` presented a plan-link ratio as a quality of the runner, which is
  the reading NEXT-3 ranked last on Runs and NEXT-5 refused as Plan's headline.

### Boundaries this phase did not cross

No backfill of any kind, no historical activity in any Crew payload, no Supabase
migration, RLS change or new projected field, no change to how an accepted run
earns a block, no placement, gravity or footprint change, no persistence or
AppState migration, and no Plan, Today or Runs redesign.

### Tests

`src/history/buildCrewBoundary.test.ts` — a historical-only run earning no block
and reporting no placed block; the tower being identical whether or not a year of
history exists; one block for an accepted run that also has a source mirror; the
storage separation that keeps history out of `AppState`; the exact projected
field list; and a synced year of history leaving the Crew payload unchanged.

`npm run check` passes: 153 files, 1,886 tests.
## Cross Training — a sixth activity type (D-077)

`"cross"` joins `easy`/`intervals`/`simulation`/`long`/`race` as a full
`WorkoutType`/`RunActivityType`: `WORKOUT_TYPE_LABEL`, `ACTIVITY_TYPES`,
`ActivityIcon` (a `Dumbbell`), `ActivityTypePicker`, block height (2, in
`footprint.ts`'s `HEIGHT_BY_TYPE`, and mirrored in the Supabase
`crew_build_height()` function), and a new `--cross` CSS token threaded
through every `[data-type]` color site — chosen for hue clearance from both
the five existing activity colors and the sixteen-color runner-identity
palette (see the comment on `--cross` in `tokens.css`).

Because this union has no exhaustiveness check at every call site — several
consumers hold their own hand-rolled copy of the five running types as a
runtime `Set`/array/`switch` rather than importing `ACTIVITY_TYPES` — adding
the sixth type meant auditing and fixing each one directly rather than
trusting `tsc` to catch it: `src/crew/dashboard.ts`'s `activityTypeFrom` (would
have thrown "Race Crew returned an invalid activity type" for any teammate's
Cross Training run), `src/domain/trends.ts`'s Run Mix `activityOrder` (would
have silently dropped Cross Training miles from the chart legend while still
counting them in the total), and `src/storage/migrations.ts`'s
`validateCurrentAppState` allowlists (would have thrown
`InvalidAppStateError` and broken app load for any plan containing a Cross
Training workout).

**Distance is optional, and only for Cross Training.** Verified against a
real HIIT activity recorded on watch and synced through HealthFit on
2026-08-13: Intervals.icu reports `distance` and `icu_distance` as both
`null` for that source type. `runValidation.ts` lets Cross Training's
distance field go blank (stored as 0 miles); every other type still requires
a real distance greater than zero. The same relaxation runs through
`personalCloudRepository.ts`'s cloud round-trip and two Supabase `CHECK`
constraints (`shared_runs`, `personal_runs`), each widened from a flat
`distance_miles > 0` to a per-type rule alongside the `activity_type` check.

**The Intervals sync mapping never guesses.** Following the same policy that
kept the running allowlist (`VERIFIED_RUNNING_TYPES`) at exactly `Run` for
months, `VERIFIED_CROSS_TRAINING_TYPES` holds exactly one entry —
`HighIntensityIntervalTraining` — the literal string from that same August 13
capture. `normalizeIntervalsActivity` accepts either allowlist, and only
requires distance for the running one. `IntervalsCandidate.inferredActivityType`
(`easy` for a running source, `cross` for a cross-training one) replaces what
used to be a hardcoded `"easy"` fallback in `RunDataSheet.tsx`, so an
unmatched Cross Training import defaults its picker correctly instead of
silently landing on Easy.

**Cross Training Days** (`src/domain/crossTrainingDays.ts`,
`CrossTrainingDaysSheet.tsx`) is a new opt-in Settings preference, the
additive sibling of Run Days: choose weekdays, and STACK fills every rest
day landing on one of them with a Cross Training workout, across the whole
plan. Unlike Run Days, this never *moves* anything — it only fills days that
are currently rest, so there is no move/stuck reasoning to show, and an
empty selection is the normal state rather than an error one (most plans
want no Cross Training at all). Built on the existing `addPlannedRun` plan-
edit primitive rather than new geometry code, one rest day at a time, the
same way `applyRunDays` builds on `moveWorkout`. Applies automatically when a
plan is (re)generated from Race Setup, mirroring how the saved Run Days
preference already does.

Persisted as `AppState.crossTrainingDays: Weekday[] | null`, added to schema
9 without a version bump (mirroring how `runDays` itself was introduced) —
every legacy-schema upgrade path and the current-schema hydration path
default it to `null` when absent. Synced to Supabase alongside `runDays` in
`personal_training_state.cross_training_days`
(`20260818120000_cross_training_days.sql`), threaded through
`initialize_personal_stack`, `save_personal_training_state`, and
`reset_personal_stack`.

No RLS change: both new Supabase migrations extend existing tables/columns
under the same self-only policies and revision/generation-enforcing RPCs
Cross Training's data already lived under. Neither migration had been
applied to a live project, and Cross Training does not yet have a Docker/
Postgres-verified `supabase db reset` pass — see PR #115.

Deferred: `generateTrainingPlan()` itself has no concept of Cross Training —
it is purely a post-generation fill, applied the same way Run Days is. No
UI copy suggests a methodology (how many days, which ones); the runner
decides entirely.

## Crew and Today space pass — Avg Pace, Crew Profile doors, compact Today, Run Data states (issue #120)

The rule this pass applies throughout: **once STACK knows something happened,
it stops spending space confirming it happened, and uses that space to show
what the runner should do next.** No new product capability, no Supabase
migration, no AppState migration, no dependency.

### Crew Build carries a member rail, not a named legend

`CrewBuild.tsx` replaces the wrapping `Crew Build runners` legend with a
single icon-only row (`.crew-build__rail`). It never wraps: it scrolls
sideways once the crew is wider than the screen, so the tower keeps the
vertical space every extra legend row used to take. Each runner's existing
Runner Icon keeps its existing Crew accent, is a full 44px target, and opens
that runner's Crew Profile. Names live one tap away in the profile and,
permanently, in each control's accessible name. The viewer comes first
(`src/crew/memberOrder.ts`, which is `orderedMiniBuildMembers` renamed and
moved out of `miniBuild.ts`).

### Avg Pace replaces Consistency, for both crew types

`src/crew/avgPace.ts` computes trailing-28-day average pace per member as
**total duration ÷ total distance** over eligible shared runs — deliberately
not the mean of per-run paces, which would let a one-mile shakeout outvote a
twelve-mile long run. Cross Training, zero-distance and zero-duration
activities are excluded; a member with no eligible running is absent from
the map and reads as `—` rather than a fabricated `0:00`.

`comparisons.ts` therefore drops both `consistency` and `run-days` as
comparison metrics, and `src/crew/runDays.ts` is deleted: one set of four
metrics (Weekly Miles, Longest Run, Avg Pace, Miles Built) now serves a Race
Crew and a Run Club alike, because none of them needs a training plan.
`lowerIsBetter()` makes the direction explicit, `orderedComparisonRows()`
sorts by it, and `comparisonBest()` / `comparisonBarPercent()` draw a full
bar for the *best* reading on screen — so the fastest pace has the longest
bar even though its number is the smallest. `CrewMemberSummary` keeps
`consistencyCompleted` / `consistencyDue`: the projection still writes them
and no migration touches them; nothing displays them.

Crew Profile's third stat cell shows `Avg Pace · 28D` in place of the old
Race Crew / Run Club split, so the profile and the comparison tab finally
read the same measurement.

### Member mini Builds leave the main Crew page

The `The Crew` / `Member Builds` rail and `CrewMiniBuild.tsx` are deleted.
A per-member card for every runner grew without bound as the crew did and
duplicated what the tower, the comparisons and Crew Profile already say.
Nothing large replaces it: Crew Profile now has two consistent front doors —
the Crew Build member rail, and the runner identity in each comparison row
(a control, styled to stay a name rather than look like a button, so tapping
it can never be confused with switching the metric). The full individual
Build stays inside Crew Profile, unchanged, still read-only, still drawn with
`faceCulledMiniBuildTower` over the same frozen Personal placement.

### Crew sync state is the refresh icon

`crewSyncStatus()` in `src/crew/freshness.ts` returns `healthy` (green),
`syncing` (neutral, animated) or `attention` (amber — a failed refresh, or
numbers old enough to change what a comparison means), plus the whole status
in words for the control's `aria-label`. The visible `Updated 4m ago` copy
beside Refresh is gone; mild staleness stays quiet, because a comparison a
few minutes old is still the same comparison. Manual refresh is unchanged.

### Today's completed run is a line, not a card

`CompletedRunSummary.tsx` is now a title row, one facts line
(`3.08 mi · 33:56 · 11:01 /MI`), whichever placements the run still owes, and
a quiet `Edit`. The `RUN COMPLETE` treatment, the effort readout, the earned-
block chip, the "your Easy block is built into the tower" sentence and the
completed-state `View Build` action are all removed.

A logged run can owe two independent blocks (D-066), so Today offers each
only while it is owed: `Place Personal Block` while the Personal placement is
missing, `Place Crew Block` while that runner's own shared contribution is
still READY, both when both are, and neither once both are settled.

`src/crew/todayCrewBlock.ts` answers the Crew half from the loaded dashboard,
which is why `CrewSharedRun` now carries `localRunId` and `dashboard.ts`
reads `local_run_id` — the local STACK run id was already inside the approved
shared-run contract (it is how a projection finds the row it owns), so this
reads back a field the projection already writes rather than widening the
privacy boundary. `Place Crew Block` hands that shared run id to
`AppShell`, which switches to Crew and passes it as `placeCrewRunId`;
`CrewScreen` treats it as the placing run directly in render (no effect, no
state write) until the runner confirms, cancels or picks a different block,
at which point `onCrewPlacementHandled` retires it. A request that arrives
before the crew payload does simply waits for it, so the runner is never
dropped on the Crew page to hunt for their own READY block.

### Today's Run Found is a prompt

`RunFoundCard.tsx` states the run (`3.08 mi · 33:56`), what it looks like
(`Looks like 4×3 Min Tempo`) and a single `Review Run →`. Pace, heart rate,
`Extra Run`, `Not now` and `Ignore this run` are gone from the dashboard; the
match, activity type, effort, notes and ignore decisions all belong to Run
Data, which is one tap away. `RunDataReview` consequently loses `asExtra` —
Today no longer decides that — and `useConnectedSync`'s session-only
`dismiss` is deleted with the control that was its only caller.

### Run Data is two states, not one long page

`RunDataSheet.tsx` splits into a candidate state (connection, sync controls,
`Runs to Review` and the list) and a review state that **replaces** it. The
review used to render below the full candidate list, so tapping the first of
six runs opened a form the runner had to scroll past that list to reach —
on the first sync, when the list is longest. A quiet `← Back to runs` returns
to the remaining candidates when there are any; confirming a match or adding
an extra settles the run and returns to the list, or to the existing empty
state when nothing is left. Opening Run Data from Today's `Review Run` lands
directly in the review state with no list above it.


## 2026-08-18 — Crew Special Blocks

Crew now has a separate weekly award domain in addition to shared runs. `crew_award_blocks` stores immutable weekly winners and zero-mile Crew Build placement. The client derives privacy-safe scalar award scores locally, syncs only those scalars onto the runner's own `shared_runs` rows, and the server finalizes completed-week awards idempotently.

The shared Crew Build geometry is now a discriminated union of run rectangles and award rectangles. Both kinds collide with and support each other through the same eight-column placement rules, but `placedMiles` and Miles Built remain run-only. Production award rendering lives in `src/features/crew/AwardBrick.tsx` and `src/features/crew/awardBlock.css`; the winner's placement prompt and the award detail/move flow are wired through `CrewAwardsPanel`, `CrewAwardDetailSheet`, `useCrewAwards`, and `crewAwardsService`. There is no standings surface — ranking lives entirely in `finalize_crew_awards`.

See `docs/CREW_SPECIAL_BLOCKS.md` and D-080 for scoring, lifecycle, and the derived-scalar privacy exception.

## Crew Build cavity placement (issue #140)

Crew placement no longer delegates its offered positions to Personal Build's
skyline-only `placementOptions`. `src/crew/crewBuild.ts` scans from the ground
upward for each horizontal anchor and returns the first coordinate that passes
the existing mixed Crew validator. A supported, collision-free void beneath a
bridge is therefore selectable instead of being hidden by the bridge's
skyline.

Run blocks and Special Blocks use the same generator and the same
`canPlaceCandidate` authority, preserving grid bounds, mixed run/award
collision, support, and support-preserving move rules. The UI still receives
at most one option per horizontal anchor. Personal Build keeps its original
skyline/gravity behavior, with no migration or stored-coordinate change.
