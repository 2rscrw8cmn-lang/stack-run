import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { CSSProperties } from "react";
import { Button } from "../../components/ui/Button";
import { IconButton } from "../../components/ui/IconButton";

interface PlacementBarProps {
  /** CSS custom property reference, e.g. `"var(--easy)"` or `"var(--member-accent)"`. */
  pieceColor: string;
  width: number;
  height: number;
  /** e.g. "Place Easy" or "Move Easy". */
  title: string;
  /** e.g. "Column 3", or null when nothing fits. */
  positionLabel: string | null;
  /**
   * Whether the readout names the column. Personal Build does; Crew Build
   * keeps the coordinate for its controls and the landing slots' accessible
   * names, but a numbered grid column is not something a runner picks.
   */
  showPositionLabel?: boolean;
  canStepBack: boolean;
  canStepForward: boolean;
  onStep: (direction: -1 | 1) => void;
  onAutoPlace: () => void;
  onDrop: () => void;
  onCancel: () => void;
  /** True while a server round-trip for the drop is in flight. */
  pending?: boolean;
  /** A server-rejected placement, shown under the controls. */
  error?: string | null;
}

/**
 * The controls for a block that is hovering over a tower.
 *
 * A deliberate drag on the tower commits on release, so these are the tap
 * and keyboard path: step the block along with the arrows, see it in
 * position, and commit with `Drop`. Both paths are complete on their own.
 *
 * Where the readout names the column it stops there. The course it will land
 * on is gravity's answer rather than a choice, and saying it turned this into
 * a packing readout. The "no room left" state is always shown: that one is
 * about the tower, not about the grid.
 *
 * Generic over which tower it belongs to, so Personal and Crew Build share
 * one placement control rather than a bar apiece — Crew layers a pending
 * state and a server error message on top for its round-trip to the RPC.
 */
export function PlacementBar({
  pieceColor,
  width,
  height,
  title,
  positionLabel,
  showPositionLabel = true,
  canStepBack,
  canStepForward,
  onStep,
  onAutoPlace,
  onDrop,
  onCancel,
  pending = false,
  error = null,
}: PlacementBarProps) {
  return (
    <div className="placement-bar" role="group" aria-label="Place your block">
      <div className="placement-bar__block">
        <span
          className="placement-bar__chip"
          style={
            {
              "--piece-color": pieceColor,
              "--piece-span": width,
              "--piece-height": height,
            } as CSSProperties
          }
          aria-hidden="true"
        />
        <div className="placement-bar__detail">
          <p className="placement-bar__title">{title}</p>
          {(showPositionLabel || positionLabel === null) && (
            <p className="placement-bar__position">
              {positionLabel ?? "No room left in the tower"}
            </p>
          )}
        </div>
        <IconButton
          label="Cancel placing"
          icon={<X size={20} strokeWidth={1.8} />}
          onClick={onCancel}
          disabled={pending}
        />
      </div>

      <div className="placement-bar__controls">
        <IconButton
          label="Move block left"
          icon={<ChevronLeft size={22} strokeWidth={2} />}
          disabled={!canStepBack || pending}
          onClick={() => onStep(-1)}
        />
        <Button onClick={onDrop} disabled={positionLabel === null || pending}>
          {pending ? "Placing…" : "Drop"}
        </Button>
        <IconButton
          label="Move block right"
          icon={<ChevronRight size={22} strokeWidth={2} />}
          disabled={!canStepForward || pending}
          onClick={() => onStep(1)}
        />
      </div>

      <button
        type="button"
        className="placement-bar__auto"
        onClick={onAutoPlace}
        disabled={positionLabel === null || pending}
      >
        Auto Place
      </button>

      {error && (
        <p className="placement-bar__error" role="status">
          {error}
        </p>
      )}
    </div>
  );
}
