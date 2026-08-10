# Performance Arcade — Design Specification

Status: **Approved for UI-17 implementation after UI-16.**

## Design statement

STACK should feel like a **modern training computer with arcade DNA**.

It should not look like a retro-game emulator, a literal handheld console, a CRT, or a joke fitness app.

The approved balance is approximately:

- **70% current STACK** — clean, dark, restrained, readable;
- **20% performance arcade** — bolder data, technical grids, block geometry, stronger color;
- **10% playful reward moments** — factual achievements and satisfying micro-interactions.

The design goal is specialized running equipment: a machine built for one job.

## Relationship to the approved mockup

The owner approved the exploratory concept showing:

- a black/dark technical shell;
- bright lime as the primary signal color;
- stronger blue/yellow/purple/red data accents;
- large monospaced/tabular data;
- uppercase machine labels;
- technical grid backgrounds inside chart/data regions;
- blocky chart geometry;
- compact high-density Training Signals;
- donut charts for composition;
- restrained achievement modules;
- unchanged bottom-navigation concept.

This document is the repository-readable version of that approved direction. Agents should implement the principles here rather than inventing a literal arcade theme.

## External reference boundary

TRNRBOI-8000 influenced the direction, especially its sense of a purpose-built training computer, stronger data displays and team concepts.

It is reference material only.

Do not copy:

- source code;
- pixel assets;
- Game Boy shell/device chrome;
- Strava logic;
- Tailwind/Recharts architecture;
- Press Start 2P styling wholesale;
- scanline/CRT effects;
- backend/social implementation.

STACK's implementation remains native to STACK.

## Core visual principles

### 1. Data gets louder; body content stays quiet

Normal reading text remains the current readable system sans stack.

Data may use a dedicated monospace/tabular stack:

```css
ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace
```

Do not require a network font.

Use mono/data typography for:

- large stats;
- chart values;
- pace/time/distance;
- small machine-status labels;
- short comparison values.

Do not set paragraphs, workout instructions, notes or Settings forms in monospace.

### 2. System labels create the training-computer voice

Approved examples:

```text
THIS WEEK
LAST 4
PLAN
ACTUAL
DELTA
RUN FOUND
BLOCK READY
LONGEST RUN
NEW HIGH WEEK
```

Rules:

- short;
- factual;
- usually uppercase;
- modest letter spacing;
- no fake command-line syntax;
- no intentionally cryptic abbreviations.

### 3. Charts inherit Build geometry

Graphs should visually belong to the same product as the tower.

Prefer:

- square/blocky columns;
- crisp points;
- restrained radii;
- structural spacing;
- simple linework;
- strong selected states.

Avoid overly soft wellness-app charts or decorative gradients that hide data.

### 4. Technical grids are local texture, not wallpaper

A subtle grid may appear inside:

- expanded trend charts;
- select Training Signal mini charts;
- Build backdrop if visual review supports it;
- rare accomplishment/data modules.

Do not place a visible grid behind every screen or paragraph.

Grid requirements:

- very low contrast;
- subordinate to axes/data;
- no moiré at phone scale;
- absent/toned down when it compromises readability.

### 5. Color is confident

Preserve workout identity:

- Easy — lime;
- Intervals — blue;
- Simulation — purple;
- Long Run — yellow;
- Race — white/light neutral.

Allow richer semantic/chart colors where needed:

- success/positive — lime/green;
- informational — blue;
- caution/high load or intermediate zone — yellow/orange;
- max/high — red;
- neutral/reference/plan — gray/white at reduced emphasis.

Do not turn every surface into a different neon color.

### 6. Running remains the achievement

Arcade influence may amplify moments that are factually true.

It may not invent a parallel game economy.

No:

- XP;
- coins;
- levels;
- quests;
- loot;
- streak punishment;
- virtual currency;
- arbitrary score unrelated to training.

## Data typography scale

Use existing responsive sizing/tokens where possible, but the visual hierarchy should support roughly:

### Primary data

28–40px depending on context/viewport.

Examples:

- `18.4 MI`
- `9:58 /MI`
- `88%`

### Secondary data

16–22px.

Examples:

- `145 BPM`
- `17.0 MI PLAN`
- `+1.4 MI`

### Machine labels

10–12px, uppercase, tracked.

Do not sacrifice WCAG contrast or minimum legibility to make labels look retro.

## Surface language

Current rounded-card hierarchy is preserved, but data modules may be slightly more technical than ordinary content cards.

Allowed:

- stronger 1px borders;
- darker inset backgrounds;
- 8–12px radius for compact data modules;
- small accent edge/rule;
- technical grid only inside data region;
- selected card/point outlined by accent.

Do not redesign every ordinary Section into a heavy bordered dashboard card. UI-7's content-first hierarchy still matters.

## Screen-by-screen direction

### Today — mission briefing, not dashboard wall

Keep Today simple.

Desired tone:

```text
AUG 10 · SUNDAY
OUC HALF · 117 DAYS

TODAY
LONG RUN
8.0 MI
KEEP IT CONTROLLED
Easy effort throughout.
```

The actual workout stays the dominant object.

Run Found can feel more machine-like:

```text
RUN FOUND
8.12 MI · 1:21:44 · 10:04 /MI
MATCHES TODAY
```

Do not add extra analytics cards to Today.

### Runs — strongest training-computer expression

