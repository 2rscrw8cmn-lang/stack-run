import {
  CREW_EMBLEM_BODY_SECTIONS,
  CREW_EMBLEM_FRAMES,
  CREW_EMBLEM_INK,
  CREW_EMBLEM_SEAM,
  CREW_EMBLEM_SHAPES,
  CREW_EMBLEM_VIEW_BOX,
  CREW_EMBLEM_VIEW_BOX_HEIGHT,
  CREW_EMBLEM_VIEW_BOX_WIDTH,
  crewEmblemColor,
  type CrewEmblem as CrewEmblemModel,
  type CrewEmblemSection,
} from "../../crew/emblem";

/** Body offsets: the three plates interlock rather than stack edge to edge. */
const SECTION_OFFSET: Record<Exclude<CrewEmblemSection, "frame">, number> = {
  top: -4,
  middle: 0,
  bottom: 2,
};

/** A lighter face for the plate's top edge, so the mark reads as machined. */
function lighten(hex: string, amount: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const channels = [
    (value >> 16) + amount,
    ((value >> 8) & 255) + amount,
    (value & 255) + amount,
  ].map((channel) => Math.max(0, Math.min(255, channel)));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function Frame({ emblem }: { emblem: CrewEmblemModel }) {
  const frame = CREW_EMBLEM_FRAMES[emblem.frame.shape] ?? CREW_EMBLEM_FRAMES[0];
  if (!frame.d) return null;
  const color = crewEmblemColor(emblem.frame.color).value;
  const shared = {
    d: frame.d,
    fill: "none",
    strokeLinejoin: "miter" as const,
    strokeLinecap: frame.linecap,
  };
  return (
    <g className="crew-emblem__frame">
      <path {...shared} stroke={CREW_EMBLEM_INK} strokeWidth={frame.inkWidth} />
      <path {...shared} stroke={color} strokeWidth={frame.colorWidth} />
    </g>
  );
}

function Plate({
  emblem,
  section,
}: {
  emblem: CrewEmblemModel;
  section: Exclude<CrewEmblemSection, "frame">;
}) {
  const options = CREW_EMBLEM_SHAPES[section];
  const shape = options[emblem[section].shape] ?? options[0];
  const color = crewEmblemColor(emblem[section].color).value;
  const rule = shape.rule ?? "nonzero";
  return (
    <g className="crew-emblem__plate" transform={`translate(0 ${SECTION_OFFSET[section]})`}>
      <path d={shape.d} fill={CREW_EMBLEM_INK} fillRule={rule} transform="translate(0 5)" />
      <path
        d={shape.d}
        fill={lighten(color, 16)}
        fillRule={rule}
        transform="translate(0 -2)"
        stroke={CREW_EMBLEM_INK}
        strokeWidth={2.6}
        strokeLinejoin="round"
      />
      <path
        d={shape.d}
        fill={color}
        fillRule={rule}
        stroke={CREW_EMBLEM_INK}
        strokeWidth={2.6}
        strokeLinejoin="round"
      />
    </g>
  );
}

/** Neutral interlocks between the plates: joints, not editable pieces. */
function Seams() {
  return (
    <g className="crew-emblem__seams">
      <path d="M78 68 H102 V79 H78 Z" fill={CREW_EMBLEM_INK} />
      <path d="M82 68 H98 V76 H82 Z" fill={CREW_EMBLEM_SEAM} />
      <path d="M78 132 H102 V145 H78 Z" fill={CREW_EMBLEM_INK} />
      <path d="M82 135 H98 V143 H82 Z" fill={CREW_EMBLEM_SEAM} />
    </g>
  );
}

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
      <Frame emblem={emblem} />
      {CREW_EMBLEM_BODY_SECTIONS.map((section) => (
        <Plate key={section} emblem={emblem} section={section} />
      ))}
      <Seams />
    </svg>
  );
}
