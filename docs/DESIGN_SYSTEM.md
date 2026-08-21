# STACK Design System

**Status:** canonical product-wide presentation authority for current STACK.

This document defines the default visual and interaction language for new STACK surfaces. Specialist documents may add rules for charts, Build, Crew, connected data, or a specific feature, but they should extend this system rather than create a second one.

When a specialist contract conflicts with this file, resolve the conflict in the scoped issue instead of silently inventing a local style.

## Governing principle

> **Interface is quiet. Data is STACK.**

The shell, reading text, navigation, forms, rows, and ordinary sections should be calm, readable, and structurally simple. Running facts, selected states, Build objects, and factual reward moments may carry the stronger Performance Arcade identity.

A useful balance is approximately:

- **70% current STACK:** dark, restrained, readable, content-first;
- **20% Performance Arcade:** machine labels, mono/tabular data, stronger color, block geometry, technical chart texture;
- **10% payoff:** Build placement, selected data, and factual accomplishment moments.

STACK should feel like a purpose-built running instrument with arcade DNA, not a retro console, wellness dashboard, construction-management product, or game economy.

Do not add literal Game Boy/device chrome, CRT scanlines, pixel fonts for normal UI, fake terminal commands, D-pads, XP, coins, levels, quests, loot, or decorative gamification unrelated to real running.

## Authority and specialist contracts

Use this document first for product-wide presentation decisions, then the deeper contract for the subsystem being changed.

Key extensions:

- `docs/ARCADE_DESIGN_PASS.md` — origin and boundaries of Performance Arcade;
- `docs/RUNS_VISUALIZATION_SYSTEM.md` — how running facts become visuals;
- `docs/RUNS_R2_CHART_SYSTEM.md` — phone chart labels, selection, density, and touch behavior;
- `docs/RUN_DETAIL_PRODUCT_SPEC.md` — single-run presentation hierarchy;
- `docs/BUILD_CONCEPT.md` — Build geometry, earning, placement, and object behavior;
- `docs/CREW_SPECIAL_BLOCKS.md` — Special Block lifecycle and approved hollow-block treatment;
- `docs/CURRENT_APPLICATION_STRUCTURE.md` — current implementation shape.

Historical phase documents explain how the system evolved. They do not override this file unless a current issue explicitly re-approves a rule.

## Core visual direction

### Quiet shell, confident facts

Use visual intensity in proportion to information value.

Quiet:

- app shell;
- body copy;
- ordinary section headers;
- settings/forms;
- utility sheets;
- run and Crew list structure;
- non-selected controls.

Strong:

- distance, pace, duration, HR, load, gain, and other running values;
- selected chart periods and current values;
- Build blocks and placement states;
- Runner/Crew identity marks;
- factual accomplishment moments;
- small machine-status labels where they improve scanability.

Do not make every surface neon, bordered, inset, gridded, or monospaced. If everything looks like an instrument panel, nothing has hierarchy.

### Performance Arcade

Charts and data regions may use:

- large tabular or monospace values;
- short uppercase machine labels;
- blocky bars/columns;
- crisp linework;
- stronger selected states;
- local, low-contrast technical grids;
- compact darker inset data regions;
- brighter workout/data accents.

Technical grids are local texture, never page wallpaper. Do not place visible grids behind paragraphs, forms, or every screen.

## Color

Use CSS custom properties and semantic roles rather than one-off colors in components.

The existing base tokens remain the default until Stabilization 1.08 establishes exact typography/color semantics:

```css
:root {
  color-scheme: dark;

  --bg: #071018;
  --bg-elevated: #0c1620;
  --surface: #111c26;
  --surface-strong: #16222d;
  --surface-soft: #0e1821;

  --text: #f6f7f8;
  --text-muted: #9ca7b1;
  --text-subtle: #848e98;

  --border: rgba(255, 255, 255, 0.09);
  --border-strong: rgba(255, 255, 255, 0.15);

  --accent: #b8f13b;
  --accent-text: #0a1102;

  --easy: #b8f13b;
  --intervals: #4f9bff;
  --simulation: #9b6dff;
  --long: #ffc53d;
  --race: #f6f7f8;
  --danger: #ff6b6b;

  --radius-sm: 10px;
  --radius-md: 16px;
  --radius-lg: 22px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
}
```

