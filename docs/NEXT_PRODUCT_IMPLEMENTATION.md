# Next Product Program — Implementation Plans + Agent Prompts

Read `docs/NEXT_PRODUCT_PROGRAM.md` first.

This file turns the approved product direction into controlled delivery phases.

## Program status

- UI-0 through UI-14: implemented/accepted.
- UI-15 Optional Plan Export Investigation: deferred; no code authorization.
- **UI-16 Trends 2.0: next approved code phase.**
- **UI-17 Performance Arcade Design Pass: approved after UI-16.**
- **UI-18 Race Crew Architecture Gate: approved docs/research phase after UI-17. No production social code.**
- UI-19+ Race Crew production phases: gated on UI-18 owner approval.

Use one branch/PR per phase.

---

# UI-16 — Trends 2.0

## Goal

Replace the shallow all-trends drill-down with focused Training Signal modules that answer a real question, visualize more of the data STACK already has, and let the user get from a summary to the underlying run/week.

## Required implementation

### Runs / Training Signals

- Replace/upgrade the current card strip into the responsive Training Signals presentation specified in `docs/TRENDS_2_0.md`.
- Approved signals: Weekly Mileage, Long Run, Easy Pace, HR Zones, Training Load, Consistency, Run Mix.
- Omit signals that require unavailable data rather than showing fake zeros.
- Every card opens a signal-specific detail view.
- Remove the one generic callback pattern where all cards open the same `TrendsSheet`.

### Detail architecture

Prefer a shared shell such as `TrendDetailSheet` plus signal-specific content/components rather than seven unrelated modal implementations.

Suggested state model:

```ts
type TrainingSignalId =
  | "weekly-mileage"
  | "long-run"
  | "easy-pace"
  | "hr-zones"
  | "training-load"
  | "consistency"
  | "run-mix";
```

Runs owns the selected signal state or delegates it to one focused controller.

Do not add a router for this.

### Weekly Mileage

- 12-week actual columns.
- planned weekly mileage reference.
- current/latest, 4-week average, plan and delta facts.
- partial-current-week handling.
- selectable week → list runs that created the week → existing Run detail.

### Long Run

- actual Long Run progression.
- planned Long Run reference.
- latest / longest / change from prior / next planned facts.
- selectable actual point → existing Run detail.

### Easy Pace

- latest-4 median versus previous-4 median when 8+ Easy runs exist.
- Easy pace history.
- Easy average-HR history aligned to actual runs where available.
- neutral low-data states.
- descriptive comparison only; no efficiency score/readiness claim.

### HR Zones

- Replace `ZoneBars` presentation in actual-run detail with accessible donut/pie distribution.
- Keep textual duration + percentage legend.
- Support source zone count dynamically, including the currently verified seven-entry array.
- Keep source zero zones visible in the legend if the current product behavior intentionally preserves them; zero occupies no donut angle.
- Add aggregate recent-zone Training Signal/detail with explicit coverage.

### Training Load

- Use only verified `importedMetrics.trainingLoad`/equivalent existing normalized field.
- Sum by plan week for runs that carry it.
- compare with recent 4-week average only with enough coverage.
- selected week can list per-run load.
- omit missing values rather than zeroing.
- label source/meaning quietly; no readiness score.

### Consistency

- preserve scheduled-completion semantics.
- expanded view uses plan-week completion grid.
- extra runs remain separate and never repair missed scheduled workouts.

### Run Mix

- last-4-week actual miles by STACK activity type.
- donut + textual legend with miles/run count/share.
- no Extra segment.

### Today cleanup

- Remove the generic `Log Run` band/button from Today.
- Keep scheduled Mark Complete/Edit.
- Keep Run Found.
- Keep Log Run on Runs.

### Old Trends sheet

- Retire/remove old all-in-one `TrendsSheet` once no path depends on it.
- Reuse selectors/helpers where appropriate; do not keep duplicate presentation paths.

## Engineering boundaries

- expected schema remains 9;
- no trend totals persisted;
- no chart library without an explicit new decision;
- no wellness endpoint;
- no raw stream ingestion;
- no social code;
- no Intervals writes;
- no AI/race prediction/readiness.

