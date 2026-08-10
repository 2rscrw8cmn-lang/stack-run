# Race Crew — Product Specification + Architecture Gate

Status: **Approved product direction. Production implementation is gated behind UI-18 architecture approval.**

## Product idea

Race Crew is a small, invite-only social layer for runners training for the same race.

It is not a public social network and not a replacement for Strava.

The job is simple:

> Let a few friends training for the same race see that the others are doing the work, compare a few fair training signals, and encourage each other without exposing private health/location data.

## Product placement

Race Crew does **not** become a fifth bottom-navigation destination.

Runs remains the factual training/history pillar.

When Race Crew exists, Runs gains a top-level segmented context:

```text
YOU | CREW
```

### YOU

Current personal Runs experience:

- Training Signals;
- chronological run history;
- run detail;
- Log Run.

### CREW

Private group experience:

- crew race/header;
- selected training comparisons;
- recent crew runs;
- lightweight encouragement;
- later, compact member Build views.

Switching between YOU and CREW does not change the persistent bottom-nav destination; Runs remains active.

## Crew model

Race Crew is centered on a race, not on public following.

MVP assumptions:

- crew has a name;
- crew has race metadata (name, date, distance);
- crew is invite-only;
- one owner/admin creates the crew;
- members join through a private invite link/code;
- a runner can participate without the crew changing their personal training plan;
- if the member's active race does not match crew race date/distance, STACK warns but does not silently rewrite anything.

The first intended real-world use is a few friends preparing for the same OUC Half Marathon.

## What crew members may see

Default shared run summary:

- display name;
- local run date;
- STACK activity type;
- distance;
- duration;
- derived pace;
- whether it was a Race activity when applicable.

Potential shared training summary:

- this-week actual miles;
- recent longest run;
- scheduled consistency percentage;
- total miles built;
- compact Build snapshot in a later phase.

## Private by default

Do **not** share through Race Crew by default:

- GPS coordinates;
- route/map;
- exact home/work location;
- exact activity start time unless explicitly justified later;
- average/max heart rate;
- HR-zone distribution;
- training load;
- sleep/HRV/resting HR;
- effort selection;
- freeform notes;
- Intervals external id;
- Intervals API/OAuth credentials;
- raw upstream activity payload;
- calendar availability data;
- plan conflict/calendar subscription details.

The fact that STACK can see a metric does not mean a crew member should see it.

## Crew home

The CREW view should feel compact and encouraging.

Recommended order:

### 1. Crew race header

Example:

```text
OUC HALF CREW
DEC 5 · HALF MARATHON
5 RUNNERS
```

Keep it factual. No public member count/follower language.

### 2. Comparison module

Selectable comparison metrics may include:

- **Weekly Miles** — actual miles in the current local plan/race week;
- **Longest Run** — longest actual run over a clearly labeled recent period;
- **Consistency** — scheduled completion percentage over a clearly defined period;
- **Miles Built** — total actual miles represented in STACK Build for the active plan.

The product is encouragement-first, not competition-first.

Do not ship an overall rank/score combining metrics.

### Pace leaderboard

Do not include raw/faster-is-better pace leaderboard in the initial Race Crew release.

Reasons:

- ability levels differ;
- workout purposes differ;
- faster pace is not always better training;
- it can incentivize running Easy days incorrectly.

A future carefully normalized personal-improvement comparison may be investigated separately.

### 3. Recent Crew Runs

Newest shared runs from crew members.

Each row/card:

```text
DREW
LONG RUN · AUG 9
6.1 MI · 58:42 · 9:37 /MI
```

Tap opens a **crew-safe** activity detail, not the owner's private `RunResultDetail` wholesale.

Crew-safe detail may show only fields approved for sharing.

### 4. Lightweight encouragement

Initial direction: one lightweight reaction system rather than full social mechanics.

Use a normal Lucide icon and text label; do not use emoji as the only UI.

Possible label: `Props` or similar final owner-approved wording.

A member can react once/toggle reaction on a shared run.

Do not add follower counts, public likes, popularity scores or algorithms.

### Comments

Comments are valuable but add moderation, deletion and notification complexity.

Treat comments as a separately approved follow-up within the Race Crew program, not a requirement for the first social release.

## Member summary

Tapping a crew member may later show a simple private-crew profile:

- display name/initials or optional avatar;
- this-week miles;
- recent longest run;
- consistency;
- recent shared runs;
- small Build visualization when that feature is approved.

No follower/following model.

## Mini Builds

STACK has a unique social artifact TRNRBOI does not: the Build tower.

A later Race Crew phase may show each member's compact Build.

Rules:

- read-only to other members;
- no placement manipulation of another member's tower;
- no ranking by tower shape;
- may show miles built + simplified block structure;
- shared geometry must not require sharing private health metrics.

A collective Crew Build is an interesting future concept but **not MVP**.

## Social boundaries

Race Crew explicitly does not become:

- public profiles;
- public race discovery;
- follower/following graph;
- direct messages;
- open comments from strangers;
- social feed ranking algorithm;
- public leaderboard;
- public location sharing;
- challenges/XP/coins;
- betting/wagers;
- coaching comparison engine.

## Race Crew + Performance Arcade

Race Crew should use the approved Performance Arcade language after UI-17:

- compact mono data;
- strong member/metric modules;
- clear selected comparison mode;
- factual labels such as `THIS WEEK`, `LONGEST RUN`, `MILES BUILT`;
- restrained celebratory states.

Do not make social competition visually louder than personal training.

## Why UI-18 is an architecture gate

