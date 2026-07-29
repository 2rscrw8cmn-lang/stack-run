# Copy-Paste Agent Prompts

Use one prompt at a time. Do not combine phases.

---

## Phase 0 — Repository foundation

```text
You are implementing Phase 0 for the STACK repository.

Before changing anything, read:
- AGENTS.md
- START_HERE.md
- docs/PRODUCT_AND_SCOPE.md
- docs/ARCHITECTURE.md
- docs/DATA_AND_STORAGE.md
- docs/ENGINEERING_STANDARDS.md
- docs/IMPLEMENTATION_ROADMAP.md
- docs/CURRENT_APPLICATION_STRUCTURE.md

Goal:
Create only the repository and engineering foundation. Do not implement the real Today, Build, Plan, run-entry, or plan-editing UI.

Required work:
1. Scaffold the current stable Vite React TypeScript application in the repository root.
2. Add only the dependencies authorized by docs/ARCHITECTURE.md.
3. Configure strict TypeScript, ESLint, Vitest, jsdom, Testing Library, and the required npm scripts.
4. Create the documented source folder structure, but do not generate empty files that have no immediate purpose.
5. Add the domain types from docs/DATA_AND_STORAGE.md.
6. Implement safe local-date helpers and duration parse/format helpers with tests.
7. Implement a seed loader for seed/stack-training-plan-2026.json.
8. Implement the local storage repository skeleton and v1 migration behavior with tests.
9. Add CSS token and base files from docs/DESIGN_SYSTEM.md.
10. Render a minimal app shell with three placeholder tabs so the project can be visually smoke-tested.
11. Update docs/CURRENT_APPLICATION_STRUCTURE.md and docs/PHASE_STATUS.md.

Hard boundaries:
- No React Router.
- No Tailwind.
- No state library.
- No backend.
- No external API.
- No product UI beyond placeholders.
- No speculative dependencies or abstractions.

Verification:
- Run npm install.
- Run npm run check.
- Manually verify the app at mobile and desktop widths.

Deliver:
- A focused Phase 0 pull request.
- PR summary using the repository template.
- State any intentional difference from the docs.
```

---

## Phase 1 — UI-1 app shell

```text
Implement UI-1 only for STACK.

Read AGENTS.md and all required product/UI documents first. Use reference/stack-ui-reference.png as the visual reference.

Goal:
Deliver the responsive dark app shell and shared UI primitives. Product screens remain placeholders.

Required:
- STACK wordmark and tagline.
- Bottom navigation with Today, Build, Plan.
- House, Layers3, and ListChecks from lucide-react.
- Button, IconButton, Card, ProgressBar, Sheet, and FormField primitives.
- Design tokens and responsive app-width rules.
- Visible focus, semantic controls, and reduced-motion foundation.
- Placeholder content for all three tabs.
- Tests for tab navigation and key primitives.
- Update current application structure and phase status.

Do not:
- Build race cards.
- Build the run form.
- Build blocks.
- Build the plan list.
- Add a router or UI library.

Exit:
npm run check passes and the shell works at 320 px and desktop widths.
```

---

## Phase 2 — UI-2 Today

```text
Implement UI-2 only for STACK.

Read AGENTS.md, docs/UX_PRODUCT_SPEC.md, docs/TRAINING_PLAN_2026.md, and the UI-2 section of docs/UI_IMPLEMENTATION_PLAN.md.

Goal:
Implement the read-only Today experience using the real seed plan and local date.

Required:
- Race summary card.
- Race countdown.
- Today's run card.
- Rest day state.
- Completed state using existing run logs.
- Before-plan state.
- After-race state.
- Mark Complete opens a placeholder Sheet.
- Use the reference mockup hierarchy without adding extra metrics or icons.
- Unit tests for local-date selection and component tests for each state.
- Update documentation.

Do not:
- Save run data.
- Build the form.
- Build Build or Plan beyond existing placeholders.

Exit:
All Today states are tested and npm run check passes.
```

---

## Phase 3 — UI-3 Complete Run