## Verification

- unit tests for all new selectors/comparisons/coverage rules;
- card → correct detail tests for every signal;
- chart selection → correct week/run tests;
- HR donut with 1, 5 and 7 zones plus zero zones;
- missing training-load/HR data omitted, never zero;
- 320 / 390 / desktop visual checks;
- keyboard/focus/escape/nested-detail behavior;
- reduced motion;
- `npm run check`.

## Copy/paste agent prompt — UI-16

```text
Implement UI-16 — Trends 2.0.

Read first, in authority order:
- START_HERE.md
- docs/PRODUCT_AND_SCOPE.md
- docs/NEXT_PRODUCT_PROGRAM.md
- docs/TRENDS_2_0.md
- docs/CONNECTED_DATA_FIELDS.md
- docs/UX_PRODUCT_SPEC.md
- docs/DATA_AND_STORAGE.md
- docs/DECISION_LOG_ADDENDUM.md
- docs/ENGINEERING_STANDARDS.md
- docs/NEXT_PRODUCT_IMPLEMENTATION.md
- docs/CURRENT_APPLICATION_STRUCTURE.md

Goal:
Turn Runs Training Signals into real drill-down analytics. Each card opens its own focused detail; use more of STACK's existing plan/run/imported data; make plan-vs-actual central; change HR-zone distribution from bars to an accessible donut; remove generic Log Run from Today.

Required:
1. Training Signals on Runs: Weekly Mileage, Long Run, Easy Pace, HR Zones, Training Load, Consistency, Run Mix.
2. Every signal has its own detail module. Do not route every card to the old full Trends sheet.
3. Weekly Mileage: 12-week actual vs planned, 4-week average/current/plan/delta, selectable week → underlying runs.
4. Long Run: actual vs planned progression, latest/longest/prior delta/next target, actual point → run detail.
5. Easy Pace: recent-4 vs previous-4 median comparison when covered; pace graph + aligned Easy HR graph/context.
6. HR Zones: replace ZoneBars in run detail with dynamic accessible donut/pie + text legend; aggregate recent-zone signal/detail with coverage. Preserve honest source zero zones in legend.
7. Training Load: weekly totals and recent comparison using existing verified imported metric only; no readiness/form score.
8. Consistency: plan-week completion grid; extras do not repair plan completion.
9. Run Mix: last-4-week actual miles by activity type as donut + text legend.
10. Remove generic Log Run button/band from Today. Keep scheduled completion, Run Found and Runs > Log Run.
11. Retire the old all-in-one TrendsSheet once unused.
12. Keep all analytics derived. Schema should stay 9.

Hard boundaries:
- no Recharts/D3/chart.js unless owner separately approves
- no wellness/recovery
- no race prediction/readiness/AI coaching
- no social/Race Crew code
- no Intervals writes
- no raw workout-stream ingestion
- no invented zeros for missing imported fields

Use small reusable SVG/CSS chart primitives and accessible text alternatives. Charts must work at 320px and selected data must be usable by touch + keyboard.

Run npm run check. Update CURRENT_APPLICATION_STRUCTURE, PHASE_STATUS and any impacted QA docs. One phase only; do not perform the global Arcade restyle in this PR.
```

---

# UI-17 — Performance Arcade Design Pass

## Goal

Apply the approved modern-training-computer visual language across STACK without changing the product architecture or turning it into a literal retro game.

## Required implementation

### Design tokens

Introduce/refine reusable CSS tokens for:

- data/mono font stack;
- machine-label typography;
- stronger data borders/backgrounds;
- technical-grid line;
- semantic status colors if needed;
- seven-zone HR palette;
- chart actual/reference/selection treatment.

Prefer existing color tokens where possible. Do not create a huge parallel design system.

### Shared data components

Create/refine small primitives rather than styling each screen independently, for example:

- `DataValue` / data-number class;
- machine/system label class;
- `DataModule` surface;
- `TechnicalGrid`/chart-background class;
- selected chart datum treatment;
- accomplishment banner/module.

Names are implementation choices; behavior/visual consistency is not.

