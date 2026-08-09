interface StackMarkProps {
  size?: number;
  className?: string;
}

/**
 * The STACK mark: three courses of a tower, narrowing as they climb.
 *
 * The same geometry the app icons are drawn from (`scripts/generate-icons.mjs`
 * renders these rectangles), so the thing in the header and the thing on the
 * home screen are one mark rather than two that resemble each other. Per the
 * design system it is bars only — no runner, no crane, no hard hat — and it
 * stays legible down to 20px because it is three shapes and two gaps.
 */
export function StackMark({ size = 24, className }: StackMarkProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="2" y="15" width="20" height="5.5" rx="2" fill="var(--easy)" />
      <rect
        x="4.5"
        y="8.75"
        width="15"
        height="5.5"
        rx="2"
        fill="var(--intervals)"
      />
      <rect
        x="7"
        y="2.5"
        width="10"
        height="5.5"
        rx="2"
        fill="var(--simulation)"
      />
    </svg>
  );
}