Runs is the main home for the Performance Arcade data language.

Lead may show:

- run count;
- total actual miles;
- compact factual context.

Training Signals should look like small instrument modules rather than generic cards.

Expanded signal detail is where technical grids, large mono numerals and blocky charts may be strongest.

Run history itself remains readable and calmer beneath Signals.

### Build — playful physical object

Build is already the most game-like part of STACK.

UI-17 may refine:

- subtle technical backdrop;
- brighter edge treatment on blocks;
- stamped mileage numerals;
- staged-block ghost/landing clarity;
- placement status typography;
- accomplishment handoff when a real milestone is crossed.

Do not alter geometry/storage/game boundaries from D-045.

### Plan — restrained

Plan should borrow the new labels/numerals but remain the most utilitarian screen.

Possible cues:

- `WEEK 06` machine label;
- planned vs completed facts in tabular numerals;
- slightly stronger workout color accents.

Do not turn every plan row into an arcade tile.

## Chart visual grammar

### Actual vs plan

- Actual: bright primary/accent color, solid.
- Plan/reference: neutral gray/white, dashed/outlined/quieter.
- Partial current week: visibly partial without looking failed.

### Lines

- 1.5–2px visual weight;
- crisp round or square points depending component;
- selected point gets stronger outline/glow;
- no decorative smoothing that changes apparent values.

### Columns

- square or very small radius;
- spacing echoes blocks;
- selected column may brighten/outline;
- no unnecessary 3D styling.

### Donuts

Use for composition only:

- HR zones;
- Run Mix.

Center may carry the dominant value/category.

Legend remains textual.

### Tooltips/selection

Mobile interaction should prefer tap-to-select with a persistent readable detail panel rather than hover-only tooltip behavior.

Desktop hover may supplement tap/focus but never replace it.

## Heart-rate zone palette

UI-17 should formalize accessible tokens for up to seven source zones.

Target progression:

- Z1 blue;
- Z2 teal/cyan;
- Z3 lime;
- Z4 yellow;
- Z5 orange;
- Z6 red;
- Z7 purple/magenta.

If fewer zones exist, use the corresponding ordered subset consistently.

Zone label/percentage text must make the chart understandable without color.

## Factual achievement moments

UI-17 may add transient accomplishment presentation for deterministic events.

Approved initial candidates:

### New Longest Run

Trigger when a newly recorded run's distance exceeds every prior actual run in the active-plan period.

Example:

```text
NEW LONGEST RUN
8.0 MI
```

### Biggest Week

Trigger when the completed/updated current plan week's actual mileage exceeds every prior plan week in the active-plan period.

Do not trigger early in a partial week merely because it temporarily exceeds an empty future week.

### Four Weeks Consistent

Trigger when four consecutive completed/due plan weeks each have every scheduled non-rest workout satisfied.

Extra runs do not repair a missed scheduled run.

### Miles Built Milestone

Trigger only when total actual miles crosses a meaningful threshold, initially:

- 50;
- 100;
- 150;
- 200;
- then every 100 miles.

Do not show the same milestone repeatedly.

### Achievement storage

Prefer no new persistent badge collection in UI-17.

If preventing repeat display across reloads truly requires persistence, stop and document the smallest explicit state addition before changing schema.

An achievement is a moment, not a collectible economy.

## Motion

Target interactions generally 160–320ms.

Allowed:

- selected-card glow;
- chart draw/column settle;
- data value transition when a view opens;
- brief accomplishment reveal;
- existing Build placement payoff.

Do not use long cinematic animations.

`prefers-reduced-motion` must provide the same information immediately without travel/bounce/draw animation.

## Sounds/haptics

No sound system is approved.

Do not add:

- chiptune sounds;
- button beeps;
- completion jingles;
- audio dependencies.

Web haptics are also not required.

## Explicit rejected retro cues

Do not add:

- literal Game Boy/console shell;
- physical A/B buttons;
- D-pad navigation metaphor;
- CRT scanlines;
- phosphor glow over body text;
- boot screen/power switch;
- pixel-art icons;
- pixel font for normal UI;
- fake terminal commands;
- selectable retro screen palettes;
- deliberately low-resolution rendering.

## Accessibility

Performance Arcade must improve personality without reducing usability.

Required:

- 4.5:1 body/small-text contrast where applicable;
- visible focus;
- 44px primary touch targets;
- charts have text alternatives;
- no color-only state;
- mono numerals remain legible at 320px;
- no grid/animation behind text if it reduces readability;
- reduced-motion support.

## Engineering boundaries

UI-17 is a design-system/presentation phase, not a product rearchitecture.

Expected:

- mostly CSS/tokens/components;
- no schema migration;
- no router/state-management change;
- no Tailwind/UI framework;
- no imported code from TRNRBOI;
- no chart dependency introduced merely for styling;
- no Race Crew backend;
- no connected-data auth change.

## Acceptance summary

UI-17 succeeds when:

- STACK is immediately recognizable as the same app;
- data feels more confident, colorful and purpose-built;
- Runs/Trends look like specialized training instrumentation;
- Build and Trends visually belong to the same block-based product;
- Today is more like a mission briefing without becoming busier;
- Plan remains calm/readable;
- factual accomplishments feel satisfying without XP/game systems;
- nobody could reasonably describe the UI as a Game Boy skin or CRT emulator.
