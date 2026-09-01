interface StackMarkProps {
  /** Optical height in CSS pixels. Width follows the artwork's native ratio. */
  size?: number;
  className?: string;
}

/**
 * The canonical STACK runner-man mark.
 *
 * The artwork is intentionally inline so it is crisp at every in-app size.
 * Install icons and server-rendered share cards consume the same vector source.
 */
export function StackMark({ size = 28, className }: StackMarkProps) {
  const width = (size * STACK_RUNNER_VIEW_BOX.width) / STACK_RUNNER_VIEW_BOX.height;

  return (
    <svg
      className={className}
      width={width}
      height={size}
      viewBox={`0 0 ${STACK_RUNNER_VIEW_BOX.width} ${STACK_RUNNER_VIEW_BOX.height}`}
      aria-hidden="true"
      focusable="false"
    >
      <g dangerouslySetInnerHTML={{ __html: stackRunnerSvgMarkup() }} />
    </svg>
  );
}
import {
  STACK_RUNNER_VIEW_BOX,
  stackRunnerSvgMarkup,
} from "./stackRunnerMark.js";