### Runs/Trends

This is the strongest expression of the new language.

- stronger mono/tabular stats;
- compact technical Training Signal modules;
- subtle chart grids;
- blocky columns/crisp points;
- stronger categorical donut colors;
- tap/focus selected states;
- keep run history calmer/readable.

### Today

- keep current hierarchy;
- strengthen date/race/workout labels as mission briefing;
- allow short system labels such as TODAY / RUN FOUND / THIS WEEK;
- no new analytics wall.

### Build

- refine existing object-first Build with the new data/stamp/grid language;
- no geometry/persistence change;
- existing payoff remains restrained;
- mileage labels may look stamped/technical.

### Plan

- subtle adoption only;
- machine week labels/tabular numbers/workout accents;
- preserve schedule readability.

### Factual accomplishments

Implement only deterministic approved candidates from `ARCADE_DESIGN_PASS.md` if they can be derived cleanly without a speculative badge system:

- New Longest Run;
- Biggest Week;
- Four Weeks Consistent;
- Miles Built milestone.

Do not add XP/levels/coins/quests.

If repeat suppression requires a schema change, stop and document the requirement before migrating.

### Explicit rejection

No:

- Game Boy shell;
- D-pad/A-B controls;
- scanlines/CRT;
- pixel icons;
- pixel font across UI;
- boot screen;
- sound/chiptune;
- selectable retro palettes;
- fake terminal UI.

## Verification

- 320 / 390 / desktop screenshots for Today, Runs/Trends, Build and Plan;
- contrast audit of new small labels/data surfaces;
- zone colors readable with labels;
- no grid harms readability;
- reduced motion;
- keyboard focus remains clear;
- no new horizontal overflow;
- no schema change unless separately approved;
- `npm run check`.

## Copy/paste agent prompt — UI-17

```text
Implement UI-17 — Performance Arcade Design Pass.

Read first:
- START_HERE.md
- docs/PRODUCT_AND_SCOPE.md
- docs/NEXT_PRODUCT_PROGRAM.md
- docs/ARCADE_DESIGN_PASS.md
- docs/TRENDS_2_0.md
- docs/UX_PRODUCT_SPEC.md
- docs/DECISION_LOG_ADDENDUM.md
- docs/ENGINEERING_STANDARDS.md
- docs/NEXT_PRODUCT_IMPLEMENTATION.md
- docs/CURRENT_APPLICATION_STRUCTURE.md

Goal:
Make STACK feel like a modern training computer with arcade DNA while preserving the current product, readability and architecture. The owner approved the direction documented in ARCADE_DESIGN_PASS.md.

Required:
1. Keep body/instruction text in the readable system sans. Add a local system-monospace/tabular data language for numbers and short machine labels.
2. Introduce a small coherent set of CSS tokens/classes/primitives for data modules, labels, technical chart grids and selected states.
3. Runs/Trends gets the strongest treatment: bold data, subtle technical grids, block-inspired charts, stronger accent use, colored donuts.
4. Today becomes slightly more mission-briefing-like without adding analytics or changing hierarchy.
5. Build gets compatible technical/stamped/grid refinements without changing block geometry or storage.
6. Plan adopts the language lightly and remains the calm schedule surface.
7. Formalize accessible colors for dynamic HR zones up to seven source zones.
8. Add only the factual accomplishment moments approved in the design spec if they can be derived cleanly; no persistent badge economy.
9. Respect reduced motion and contrast.

Do not:
- make a Game Boy/CRT skin
- add pixel fonts/icons/scanlines/hardware controls
- add sound
- add Tailwind/UI framework
- copy TRNRBOI source/assets
- change AppState/schema unless explicitly documented and approved
- add Race Crew/backend work
- add XP/coins/levels/quests

Run npm run check and perform 320/390/desktop visual review. Update CURRENT_APPLICATION_STRUCTURE and PHASE_STATUS. One phase only.
```

---

# UI-18 — Race Crew Architecture Gate

## Goal

Produce an owner-reviewable architecture/product implementation plan for Race Crew before production account/social code is written.

UI-18 is deliberately a gate because the current single-user local/personal-key architecture cannot be safely stretched into multi-user social behavior.

