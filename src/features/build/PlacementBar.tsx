import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { CSSProperties } from "react";
import { Button } from "../../components/ui/Button";
import { IconButton } from "../../components/ui/IconButton";
import { WORKOUT_TYPE_LABEL, type EarnedBlock } from "../../domain/build";
import type { PlacementOption } from "../../domain/placement";

interface PlacementBarProps {
  block: EarnedBlock;
  isMove: boolean;
  candidate: PlacementOption | null;
  canStepBack: boolean;
  canStepForward: boolean;
  onStep: (direction: -1 | 1) => void;
  onAutoPlace: () => void;
  onDrop: () => void;
  onCancel: () => void;
}

/**
 * The controls for a block that is hovering over the tower.
 *
 * A deliberate drag on the tower now commits on release, so these are the tap
 * and keyboard path: step the block along with the arrows, see it in position,
 * and commit with `Drop`. Both paths are complete on their own.
 *
 * The readout names the column and stops there. The course it will land on is
 * gravity's answer rather than a choice, and saying it turned this into a
 * packing readout.
 */
export function PlacementBar({
  block,
  isMove,
  candidate,
  canStepBack,
  canStepForward,
  onStep,
  onAutoPlace,
  onDrop,
  onCancel,
}: PlacementBarProps) {
  return (
    <div className="placement-bar" role="group" aria-label="Place your block">
      <div className="placement-bar__block">
        <span
          className="placement-bar__chip"
          style={
            {
              "--piece-color": `var(--${block.runLog.activityType})`,
              "--piece-span": block.footprint.width,
              "--piece-height": block.footprint.height,
            } as CSSProperties
          }
          aria-hidden="true"
        />
        <div className="placement-bar__detail">
          <p className="placement-bar__title">
            {isMove ? "Move" : "Place"}{" "}
            {WORKOUT_TYPE_LABEL[block.runLog.activityType]}
          </p>
          <p className="placement-bar__position">
            {candidate
              ? `Column ${candidate.columnStart}`
              : "No room left in the tower"}
          </p>
        </div>
        <IconButton
          label="Cancel placing"
          icon={<X size={20} strokeWidth={1.8} />}
          onClick={onCancel}
        />
      </div>

      <div className="placement-bar__controls">
        <IconButton
          label="Move block left"
          icon={<ChevronLeft size={22} strokeWidth={2} />}
          disabled={!canStepBack}
          onClick={() => onStep(-1)}
        />
        <Button onClick={onDrop} disabled={candidate === null}>
          Drop
        </Button>
        <IconButton
          label="Move block right"
          icon={<ChevronRight size={22} strokeWidth={2} />}
          disabled={!canStepForward}
          onClick={() => onStep(1)}
        />
      </div>

      <button
        type="button"
        className="placement-bar__auto"
        onClick={onAutoPlace}
        disabled={candidate === null}
      >
        Auto Place
      </button>
    </div>
  );
}