```text
Implement UI-3 only for STACK.

Goal:
Complete the first functional vertical slice:
today's workout -> manual entry -> save -> refresh -> completed Today state.

Required:
- CompleteRunSheet.
- Required distance.
- Required duration accepting MM:SS or H:MM:SS.
- Required Rough / Solid / Great effort picker using Lucide Frown, Meh, Smile.
- Optional notes with 120-character counter.
- Validation from docs/DATA_AND_STORAGE.md.
- One log per workout; later saves update it.
- Persistence only through appStateRepository.
- Close guard for unsaved entries.
- Accessible success announcement.
- Component and repository tests.
- Update docs.

Do not:
- Add a timer.
- Add pace calculation.
- Add GPS or integrations.
- Add confetti.

Exit:
A run logs in under fifteen seconds, survives refresh, and npm run check passes.
```

---

## Phase 4 — UI-4 Build

```text
Implement UI-4 only for STACK.

Goal:
Deliver the core 2D stack visualization.

Required:
- Build summary metrics.
- One centered row per training week.
- One block per non-rest workout.
- Span mapping exactly as documented.
- Filled completed state.
- Outlined future state.
- Dashed past-incomplete state.
- Compact legend.
- Clickable and keyboard-accessible blocks.
- Workout detail sheet.
- Brief newest-block reveal animation and reduced-motion alternative.
- Plain HTML and CSS only for the structure.
- Tests for block count, states, spans, metrics, and interaction.
- Update docs.

Hard boundaries:
- No canvas.
- No SVG scene.
- No WebGL.
- No 3D.
- No drag/drop.
- No collision detection.
- No game loop.
- No physics or animation library.

Exit:
The full 18-week structure is legible at 320 px and npm run check passes.
```

---

## Phase 5 — UI-5 Plan

```text
Implement UI-5 only for STACK.

Goal:
Deliver the full dated plan review.

Required:
- Default to current week.
- Week number, phase, date range, completion count, and progress bar.
- Previous/next controls and current-week shortcut.
- Seven-day list.
- Clear run and rest row treatments.
- Full workout detail sheet.
- Log past incomplete workout.
- Edit completed run from details.
- Tests for navigation, boundaries, and completion states.
- Update docs.

Do not:
- Add plan editing yet.
- Add calendar month view.
- Add drag/drop.
- Add a dense desktop table.

Exit:
All 18 weeks are reachable and npm run check passes.
```

---

## Phase 6 — UI-6 Plan adjustment

```text
Implement UI-6 only for STACK.

Goal:
Allow controlled manual plan changes without creating an adaptive coaching engine.

Required:
- Edit a future workout.
- Move a future workout date.
- Confirm same-day workout conflicts.
- Preserve workout IDs.
- Prevent race workout deletion.
- Two-step reset confirmation.
- Reset exactly to the seed and remove logs.
- Limit moves to dates within the workout's existing training week.
- Unit tests for edit, same-week move, ID stability, and reset.
- Update docs.

Do not:
- Recommend changes.
- Automatically redistribute mileage.
- Automatically move missed workouts.
- Add AI.

Exit:
All destructive or broad changes are confirmed and npm run check passes.
```

---

## Phase 7 — UI-7 release

```text
Implement UI-7 only for STACK.

Goal:
Prepare the current product for personal production use.

Required:
- Final responsive and accessibility pass.
- Web app manifest.
- STACK app icons based on stacked rounded bars.
- Storage corruption recovery UI.
- Final empty/recovery states.
- Production metadata.
- Vercel documentation verification.
- Production smoke test checklist completion.
- Update README, current structure, and phase status.
- npm run check passes.

A service worker is optional and must not be added unless offline behavior is tested and the implementation remains simple.

Do not add any new product capability.
```

---

## Agent review prompt after each phase

```text
Review the current pull request against:
- AGENTS.md
- The active phase in docs/UI_IMPLEMENTATION_PLAN.md
- docs/QA_ACCEPTANCE.md

Focus on:
1. Missing acceptance criteria.
2. Product-scope drift.
3. Mobile usability at 320 px.
4. Accessibility failures.
5. Incorrect date or localStorage behavior.
6. Duplicate or stale derived state.
7. Unnecessary dependencies or abstractions.
8. Any 3D, game, physics, integration, or backend work that violates scope.

Run npm run check. Report findings by severity. Do not implement future phases.
```
