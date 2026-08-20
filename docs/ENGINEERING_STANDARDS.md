# Engineering Standards

## TypeScript

- Use strict TypeScript.
- No `any`.
- Prefer discriminated unions.
- Export domain types from `src/domain/types.ts`.
- Keep storage parsing separate from UI rendering.

## React

- Functional components only.
- Keep effects narrow and explain non-obvious effects.
- Do not mirror derived values in state.
- Do not optimize prematurely with `useMemo`, `useCallback`, or `React.memo`.
- Use controlled inputs in the run-entry and edit forms.
- Keep feature logic near the feature.

## CSS

- Plain CSS only.
- Use design tokens.
- Use component class names prefixed by feature when helpful.
- Avoid deeply nested selectors.
- No inline style objects except CSS custom properties for block color/span.
- No CSS-in-JS.
- No fixed phone-frame dimensions in the real app.
- Do not use `100vh` without accounting for mobile browser UI; prefer dynamic viewport units where needed.

## Components

Create a component only when it has:

- Repeated use,
- meaningful behavior,
- or a clear semantic boundary.

Do not create a wrapper component for every `div`.

## Accessibility

- All icon-only buttons have `aria-label`.
- Form inputs have visible labels.
- Dialogs and sheets manage focus.
- Escape closes a dismissible dialog.
- Clicking the backdrop closes only when data loss is not likely.
- Unsaved form content requires confirmation before dismissing.
- Use native inputs and buttons.
- Avoid custom select controls.
- Use `aria-current="page"` in bottom navigation.
- Use `aria-live="polite"` for completion feedback.

## Testing

### Unit tests

Required for:

- Duration parse/format
- Date helpers
- Current streak
- Total miles
- Completion status
- Storage load/save
- Migration behavior
- Run validation
- Same-week workout move rules

### Component tests

Required for:

- Today rest state
- Today run state
- Today completed state
- Complete Run validation and save
- Build filled versus outlined blocks
- Plan week navigation
- Workout edit and move confirmation

### Manual tests

Required at:

- 320 px width
- 390 px width
- 768 px width
- Desktop width
- Keyboard-only
- Reduced motion enabled
- Fresh storage
- Existing valid storage
- Corrupted storage

## Crew uploads

- Never send Crew a value the database is constrained to refuse.
- The projection is a single `upsert`: one refused row fails every run, for
  every crew, on every retry, and personal STACK stays healthy throughout, so
  nothing about the symptom points at the cause.
- Nullable column: mirror the CHECK on the device and send `null` instead.
- NOT NULL column: leave that run out of the batch via `isShareableWithCrew`.
- Report what was left behind. A run that is not reaching the crew is told to
  the runner, not discovered by comparing two screens.
- New constrained column means a new guard and a test that an out-of-range
  value is not sent. See `docs/CREW_PROJECTION_CONTRACT.md`.

## Scripts

Phase 0 must provide:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest",
    "preview": "vite preview",
    "check": "npm run lint && npm run test && npm run build"
  }
}
```

## Pull request size

Prefer small, reviewable phases.

A phase may include refactoring needed for that phase. It may not include unrelated cleanup.

## Documentation updates

After each implemented phase:

- Update `CURRENT_APPLICATION_STRUCTURE.md`.
- Update `PHASE_STATUS.md`.
- Update product docs only when a locked decision is intentionally changed by the product owner.
