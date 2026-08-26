import { Shuffle } from "lucide-react";
import type { CrewMemberAccent } from "../../crew/memberAccent.js";
import {
  RUNNER_ICON_DRAW_ORDER,
  RUNNER_ICON_PARTS,
  RUNNER_ICON_PART_LABEL,
  randomRunnerIcon,
  runnerIconPartName,
  selectableRunnerIconIndices,
  setRunnerIconPart,
  type RunnerIcon as RunnerIconModel,
  type RunnerIconPart,
} from "../../crew/runnerIcon.js";
import { RunnerIcon, RunnerIconPart as RunnerIconPartLayer } from "./RunnerIcon.js";

/**
 * Each part's own window onto the drawing, so a thumbnail is that part at a
 * size worth looking at rather than a shrunken copy of the whole figure.
 * `flair` gets the wide window because half its options live off the runner
 * entirely, and the point of the thumbnail is showing where they sit.
 */
const PART_VIEW_BOX: Record<RunnerIconPart, string> = {
  head: "22 4 56 40",
  face: "22 32 56 40",
  body: "22 58 56 40",
  flair: "8 30 88 56",
  background: "0 0 100 100",
};

/**
 * One option, drawn in place on the runner being built.
 *
 * The rest of the current icon is drawn with it, dimmed — which is the whole
 * trick of this grid: a flair or a backdrop is only a good choice in
 * combination, so the thumbnail shows the combination instead of an isolated
 * shape floating in a box. The backdrop is left out of every other part's
 * window, where it would be a large dim wash behind a small bright shape.
 */
function OptionThumb({
  icon,
  part,
  index,
}: {
  icon: RunnerIconModel;
  part: RunnerIconPart;
  index: number;
}) {
  const preview = setRunnerIconPart(icon, part, index);
  return (
    <svg
      className="runner-icon-builder__thumb-mark"
      viewBox={PART_VIEW_BOX[part]}
      aria-hidden="true"
      focusable="false"
    >
      {RUNNER_ICON_DRAW_ORDER.filter(
        (layer) => layer !== "background" || part === "background",
      ).map((layer) => (
        <RunnerIconPartLayer
          key={layer}
          icon={preview}
          part={layer}
          ghost={layer !== part}
        />
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
 * Every option for every part is on screen at once under a preview that stays
 * put while the runner scrolls — building an icon is a comparison, and the
 * arrows-and-labels version it replaces made the runner hold six shapes in
 * their head and read a name to find out what they were looking at. Nothing
 * here is named on screen: the shapes are the choice, and a name that has to
 * explain a 40px drawing is a name doing the drawing's job.
 */
export function RunnerIconBuilder({ icon, accent, onChange }: RunnerIconBuilderProps) {
  return (
    <div className="runner-icon-builder" data-member-color={accent}>
      <div className="runner-icon-builder__stage technical-grid">
        <RunnerIcon icon={icon} accent={accent} size={96} label="Runner Icon preview" />
        <button
          type="button"
          className="runner-icon-builder__random"
          onClick={() => onChange(randomRunnerIcon())}
        >
          <Shuffle size={14} strokeWidth={2} aria-hidden="true" />
          Surprise Me
        </button>
      </div>

      {RUNNER_ICON_PARTS.map((part) => {
        const label = RUNNER_ICON_PART_LABEL[part];
        return (
          <div className="runner-icon-builder__row" key={part}>
            <p className="machine-label" id={`runner-icon-${part}-label`}>
              {label}
            </p>
            <div
              className="runner-icon-builder__grid"
              role="group"
              aria-labelledby={`runner-icon-${part}-label`}
            >
              {selectableRunnerIconIndices(part).map((index) => (
                <button
                  key={index}
                  type="button"
                  className="runner-icon-builder__thumb"
                  aria-pressed={icon[part] === index}
                  aria-label={`${runnerIconPartName(part, index)} ${label.toLowerCase()}`}
                  onClick={() => onChange(setRunnerIconPart(icon, part, index))}
                >
                  <OptionThumb icon={icon} part={part} index={index} />
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
