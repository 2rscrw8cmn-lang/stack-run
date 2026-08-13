import type { CrewMemberAccent } from "../../crew/memberAccent";
import {
  RUNNER_ICON_PARTS,
  RUNNER_ICON_VIEW_BOX,
  RUNNER_ICON_VIEW_BOX_HEIGHT,
  RUNNER_ICON_VIEW_BOX_WIDTH,
  runnerIconShape,
  type RunnerIcon as RunnerIconModel,
  type RunnerIconPart,
} from "../../crew/runnerIcon";

/**
 * One part of the mark: its plates, then the holes punched through them.
 *
 * Cuts are drawn in ink rather than as `evenodd` holes so a slot always reads
 * as a slot against whatever the icon is sitting on — a transparent hole over
 * a light sheet surface would invert the whole face.
 */
function Part({ icon, part }: { icon: RunnerIconModel; part: RunnerIconPart }) {
  const shape = runnerIconShape(part, icon[part]);
  const plateClass = part === "extra" ? "runner-icon__mark" : "runner-icon__plate";
  return (
    <g className={`runner-icon__part runner-icon__part--${part}`}>
      {shape.plates.map((d) => (
        <path key={d} className={plateClass} d={d} />
      ))}
      {shape.cuts?.map((d) => (
        <path key={d} className="runner-icon__cut" d={d} />
      ))}
    </g>
  );
}

interface RunnerIconProps {
  icon: RunnerIconModel;
  /**
   * The runner's member accent, already resolved through `crewMemberAccent`.
   * The mark sets it on itself rather than inheriting, so an icon is the
   * right color even when it is lifted out of a `data-member-color` row.
   */
  accent?: CrewMemberAccent;
  /** Rendered height in CSS pixels; width follows the icon's own ratio. */
  size?: number;
  /**
   * Provide a name to expose the mark. Omit it wherever the runner's name is
   * already adjacent — which is nearly everywhere, because the icon is never
   * the only way a member is identified.
   */
  label?: string;
  className?: string;
}

/**
 * A runner's personal icon, drawn from their four choices and their color.
 *
 * Deliberately presentational and self-contained: the same component draws
 * the 22px marker in a crew row and the 104px editor preview, so a runner
 * cannot be one figure in the roster and another in the legend.
 */
export function RunnerIcon({ icon, accent, size = 24, label, className }: RunnerIconProps) {
  return (
    <svg
      className={["runner-icon", className].filter(Boolean).join(" ")}
      viewBox={RUNNER_ICON_VIEW_BOX}
      height={size}
      width={Math.round((size * RUNNER_ICON_VIEW_BOX_WIDTH) / RUNNER_ICON_VIEW_BOX_HEIGHT)}
      data-member-color={accent}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {RUNNER_ICON_PARTS.map((part) => (
        <Part key={part} icon={icon} part={part} />
      ))}
    </svg>
  );
}
