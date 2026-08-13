import { Shuffle } from "lucide-react";
import type { CrewMemberAccent } from "../../crew/memberAccent";
import {
  RUNNER_ICON_PARTS,
  RUNNER_ICON_PART_LABEL,
  cycleRunnerIconPart,
  randomRunnerIcon,
  runnerIconPartName,
  runnerIconShape,
  type RunnerIcon as RunnerIconModel,
  type RunnerIconPart,
} from "../../crew/runnerIcon";
import { RunnerIcon } from "./RunnerIcon";

/**
 * Each part framed on its own band of the drawing, so a row shows the piece
 * being cycled rather than a shrunken copy of the whole figure. `extra` gets
 * the wider band because its options are scattered across the silhouette —
 * a bib stripe sits on the chest, a bolt off the shoulder.
 */
const PART_VIEW_BOX: Record<RunnerIconPart, string> = {
  head: "26 13 52 26",
  face: "26 38 52 30",
  body: "24 68 56 32",
  extra: "26 38 66 46",
};

function PartMark({ icon, part }: { icon: RunnerIconModel; part: RunnerIconPart }) {
  const shape = runnerIconShape(part, icon[part]);
  const plateClass = part === "extra" ? "runner-icon__mark" : "runner-icon__plate";
  return (
    <svg
      className="runner-icon-builder__mark"
      viewBox={PART_VIEW_BOX[part]}
      aria-hidden="true"
      focusable="false"
    >
      {shape.plates.map((d) => (
        <path key={d} className={plateClass} d={d} />
      ))}
      {shape.cuts?.map((d) => (
        <path key={d} className="runner-icon__cut" d={d} />
      ))}
    </svg>
  );
}

interface RunnerIconBuilderProps {
  icon: RunnerIconModel;
  /** The runner's member color — the icon's only color, never a second one. */
  accent: CrewMemberAccent;
  onChange: (icon: RunnerIconModel) => void;
}

/**
 * The Runner Icon editor.
 *
 * Four compact rows and a live mark kept in view while the runner works,
 * rather than a gallery of every part — twenty-four options laid out in full
 * would be a scrolling page on a phone, and the whole point of this mark is
 * that it is small.
 */
export function RunnerIconBuilder({ icon, accent, onChange }: RunnerIconBuilderProps) {
  return (
    <div className="runner-icon-builder" data-member-color={accent}>
      <div className="runner-icon-builder__stage technical-grid">
        <RunnerIcon icon={icon} accent={accent} size={104} label="Runner Icon preview" />
      </div>

      <div className="runner-icon-builder__parts">
        {RUNNER_ICON_PARTS.map((part) => {
          const label = RUNNER_ICON_PART_LABEL[part];
          return (
            <div className="runner-icon-builder__row" key={part}>
              <p className="machine-label">{label}</p>
              <div className="runner-icon-builder__selector">
                <button
                  type="button"
                  className="runner-icon-builder__arrow"
                  aria-label={`Previous ${label.toLowerCase()}`}
                  onClick={() => onChange(cycleRunnerIconPart(icon, part, -1))}
                >
                  ‹
                </button>
                <p className="runner-icon-builder__option">
                  <PartMark icon={icon} part={part} />
                  <span>{runnerIconPartName(part, icon[part])}</span>
                </p>
                <button
                  type="button"
                  className="runner-icon-builder__arrow"
                  aria-label={`Next ${label.toLowerCase()}`}
                  onClick={() => onChange(cycleRunnerIconPart(icon, part, 1))}
                >
                  ›
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        className="runner-icon-builder__random"
        onClick={() => onChange(randomRunnerIcon())}
      >
        <Shuffle size={15} strokeWidth={2} aria-hidden="true" />
        Surprise Me
      </button>
    </div>
  );
}