Workout identity remains:

- Easy — lime;
- Intervals — blue;
- Simulation — purple;
- Long Run — yellow;
- Race — white/light neutral.

Charts may add accessible semantic colors where the metric requires them, including ordered HR-zone colors. Color must never be the only carrier of meaning.

Do not create a new global token merely because one local component has an exception.

## Typography

STACK has two voices.

### Interface / reading voice

Use the normal system sans stack for:

```css
font-family:
  ui-sans-serif,
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  sans-serif;
```

Use sans for:

- body copy;
- workout instructions;
- section and sheet titles;
- navigation;
- settings/forms;
- buttons and ordinary actions;
- member names and readable identity text;
- `Show more`, `Show all`, `Show fewer`, Back, and destination labels.

### Data / machine voice

Use the platform mono stack for facts and compact technical metadata:

```css
font-family:
  ui-monospace,
  SFMono-Regular,
  Menlo,
  Monaco,
  Consolas,
  "Liberation Mono",
  monospace;
```

Use mono/tabular type for:

- distance, pace, duration, heart rate, load, gain, percentages;
- chart values and axes;
- dates when functioning as machine metadata;
- compact plan/actual/delta facts;
- mileage stamped into Build objects where approved;
- short machine-status labels.

Do not use monospace for paragraphs, notes, instructions, member names, normal sheet titles, settings, or generic navigation.

### Scale and hierarchy

Approximate targets, using existing responsive tokens where possible:

| Use | Target |
| --- | --- |
| Screen lead | 22–30 px sans |
| Primary data | 28–40 px mono/tabular |
| Secondary data | 16–22 px mono/tabular |
| Body | 16 px sans |
| Secondary text | 14 px sans |
| Section label | 11–12 px sans, uppercase/tracked when useful |
| Machine label | 10–12 px mono, uppercase/tracked |
| Phone chart axis/date | 12 px minimum target; selected/current 13–14 px preferred |

The STACK wordmark is a lockup, not a page headline. No screen needs to repeat its tab name as the `h1`; lead with the thing the screen is about.

## Layout and surface hierarchy

### One actionable card; quiet sections

A card is for the primary object the runner can act on now: for example, today's workout or the run found for it.

Everything else should usually be a section built from:

- spacing;
- a hairline rule where needed;
- a small icon or short label when useful;
- the content itself;
- an optional value aligned opposite the section label.

Avoid dashboard walls where five unrelated cards receive equal weight.

### Surfaces

- Use one-pixel translucent borders where separation is needed.
- Avoid nested card stacks.
- Use shadows only for modal/sheet separation or physical Build depth.
- Do not add glassmorphism blur.
- Do not use large decorative gradients as card backgrounds.
- Compact data modules may use darker inset backgrounds and tighter 8–12 px radii.
- Stronger borders or accent rules belong to selected/data states, not every container.

### Responsive behavior

STACK is phone-first. A desktop layout may breathe more, but it must not become a different product.

Material UI work should remain legible and operable at:

- 320 px;
- approximately 390 px;
- 430 px;
- desktop.

Reduce density, tick count, or secondary chrome before shrinking essential labels below readable phone sizes.

## App shell, headers, and navigation

Current primary destinations are:

```text
Today | Build | Runs | [Crew] | Plan
```

Crew appears only for active Crew members.

Rules:

- bottom navigation is persistent product navigation, not decorative chrome;
- the selected destination should be obvious without a large screen-title repeat;
- keep destination labels in the normal sans voice;
- the signed-in runner's Runner Icon is the Account & Crew affordance in the header;
- Settings remains a gear utility rather than a destination;
- child experiences such as Runs History should preserve their parent destination and use a simple in-surface Back row;
- restore useful parent scroll position when returning from a child screen where the feature contract requires it.

