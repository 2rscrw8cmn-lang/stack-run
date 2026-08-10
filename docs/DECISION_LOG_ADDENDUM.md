# Decision Log Addendum — Post Connected Training

This addendum records approved decisions made after D-043. Where these decisions conflict with earlier entries in `docs/DECISION_LOG.md`, this addendum wins. Newer entries in this file win over older entries when they explicitly revise them.

## D-044 — Runs becomes the fourth primary destination; Settings returns to the header

**Decision:** Persistent bottom navigation is exactly Today / Build / Runs / Plan.

Runs owns chronological actual-run history. Settings remains a grouped sheet opened from an icon-only top-right gear and is not a primary destination.

Runs contains scheduled + extra, manual + synced actual activities and reuses the existing run-detail/edit/delete model.

**Supersedes:** D-002's three-tab count and D-041's bottom-bar Settings entry point.

## D-045 — Build is an object-first trophy + toy

**Decision:** Build's primary job is to make completed training tangible and satisfying. It is not a stats dashboard and not a puzzle game.

Locked boundaries:

- one block per actual run;
- continuous 8-column tower;
- width from actual distance;
- height from STACK activity type;
- deterministic valid landing positions;
- derived mileage labels on blocks where space permits;
- pointer/touch deliberate drag may commit on release;
- tap/keyboard remain complete alternatives;
- Race block may receive an earned capstone treatment;
- restrained CSS placement payoff;
- no scoring, line clears, combos, levels, coins, tower health, penalties, rotation, physics engine, canvas/WebGL or game loop.

**Revises:** D-024's always-press-Drop requirement for deliberate pointer/touch drag only. Accessibility boundaries remain.

## D-046 — Wellness / Recovery is intentionally deferred

**Decision:** UI-12 Wellness / Recovery Context is not part of the active roadmap.

If revisited later, D-038 remains mandatory:

- no opaque readiness score;
- no medical claims;
- no automatic plan changes;
- runner-relative neutral context only.

## D-047 — Training Trends lives on Runs as visible Training Signal summaries

**Decision:** Runs visibly surfaces training-data summaries above chronological history instead of hiding analytics behind repeated links.

UI-13 initially implemented these as a horizontal card strip where every card opened the same all-in-one `TrendsSheet`.

**Status:** presentation is implemented but the one-generic-sheet drill-down is superseded by D-048.

## D-048 — Trends 2.0 uses one focused detail per Training Signal

**Decision:** Training-data cards on Runs become **Training Signals** and each opens its own focused expanded view.

Approved signals:

1. Weekly Mileage
2. Long Run
3. Easy Pace
4. Heart Rate Zones
5. Training Load
6. Consistency
7. Run Mix

The old all-in-one `TrendsSheet` is retired once no active path depends on it.

The governing interaction is:

> summary → focused graph → underlying week/run

Where useful, a selected chart datum leads to the actual runs that produced it, then to existing run detail.

**Reason:** the existing generic drill-down repeats information already visible on the card and does not reward exploration.

**Supersedes:** D-047's rule that every card opens the same existing full Trends sheet. D-047's principle that Runs is the canonical analytics home remains.

## D-049 — Plan-versus-actual is a primary analytical advantage

**Decision:** Trends 2.0 should compare actual training with the active plan where that comparison answers a useful question.

Required examples:

- Weekly Mileage actual vs planned weekly target;
- Long Run actual vs planned Long Run target.

Planned/actual trend totals remain derived, not persisted.

Partial current weeks must not be framed as failed or regressing simply because they are incomplete.

**Reason:** STACK owns an editable race plan in addition to actual activity data. Using that relationship creates more value than copying a generic activity dashboard.

## D-050 — Heart-rate zone composition uses donut/pie presentation

**Decision:** Run-detail HR-zone distribution changes from horizontal bars to an accessible donut/pie composition.

Rules:

- dynamically support however many zones the source supplies;
- keep a textual legend with zone label, duration and percentage;
- source zero zones may remain listed as honest zeroes but occupy no donut angle;
- color is never the only identifier;
- aggregate HR-zone Training Signal/detail may also use donut composition;
- no zone is labeled inherently good/bad.

UI-17 formalizes the ordered zone color palette.

**Supersedes:** the UI-11 presentation choice to use one-hue horizontal `ZoneBars`. Data semantics remain unchanged.

## D-051 — Generic manual Log Run leaves Today

**Decision:** Remove the standalone generic `Log Run` button/band from Today.

Preserve:

- scheduled Mark Complete/Edit on Today;
- Run Found on Today;
- manual `Log Run` on Runs;
- manual logging as a complete product fallback.

**Reason:** Runs is now a primary pillar and the natural home for generic history entry. Today should remain the daily command center rather than duplicate history actions.

## D-052 — Performance Arcade is the approved visual direction