Current STACK is intentionally single-user:

- AppState is localStorage;
- there is no account identity;
- there is no shared database;
- the Vercel Intervals proxy uses one owner's server-side personal API key;
- the browser holds a separate local STACK sync token.

That architecture cannot simply be expanded to multiple friends.

Race Crew requires an explicit trust/identity design before production code.

## UI-18 required decisions

UI-18 is docs/research/spike work and must resolve the following before UI-19 starts.

### 1. Authentication provider

Choose a simple managed account system suitable for a small private app.

Evaluation must cover:

- email/magic-link or similarly low-friction login;
- session handling in a Vercel web app;
- account deletion;
- user identity for database authorization;
- local-development/testing path;
- cost at a small number of users;
- minimal operational burden.

Do not build custom password authentication.

### 2. Shared data store

Choose the smallest managed database pattern that supports:

- users;
- crews;
- membership/invites;
- shared run summaries;
- reactions;
- later optional comments/build summaries;
- row/user authorization.

A provider with strong row-level authorization may be attractive, but no provider is locked by this product spec.

### 3. Per-user Intervals authorization

The existing server environment variable `INTERVALS_API_KEY` is a personal single-user credential and **must not become the credential for every Race Crew member**.

Before coding multi-user sync, UI-18 must verify and design the supported Intervals.icu multi-user authorization path.

Investigate:

- OAuth 2.0 support and current official flow requirements;
- token storage/refresh behavior;
- scopes/capabilities;
- whether PKCE is supported/needed;
- server-side exchange requirements;
- revocation/disconnect;
- how athlete identity maps to STACK user identity.

Do not assume the current personal API-key proxy can be reused unchanged.

### 4. Personal AppState ownership

Decide whether Race Crew introduces full cloud sync of personal STACK AppState or keeps personal plan/history local while sharing a narrow server projection.

Preferred starting principle:

> **Share the minimum crew projection, not the entire private AppState.**

A likely MVP approach is:

- personal plan/Build/run detail remains owned by the user;
- server stores only crew-safe shared summaries required for social features;
- private imported health metrics stay outside crew records.

But UI-18 must verify how account/device behavior remains coherent.

### 5. Existing owner's migration

Design a zero-loss path for the current owner when accounts arrive.

Requirements:

- existing schema-9 local AppState is never silently discarded;
- first authenticated session can adopt/link current local data or explicitly keep it local;
- no duplicate runs/blocks;
- no forced reset to join Race Crew.

### 6. Invite security

Decide:

- invite link/code format;
- expiration/revocation;
- whether invite tokens are stored hashed;
- who can invite/remove members;
- how leaving/removal immediately revokes crew access.

### 7. Authorization model

Every shared-data endpoint/query must enforce membership server-side/database-side.

Never rely only on hidden UI.

A user may read:

- their own account data;
- crews they actively belong to;
- shared run summaries from active members of those crews.

### 8. Privacy lifecycle

Define behavior when:

- a user leaves a crew;
- owner removes a member;
- a shared run is deleted locally;
- a user deletes their account;
- a crew is deleted.

Preferred principle: removed membership immediately removes visibility of that runner's crew-shared data.

## Proposed logical data model for architecture review

This is conceptual, not a locked database schema.

```ts
User {
  id
  displayName
  createdAt
}

Crew {
  id
  ownerUserId
  name
  raceName
  raceDate
  raceDistanceMiles
  createdAt
}

CrewMember {
  crewId
  userId
  role // owner | member
  joinedAt
}

SharedRun {
  id
  userId
  crewId
  localDate
  activityType
  distanceMiles
  durationSeconds
  createdAt
  updatedAt
}

CrewReaction {
  sharedRunId
  userId
  kind
  createdAt
}
```

Derived pace is not necessarily stored.

Private health metrics are intentionally absent.

## Post-gate implementation outline

### UI-19 — Account + Crew Foundation

Only after UI-18 owner approval.

Expected outcomes:

- authentication;
- account identity;
- create/join/leave crew;
- invite flow;
- race metadata/mismatch warning;
- narrow shared-run projection pipeline;
- security tests;
- migration/adoption path for current owner's local data.

No leaderboard/reactions until foundation is proven.

### UI-20 — Crew Runs + Comparisons

Expected outcomes:

- `YOU | CREW` switch inside Runs;
- weekly miles / longest run / consistency / miles built selectors;
- recent crew runs;
- crew-safe run detail;
- empty/loading/error states;
- no comments yet.

### UI-21 — Crew Reactions + Mini Builds

Expected outcomes:

- lightweight one-tap encouragement;
- read-only member mini Build/miles-built treatment;
- optional member summary;
- comments remain a separately reviewable addition if still desired.

## Testing/security expectations for future Race Crew code

Before any production social release:

- users cannot enumerate/read crews they do not belong to;
- invite tokens are not guessable/leaked in logs;
- one member cannot read another member's private health fields;
- shared run endpoints cannot return source payloads/GPS/notes/HR;
- removed member loses access immediately;
- account/crew deletion behavior is tested;
- current personal run/Build data survives account adoption;
- no server secret/token reaches built client JS;
- automated tests use fake users/activities;
- manual single-user mode failure/recovery is explicitly decided rather than accidentally broken.

## Product acceptance for Race Crew

Race Crew is successful when a small group training for the same race can answer:

- Who ran this week?
- How much work are we each putting in?
- What was everyone's recent long run?
- How is each person progressing against their own plan?
- Can I give a friend a quick bit of encouragement?

without turning STACK into a public social network or exposing data that belongs in a private training/health view.