Headers should carry identity/context, not become dashboards.

## Sheets and dialogs

Use a sheet for focused detail, confirmation, editing, or a bounded utility task. Do not use a sheet as the default answer to “show me the rest of this collection.” Inline expansion or a child screen is usually better for continuation/browsing.

Sheet rules:

- one clear sans title;
- concise supporting context;
- stable close/back affordance;
- body content scrolls when needed;
- actions remain reachable on phone;
- no duplicate page title + eyebrow + subtitle when one line gives enough context;
- detail sheets may use stronger data typography inside the content, while the sheet chrome stays quiet.

## Controls

### Touch targets

Primary interactive targets should be at least **44 × 44 px** even when the visible control is smaller.

A compact tab, chart mark, icon, or pill may look smaller than 44 px; expand the hit area around it instead of making the visible element oversized.

### Buttons

Primary:

- accent background;
- dark text;
- strong sans label;
- generally full width on narrow mobile when it is the primary next action;
- approximately 52–56 px high;
- icon only when it clarifies meaning.

Secondary:

- quiet surface/background;
- border only when needed;
- normal text color;
- approximately 48–52 px high.

Destructive:

- avoid a permanently bright red filled button;
- use red text/border until final confirmation.

### Segmented controls and tabs

Use compact controls for a small set of mutually exclusive views such as metric/range selection.

- selected state must read by more than color alone;
- labels stay short;
- visible pills/tabs may be compact while the target remains 44 px;
- use sans for ordinary view selection;
- reserve machine voice for values/metadata, not every control label;
- do not stack multiple permanent filter rows on a dense phone screen unless each row earns its weight.

### Native selects

Prefer native `<select>` controls when the job is straightforward choice selection and a custom control adds no product value.

- keep the native interaction and accessibility behavior;
- style the surrounding surface to belong to STACK;
- do not replace a native select with a custom popover merely for visual novelty;
- labels and current value must remain readable without relying on placeholder text.

### Focus and keyboard

Every interactive element needs a visible focus state. Desktop hover may supplement touch/focus behavior but never replace it.

## Rows and lists

### Run rows

Run history is factual reading content, not a card collection.

Default pattern:

- flat row;
- spacing + hairline separation;
- readable left-side identity/context;
- primary running facts aligned on the right in machine/tabular type;
- one decimal for mileage where Runs contracts specify it;
- neutral treatment for historical-only/source facts when STACK does not own a classification;
- tap target opens focused run detail.

Do not add redundant explanatory paragraphs to every row. Missing metrics remain missing; do not render zero to fill a layout hole.

### Crew rows

Crew lists use the same quiet row grammar, plus compact identity:

- Runner Icon or Crew emblem provides recognition;
- name remains readable sans text;
- shared running/Build facts may use machine type;
- avoid repeating identity through icon + color + badge + label when one or two channels are enough;
- shared/projection-safe data boundaries remain authoritative even when a richer visual would be convenient.

## Runner and Crew identity

### Runner Icons

Runner Icons are compact product identity, not profile photos or decorative avatars.

- use the canonical Runner Icon renderer/builder rather than drawing local substitutes;
- preserve the runner's chosen geometry/color identity consistently across header, Crew, profile, and Build-adjacent surfaces;
- keep the icon recognizable at small sizes;
- pair with a text name where identity matters; do not force users to decode icons alone;
- do not add extra badges over the icon unless a scoped feature requires a distinct state.

### Crew emblems

Crew emblems are the Crew-level equivalent: a persistent recognition mark for the group.

- use the canonical emblem geometry everywhere;
- give the emblem enough clear space to read;
- do not recolor/redraw it differently per surface;
- keep Crew name in sans text near the emblem when context requires it;
- avoid turning the emblem into a decorative background watermark behind data.

## Build object language

Build is the most physical and playful part of STACK. It may be louder than the surrounding interface because the tower is the reward object.

