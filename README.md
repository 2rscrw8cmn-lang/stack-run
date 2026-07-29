# STACK

**Build your race.**

STACK is a mobile-first running plan app that turns completed workouts into a growing 2D block structure. It is intentionally small, manual, and single-user.

![STACK UI reference](reference/stack-ui-reference.png)

## First-release scope

- OUC Half Marathon target: **December 5, 2026**
- Adjusted **18-week** plan beginning **August 3, 2026**
- Three tabs: **Today**, **Build**, and **Plan**
- Manual run completion
- Actual distance, duration, effort, and optional notes
- Deterministic 2D block structure
- Local browser persistence
- Dark-only responsive interface
- Mobile-first, desktop-usable

## Explicitly excluded

- Accounts or authentication
- Backend or database
- Strava integration
- Apple Health / HealthKit integration
- GPS, maps, routes, elevation, or heart rate
- Live run timer
- Social feed, friends, leaderboards, or sharing
- AI coaching or automatic training changes
- Drag-and-drop Tetris gameplay
- Canvas, WebGL, 3D rendering, or physics
- Multiple training plans in the first release

## Technical direction

- React
- TypeScript
- Vite
- Plain CSS with design tokens
- Lucide React icons
- Local storage through a small versioned repository module
- Static deployment to Vercel

React's official documentation recommends a build tool such as Vite for a from-scratch app, and Lucide provides individual tree-shakable React icon components. See `docs/TECHNICAL_REFERENCES.md`.

## Repository map

```text
/
├─ AGENTS.md
├─ START_HERE.md
├─ README.md
├─ docs/
├─ seed/
├─ reference/
└─ .github/
```

The application source tree is created during Phase 0.

## Build workflow

One phase equals one branch and one pull request.

```text
docs/foundation
feature/phase-0-foundation
feature/ui-1-shell
feature/ui-2-today
feature/ui-3-run-entry
feature/ui-4-build
feature/ui-5-plan
feature/ui-6-plan-adjustment
feature/phase-7-polish
```

Every phase must pass:

```bash
npm run check
```

The `check` script must run lint, tests, and a production build.