## Required outputs

UI-18 should update/create documentation covering:

1. authentication-provider recommendation and tradeoffs;
2. shared-database recommendation and authorization model;
3. verified current official Intervals.icu multi-user/OAuth requirements;
4. token/credential storage and disconnect/revocation design;
5. local AppState versus shared-server projection decision;
6. current-owner no-loss migration/adoption flow;
7. crew/invite/member lifecycle;
8. crew-safe SharedRun data contract;
9. leave/remove/delete privacy lifecycle;
10. exact UI-19/UI-20/UI-21 implementation plan;
11. cost/operational complexity for a small private group;
12. threat/security checklist.

A narrow throwaway local spike is allowed only if needed to verify an unknown SDK/API behavior. Do not merge production auth/database/social feature code in UI-18.

## Required product constraints

- Race Crew lives under Runs as YOU | CREW, not a fifth nav item.
- invite-only;
- race-centered, no follower graph;
- no public discovery;
- no GPS/routes/HR/zones/load/notes shared by default;
- no raw pace leaderboard in MVP;
- comparisons limited to approved factual training metrics;
- lightweight reaction later; comments separately reviewable;
- existing local user data must not be lost;
- current personal Intervals API key cannot be treated as a multi-user credential.

## Copy/paste agent prompt — UI-18

```text
Perform UI-18 — Race Crew Architecture Gate. This is a research/docs phase, NOT production social implementation.

Read first:
- START_HERE.md
- docs/PRODUCT_AND_SCOPE.md
- docs/NEXT_PRODUCT_PROGRAM.md
- docs/RACE_CREW.md
- docs/INTERVALS_INTEGRATION.md
- docs/DATA_AND_STORAGE.md
- docs/DECISION_LOG_ADDENDUM.md
- docs/ENGINEERING_STANDARDS.md
- docs/NEXT_PRODUCT_IMPLEMENTATION.md
- docs/CURRENT_APPLICATION_STRUCTURE.md

Goal:
Design the smallest secure architecture that lets a few friends training for the same race use Race Crew without exposing private health/location data or losing the current owner's local STACK data.

Research/decide:
1. Managed authentication recommendation; no custom passwords.
2. Minimal shared database + row/member authorization approach.
3. CURRENT OFFICIAL Intervals.icu multi-user/OAuth behavior. Use only official/primary sources for technical claims. Verify flow, token exchange/storage/refresh/revocation/scopes and PKCE/server requirements instead of guessing.
4. How each user connects their own running data. The current single owner's INTERVALS_API_KEY architecture must not be reused as a shared credential.
5. Whether personal AppState stays local while a narrow crew-safe projection is server-shared, or whether a broader cloud-sync change is justified. Prefer minimum shared data.
6. No-loss migration/adoption for the current schema-9 owner's local runs/plan/Build.
7. Crew create/join/invite/leave/remove/delete lifecycle.
8. Exact SharedRun fields; exclude GPS, HR, HR zones, load, effort, notes, external IDs and raw payloads by default.
9. Authorization/security test plan.
10. Cost/complexity for a very small private user base.
11. Proposed UI-19 Account + Crew Foundation, UI-20 Crew Runs + Comparisons and UI-21 Reactions + Mini Builds scopes.

Product constraints:
- Race Crew is YOU | CREW inside Runs, not a fifth tab.
- Invite-only, same-race-oriented.
- No follower graph/public profiles/public discovery/DMs.
- Initial comparisons: Weekly Miles, Longest Run, Consistency, Miles Built.
- No raw pace leaderboard in MVP.
- Comments are not required in the first social release.

Deliver docs and, if necessary, a clearly isolated non-production spike only. Do not merge production auth/database/social functionality. End with specific owner decisions needed before UI-19 can begin.
```

---

# UI-19+ — Race Crew production work

No production prompt is authorized yet.

After UI-18 is reviewed, the owner will either:

- approve/revise the architecture and unlock UI-19;
- narrow Race Crew;
- or defer the social program.

Do not allow an agent to infer production backend choices from `RACE_CREW.md` alone.
