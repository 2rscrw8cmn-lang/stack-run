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
  --text-subtle: #6f7a84;

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
| App wordmark | 34 px | 700 |
| Screen title | 28 px | 650 |
| Primary metric | 32-42 px | 650 |
| Card title | 18-22 px | 600 |
| Body | 16 px | 400 |
| Secondary | 14 px | 400 |
| Label | 12 px | 600; uppercase sparingly |

Do not import a custom font in v1.

## Surfaces

- Cards use one-pixel translucent borders.
- Avoid multiple nested cards.
- Use shadows only to separate a modal or create block depth.
- Do not add glassmorphism blur.
- Do not use gradients on large cards.

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
- Very brief glow on the newest block

Not allowed:

- Falling physics
- Bouncing tower
- Rotating or perspective blocks
- Confetti
- Continuous animation
- Parallax

Duration target: 180-400 ms.

## App icon direction

Use a simple inline SVG or generated asset consisting of three stacked rounded bars.

- No running figure
- No hard hat
- No literal crane
- No Tetris trademark shapes
- Must remain legible at 32 px
