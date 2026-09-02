interface StackMarkProps {
  /** Optical height in CSS pixels. Width follows the artwork's native ratio. */
  size?: number;
  className?: string;
  /**
   * Draw the runner as one silhouette in `currentColor` instead of in its own
   * colours. The full-colour artwork is built from a dozen overlapping shaded
   * shapes; below roughly 32px they stop reading as shading and start reading
   * as noise. At heading scale — beside a run's title, where the colour has to
   * mean the run's *type* rather than the brand — the silhouette is the mark.
   */
  monochrome?: boolean;
}

/**
 * The canonical STACK runner-man mark.
 *
 * The artwork is intentionally inline so it is crisp at every in-app size.
 * Install icons and server-rendered share cards consume the same vector source.
 */
export function StackMark({ size = 28, className, monochrome = false }: StackMarkProps) {
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
      {monochrome
        ? (
          /*
            The same path data, filled once. Drawing every path in one colour
            unions them into the runner's outline, which is exactly the shape
            the full-colour artwork describes.
          */
          <g fill="currentColor">
            {STACK_RUNNER_PATHS.map((path) => <path key={path.d} d={path.d} />)}
          </g>
        )
        : <g dangerouslySetInnerHTML={{ __html: stackRunnerSvgMarkup() }} />}
    </svg>
  );
}
import {
  STACK_RUNNER_PATHS,
  STACK_RUNNER_VIEW_BOX,
  stackRunnerSvgMarkup,
} from "./stackRunnerMark.js";