### Personal and Crew Build

The tower uses the approved oblique/isometric object language and the existing placement engine/contracts.

In tower context:

- blocks may show dimensional top/right faces according to occupancy;
- depth, brighter edges, and a brief placement payoff are allowed;
- block color carries identity/workout meaning according to the relevant Build contract;
- newly placed state may briefly glow;
- geometry/storage/collision rules are never changed merely to achieve a visual effect.

Outside tower context — staging, legends, profile rows, placement controls — prefer flat/front-on block representations unless the specialist contract calls for a hero/object view.

Do not introduce canvas, WebGL, physics, or a second geometry model to render the tower.

### Run blocks

Run blocks are physical representations of actual Build-eligible running. Keep them matte and structurally simple enough that Special Blocks and placement state can read as distinct.

Planned intent is not a placed physical run block. If a specialist screen displays planned/missed shapes, use outlined/ghosted treatments specified by that screen rather than making them look already built.

### Special Blocks

Special Blocks are award artifacts in Crew Build, not mileage and not a second game system.

Their product-wide visual rule is **hollow block**:

- frame color = winning runner ownership;
- recessed opening = award space;
- award glyph/color = award identity;
- no mileage text;
- no runner icon on the face;
- no badge/chip layered on top;
- same collision/support geometry as ordinary Crew blocks;
- placed awards may read as “lit” through a restrained ownership halo and illuminated glyph.

Do not invent separate Feature-award chrome, metallic textures, glass, stone, extra keylines, or bespoke geometry. Exact glyphs/colors/footprints remain in `docs/CREW_SPECIAL_BLOCKS.md`.

## Charts and visualization

Charts are a data surface, not a decorative background.

### Visual hierarchy

1. selected/current value;
2. data marks;
3. comparison/reference data;
4. labels/axes;
5. grid/frame.

The grid must never compete with the data.

### Geometry

Charts should visually belong to the same product as Build:

- square/blocky columns or very small radii;
- crisp lines and points;
- simple linework;
- strong selected states;
- no unnecessary 3D chart styling;
- no decorative smoothing that changes the apparent data.

### Actual vs plan/reference

- Actual: brighter/primary, solid.
- Plan/reference: neutral gray/white, dashed/outlined/quieter.
- Partial/in-progress periods: clearly partial without reading as failure.

### Chart types

Use the chart type that answers the question, not the one that fills the space.

Current Runs direction includes:

- Miles and Time — bars/columns;
- Runs, Load, and Gain — lines;
- Zone Mix — composition/donut;
- plan-vs-actual comparisons — contract-specific columns/lines.

Donuts are for composition, not general trend display.

### Mobile readability contract

- phone axis/date labels target 12 px minimum;
- selected/current labels prefer 13–14 px;
- reduce tick count before shrinking type;
- target roughly 4–6 x-axis labels around 390 px where possible;
- show selected period/value outside the densest plot region;
- aggregate long ranges by week/month rather than drawing hundreds of tiny marks;
- drawn marks may be narrow, but interaction targets must remain large enough to use;
- touch selection must reach every bucket, including buckets without a printed tick label;
- no axis labels may collide.

### Selection and tooltips

Phone interaction is tap-to-select with a persistent readable detail/readout. Hover-only tooltips are not acceptable.

Desktop hover can supplement tap/focus.

A chart should not state the same selected fact in multiple competing readouts.

### Text and accessibility

Charts need a textual interpretation/alternative sufficient to understand the important result without color or precision pointing.

Missing source metrics remain missing. Do not fabricate zero, infer a classification, or hide partial coverage merely to make a chart complete.

## Icons

Use Lucide for ordinary UI meanings and one icon per meaning.

Current baseline:

| Meaning | Icon |
| --- | --- |
| Rest | `Moon` |
| Easy | `Footprints` |
| Intervals | `Zap` |
| Simulation | `Timer` |
| Long run | `Mountain` |
| Race | `Flag` |
| This week | `CalendarRange` |
| Next | `CalendarClock` |
| Build | `Blocks` |
| Blocks ready | `Boxes` |
| Streak | `Flame` |

