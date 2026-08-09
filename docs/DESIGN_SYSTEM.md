# Design System

## Visual direction

Apple Fitness cleanliness with colorful, lightly dimensional construction blocks.

The app should feel premium and playful without looking like a game or construction-management software.

## Color tokens

Use CSS custom properties. These values are initial targets and may be tuned slightly for contrast.

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

## Typography

Use the system font stack.

```css
font-family:
  ui-sans-serif,
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  sans-serif;
```

Recommended scale:

| Use | Size | Weight |
|---|---:|---:|
| App wordmark | 17 px | 700; `letter-spacing: 0.18em` |
| Screen lead | 22-30 px | 650 |
| Primary metric | 38-46 px | 650 |
| Card title | 18-22 px | 600 |
| Body | 16 px | 400 |
| Secondary | 14 px | 400 |
| Section title | 12 px | 650; uppercase, `letter-spacing: 0.06em` |

Do not import a custom font in v1.

**The wordmark is a lockup, not a headline.** It was 34 px over a tagline,
repeated above every screen, which made the app open on its own name and read
like something generic. It is now set at reading size beside the mark, with
wide tracking doing the work a display face would otherwise do.

**No screen is titled with its own name.** The tab that got you there already
said it. Each screen leads with what it is about, and that lead is the screen's
one `h1`: the date on Today, the miles on Build, the week on Plan.

`--text-subtle` was raised from `#6f7a84` in UI-7. It carries small text —
inactive tab labels, row status, uppercase labels — and measured 3.7:1 on
`--surface-strong`, under the 4.5:1 WCAG AA asks of body text.

## Surfaces

- Cards use one-pixel translucent borders.
- Avoid multiple nested cards.
- Use shadows only to separate a modal or create block depth.
- Do not add glassmorphism blur.
- Do not use gradients on large cards.

### One card per screen

A card is for the one thing on a screen the user can act on — the day's
workout, the run that replaced it. Everything else is a **section**: a hairline
rule, a 15 px icon, an uppercase name, and the content itself, with an optional
value pushed to the right of the header.

Five cards in a column give five unrelated things identical weight and leave
nothing to look at first, which is what the screens had before UI-7.

### Empty states

An icon in a 52 px circle, a title, and one or two sentences that say what would
put something here. Always a reason and a next step, never an apology: an empty
Build is the state every runner starts in and should read like the beginning of
something.

## Icons

Lucide, and one icon per meaning:

| Meaning | Icon |
|---|---|
| Rest | `Moon` |
| Easy | `Footprints` |
| Intervals | `Zap` |
| Simulation | `Timer` |
| Long run | `Mountain` |
| Race | `Flag` |
| This week | `CalendarRange` |
| Next | `CalendarClock` |
| The build | `Blocks` |
| Blocks ready | `Boxes` |
| Streak | `Flame` |

Sizes: 15 px in a section header, 13-16 px inline with text, 18-20 px in a
control, 24-26 px in an empty state.

**Every icon is decorative.** Each one sits beside text carrying the same
meaning, and none is ever the only way to know something — so all of them are
`aria-hidden`.

## Buttons

### Primary

- Accent background
- Dark text
- Full width on mobile
- 52-56 px high
- Strong label
- No icon unless the action is ambiguous without one

### Secondary

- Surface background
- Border
- Text color
- 48-52 px high

### Destructive

- Do not use a permanently bright red filled button.
- Use red text or border until final confirmation.

## Block piece styling

Blocks are plain HTML elements.

In the Build tower they are drawn isometrically (D-015): one CSS 3D transform on
the tower, and each brick drawing a front face, a top face where nothing rests
on it, and a right face where nothing abuts it. Never a canvas, a WebGL context,
a 3D engine, or simulated physics.

Everywhere else — the Place Block grid, the staging chips, the legend — blocks
stay flat and front on.

```css
.stack-block {
  border-radius: 7px;
  border: 1px solid rgba(255,255,255,.16);
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--piece-color) 86%, white),
      var(--piece-color)
    );
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.24),
    0 3px 0 color-mix(in srgb, var(--piece-color) 62%, black),
    0 7px 12px rgba(0,0,0,.20);
}
```

Provide a fallback without `color-mix()` when browser support requires it.

Planned blocks use a transparent fill and visible border.

Missed blocks use a transparent fill and dashed border.

## Motion

Allowed:

- Sheet slide or fade
- Button press scale of 0.98
- Block reveal: opacity plus 8-12 px downward-to-rest translation
- Block placement drop: the block the user just placed falls about 34 px into
  its course, settles with a 2 px overshoot, and kicks up one brief dust puff.
  This is a single keyframe on one element, not a simulation, and it plays only
  for the block that was just placed.
- Very brief glow on the newest block

Not allowed:

- Falling physics
- Bouncing tower
- Rotating or perspective blocks
- Confetti
- Continuous animation
- Parallax

Duration target: 180-400 ms.

## App icon

Three stacked rounded bars, narrowing as they climb — a tower in three courses,
in the piece colours, on `--bg-elevated`.

- No running figure
- No hard hat
- No literal crane
- No Tetris trademark shapes
- Must remain legible at 32 px

The geometry lives in exactly two places, and they agree:
`src/components/shared/StackMark.tsx` draws it in the app, and
`scripts/generate-icons.mjs` renders the same rectangles into
`public/`. Regenerate with `node scripts/generate-icons.mjs` and commit the
result; never hand-edit the PNGs.

- `icon-192.png`, `icon-512.png` — rounded, transparent outside.
- `apple-touch-icon.png` — 180 px, **square**: iOS applies its own mask and
  pre-rounded corners would show up as dark ones.
- `icon-maskable-512.png` — square ground, mark at half width, so everything
  that matters survives any mask Android applies.
- `favicon.svg` — the same mark as vector.
