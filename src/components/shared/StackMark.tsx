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
      <g dangerouslySetInnerHTML={{ __html: stackMarkSvgMarkup() }} />
    </svg>
  );
}
import { stackMarkSvgMarkup } from "./stackMarkSvg.js";
