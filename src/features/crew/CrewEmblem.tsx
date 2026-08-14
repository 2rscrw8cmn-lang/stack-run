import {
  CREW_EMBLEM_VIEW_BOX,
  CREW_EMBLEM_VIEW_BOX_HEIGHT,
  CREW_EMBLEM_VIEW_BOX_WIDTH,
  crewEmblemSvgMarkup,
  type CrewEmblem as CrewEmblemModel,
} from "../../crew/emblem";

interface CrewEmblemProps {
  emblem: CrewEmblemModel;
  /** Rendered width in CSS pixels; height follows the emblem's own ratio. */
  size?: number;
  /** Provide a name to expose the mark; omit it for decorative use. */
  label?: string;
  className?: string;
}

/**
 * A crew's emblem, drawn from its four choices.
 *
 * Deliberately presentational and self-contained: the same component draws
 * the 24 px switcher chip and the 200 px builder preview, so a crew's mark
 * can never be one shape in the header and another on the card.
 */
export function CrewEmblem({ emblem, size = 40, label, className }: CrewEmblemProps) {
  return (
    <svg
      className={["crew-emblem", className].filter(Boolean).join(" ")}
      viewBox={CREW_EMBLEM_VIEW_BOX}
      width={size}
      height={Math.round((size * CREW_EMBLEM_VIEW_BOX_HEIGHT) / CREW_EMBLEM_VIEW_BOX_WIDTH)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <g dangerouslySetInnerHTML={{ __html: crewEmblemSvgMarkup(emblem) }} />
    </svg>
  );
}