**Decision:** STACK evolves toward a **modern training computer with arcade DNA**.

Target balance:

- ~70% current polished STACK;
- ~20% performance-arcade/training-computer character;
- ~10% playful reward moments.

Approved cues:

- stronger data typography;
- local system-monospace/tabular numerals;
- short uppercase machine labels;
- technical grid texture inside data regions;
- block-inspired chart geometry;
- brighter/confident use of existing activity colors;
- factual accomplishment moments;
- restrained motion.

Rejected cues:

- literal Game Boy/device shell;
- CRT/scanlines;
- pixel font across normal UI;
- pixel icons;
- D-pad/A-B controls;
- boot/power metaphor;
- sound/chiptune;
- selectable retro palettes;
- fake terminal commands.

**Reason:** the app should feel like specialized running equipment, not retro cosplay.

## D-053 — Arcade influence does not create a second game economy

**Decision:** Running itself remains the achievement.

Approved deterministic accomplishment moments may include:

- New Longest Run;
- Biggest Week;
- Four Weeks Consistent;
- meaningful Miles Built thresholds.

Do not add XP, coins, levels, quests, loot, arbitrary score, streak punishment or other economy mechanics.

Prefer transient derived presentation rather than a persistent badge collection.

## D-054 — TRNRBOI-8000 is reference material only

**Decision:** `drewwest289/TRNRBOI-8000` may inform product/design exploration but is not an engineering dependency or source to copy.

Do not copy its source, assets, Strava architecture, Game Boy shell, Tailwind/Recharts choices, backend patterns or calculations by default.

STACK implements approved ideas independently using its own design/data/engineering system.

## D-055 — Race Crew is an invite-only race-centered social layer inside Runs

**Decision:** Race Crew is approved as a future product program, beginning with an architecture gate.

Race Crew lives inside Runs using:

```text
YOU | CREW
```

It is not a fifth bottom-nav tab.

Initial product direction:

- invite-only;
- crew centered on race name/date/distance;
- no public discovery;
- no follower/following graph;
- no DMs;
- recent crew runs;
- selected factual comparison metrics;
- lightweight encouragement later;
- compact member Build views later.

Approved initial comparison concepts:

- Weekly Miles;
- Longest Run;
- Consistency;
- Miles Built.

Raw pace leaderboard is not part of MVP.

## D-056 — Race Crew shares a narrow safe projection, not private health data

**Decision:** Crew members may see a deliberately limited shared run/training summary.

Default shareable run facts:

- display name;
- local run date;
- STACK activity type;
- distance;
- duration;
- derived pace.

Do not share by default:

- GPS/routes/location;
- exact start time;
- HR/max HR;
- HR-zone data;
- Training Load;
- wellness data;
- effort;
- notes;
- Intervals external ids;
- credentials;
- raw source payloads;
- private calendar/availability data.

A crew-safe run-detail model must be separate from blindly exposing the owner's complete private Run detail.

## D-057 — Multi-user Race Crew requires an architecture gate before production code

**Decision:** UI-18 is an explicit Race Crew architecture/research gate.

Current STACK assumptions cannot be casually extended:

- localStorage-only AppState;
- no account identity;
- no shared database;
- one owner's server-side personal `INTERVALS_API_KEY`;
- one local sync token.

UI-18 must resolve and receive owner approval for:

- managed authentication;
- shared datastore/authorization;
- current official Intervals.icu multi-user/OAuth behavior;
- per-user token handling/revocation;
- current-owner no-loss migration/adoption;
- minimal private-to-shared data projection;
- invite/membership lifecycle;
- privacy deletion/leave behavior;
- security tests and operating cost.

No production account/social/backend implementation is authorized in UI-18.

**Reason:** Race Crew is valuable, but it changes the app's trust and persistence model. That deserves a deliberate architecture decision rather than incremental hacks around the current personal credential.

## Active implementation order

Implemented/accepted:

- UI-0 through UI-11
- UI-13 — Runs Pillar + Navigation
- UI-14 — Build Reward Revision

Deferred/skipped:

- UI-12 — Wellness / Recovery Context
- UI-15 — Optional Plan Export Investigation

Next approved program:

1. **UI-16 — Trends 2.0** (D-048 through D-051)
2. **UI-17 — Performance Arcade Design Pass** (D-052 through D-054)
3. **UI-18 — Race Crew Architecture Gate** (D-055 through D-057; docs/research only)

Race Crew production phases UI-19+ remain gated on UI-18 owner approval.

See:

- `docs/NEXT_PRODUCT_PROGRAM.md`
- `docs/TRENDS_2_0.md`
- `docs/ARCADE_DESIGN_PASS.md`
- `docs/RACE_CREW.md`
- `docs/NEXT_PRODUCT_IMPLEMENTATION.md`
