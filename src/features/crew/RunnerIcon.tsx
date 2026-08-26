import type { CrewMemberAccent } from "../../crew/memberAccent.js";
import {
  RUNNER_ICON_DRAW_ORDER,
  RUNNER_ICON_VIEW_BOX,
  RUNNER_ICON_VIEW_BOX_HEIGHT,
  RUNNER_ICON_VIEW_BOX_WIDTH,
  runnerIconShape,
  type RunnerIcon as RunnerIconModel,
  type RunnerIconPart,
} from "../../crew/runnerIcon.js";

/**
 * The class a part's filled plates are drawn with. Three tones, and which one
 * a part gets is what tells the three layers apart at a glance: the backdrop
 * is a dark field with an accent edge, flair is applied hardware in the mark
 * tone, and everything else is the runner's own color.
 */
function plateClassOf(part: RunnerIconPart): string {
  if (part === "background") return "runner-icon__field";
  if (part === "flair") return "runner-icon__mark";
  return "runner-icon__plate";
}

/**
 * One part of the mark: its plates, the holes punched through them, then the
 * accent chips set back inside those holes.
 *
 * Cuts are drawn in ink rather than as `evenodd` holes so a slot always reads
 * as a slot against whatever the icon is sitting on — a transparent hole over
 * a light sheet surface would invert the whole face.
 */
export function RunnerIconPart({
  icon,
  part,
  ghost,
}: {
  icon: RunnerIconModel;
  part: RunnerIconPart;
  /** Draws the part as dim context rather than as itself, for editor thumbnails. */
  ghost?: boolean;
}) {
  const shape = runnerIconShape(part, icon[part]);
  const plateClass = ghost ? "runner-icon__ghost" : plateClassOf(part);
  return (
    <g
      className={`runner-icon__part runner-icon__part--${part}${
        ghost ? " runner-icon__part--ghost" : ""
      }`}
    >
      {shape.plates.map((d) => (
        <path key={d} className={plateClass} d={d} />
      ))}
      {!ghost &&
        shape.cuts?.map((d) => <path key={d} className="runner-icon__cut" d={d} />)}
      {!ghost &&
        shape.pips?.map((d) => <path key={d} className="runner-icon__pip" d={d} />)}
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
  /** Rendered height in CSS pixels; the icon's own box is square. */
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
 * A runner's personal icon, drawn from their five choices and their color.
 *
 * Deliberately presentational and self-contained: the same component draws
 * the 22px marker in a crew row and the large editor preview, so a runner
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
      {RUNNER_ICON_DRAW_ORDER.map((part) => (
        <RunnerIconPart key={part} icon={icon} part={part} />
      ))}
    </svg>
  );
}