Typical sizes:

- 15 px section header;
- 13–16 px inline;
- 18–20 px control;
- 24–26 px empty state.

Ordinary icons that repeat adjacent text are decorative and should be `aria-hidden`. If an icon is the interactive control itself, it needs an accessible name.

Runner Icons, Crew emblems, StackMark, block geometry, and Special Block glyphs are product marks/objects, not Lucide substitutions.

## Motion

Motion should communicate selection, state change, or physical placement. It should not create ambient spectacle.

General target: **160–320 ms**. Existing Build placement may run longer within its approved specialist contract, but should still feel immediate.

Allowed:

- sheet slide/fade;
- button press around `scale(.98)`;
- short opacity/translation reveal;
- chart draw/column settle when it improves comprehension;
- selected-card/point glow;
- brief factual accomplishment reveal;
- Build placement drop/settle/dust payoff;
- very brief newest-block glow.

Not allowed:

- continuous animation;
- falling physics;
- bouncing tower;
- rotating/perspective novelty blocks;
- confetti;
- parallax;
- cinematic transitions;
- sound/chiptune UI;
- a new haptics system unless separately approved.

### Reduced motion

`prefers-reduced-motion` must preserve the same information immediately without travel, bounce, draw, or settling animation.

Do not merely slow an animation down. Remove unnecessary motion while keeping final state, selection, and accomplishment information visible.

## Empty, loading, and error states

### Empty

An empty state explains:

1. what is absent;
2. why that can be normal;
3. what action or future event will populate it, when applicable.

Preferred form:

- simple icon/mark;
- short title;
- one or two sentences;
- one clear next action only when an action exists.

No apology language. An empty Build is the beginning of the product loop, not an error.

### Loading

Keep loading structure quiet and stable. Prefer preserving surrounding layout over replacing the whole screen with animated chrome.

Do not use continuous arcade animation as a loading treatment.

### Error

Errors should say:

- what failed in user terms;
- whether existing/local data is still safe/available;
- the next recoverable action.

Use danger color as a semantic accent, not a full-screen theme.

Do not expose raw source payloads, implementation jargon, credentials, or stack traces in normal UI.

## Accessibility contract

Required across STACK:

- 4.5:1 contrast for normal/small body text where applicable;
- visible keyboard focus;
- 44 px primary touch targets;
- no color-only state;
- labels/readouts that make charts understandable without precise pointer use;
- readable mono numerals at 320 px;
- grids/animation never reduce text legibility;
- meaningful empty/error copy;
- Reduced Motion support;
- accessible names for icon-only controls;
- native semantics before custom ARIA.

## App mark and icon

The app mark is three stacked rounded bars, narrowing as they climb — a tower in three courses, in piece colors, on the dark ground.

- no running figure;
- no hard hat;
- no literal crane;
- no trademarked Tetris shapes;
- must remain legible at small icon sizes.

Canonical geometry lives in:

- `src/components/shared/StackMark.tsx`;
- `scripts/generate-icons.mjs`.

Regenerate icon assets with the script; do not hand-edit generated PNGs.

## Implementation rules for new surfaces

Before inventing a component-local style, ask:

1. Is this shell/interface or running data?
2. Does it need a card, or is it a quiet section/row?
3. Is the text readable sans or machine/data type?
4. Is this a continuation interaction that should expand inline or become a child screen instead of a sheet?
5. Does the visible control have a 44 px target?
6. Is selected state understandable without color?
7. Can an existing Runner Icon, Crew emblem, Build object, row, sheet, button, or chart pattern do the job?
8. Does a specialist contract already own the exact behavior?
9. Is missing source data being preserved as missing?
10. Does the result still satisfy **Interface is quiet. Data is STACK.**?

If the answer requires a new global token, new interaction primitive, or exception to this system, document why in the scoped issue rather than hiding it inside one stylesheet.
