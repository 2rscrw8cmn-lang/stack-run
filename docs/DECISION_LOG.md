# Decision Log

## D-001 — Product name

**Decision:** STACK  
**Tagline:** Build your race.

## D-002 — Product size

**Decision:** Three primary tabs only: Today, Build, Plan.

## D-003 — Data entry

**Decision:** All runs are entered manually.

**Reason:** The completion ritual is part of the product and removes integration complexity.

## D-004 — External fitness data

**Decision:** No Strava or Apple Health integration in v1.

**Reason:** STACK does not need activity-import infrastructure to fulfill its primary job.

## D-005 — Rendering

**Decision:** Deterministic 2D HTML/CSS blocks.

**Rejected:** 3D models, isometric perspective, canvas, WebGL, physics, drag/drop, Tetris gameplay.

## D-006 — Persistence

**Decision:** Versioned local browser storage.

**Rejected:** Auth, cloud database, sync, multi-user.

## D-007 — Plan

**Decision:** Add six foundation weeks ahead of the supplied 12-week plan.

**Plan dates:** August 3 through December 6, 2026.  
**Race:** Saturday, December 5, 2026.

## D-008 — Technology

**Decision:** React, TypeScript, Vite, plain CSS, Lucide React.

**Rejected:** Tailwind and component frameworks.

## D-009 — Theme

**Decision:** Dark-only for v1.

## D-010 — Rest days

**Decision:** Rest days appear in Plan but do not create Build blocks.

## D-011 — Workout adjustment

**Decision:** User may edit future workouts and move them within the same training week.

**Rejected:** Automatic adaptive coaching.

## D-012 — Deployment

**Decision:** Static Vercel deployment from GitHub.
