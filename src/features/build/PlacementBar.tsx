import { ChevronLeft, ChevronRight, RotateCw, WandSparkles, X } from "lucide-react";
import { useContext, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { AppDockContext } from "../../app/appViewport.js";
import { Button } from "../../components/ui/Button.js";
import { IconButton } from "../../components/ui/IconButton.js";

interface PlacementBarProps {
  /** CSS custom property reference, e.g. `"var(--easy)"` or `"var(--member-accent)"`. */
  pieceColor: string;
  /** e.g. "Place Easy" or "Move Easy" — the control group's accessible name. */
  title: string;
  /**
   * Whether the block can be put down where it stands. The column itself is
   * deliberately not shown: a numbered grid column is not something a runner
   * picks, and the chosen landing on the tower already says where the block
   * is going.
   */
  canDrop: boolean;
  /**
   * Why the block cannot be put down, when it cannot. Distinguishes a tower
   * with no room left from a rotation that has taken the block off the grid —
   * the second is undone by turning it back, and saying "no room left" for it
   * sends the runner looking for space that was never the problem.
   */
  blockedReason?: string | null;
  canStepBack: boolean;
  canStepForward: boolean;
  onStep: (direction: -1 | 1) => void;
  /**
   * Turns the block 90°. Absent for a square block, which has no second
   * orientation to offer.
   */
  onRotate?: () => void;
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
 * A deliberate drag on the tower commits on release, so these are the tap and
 * keyboard path: step the block along with the arrows, turn it with Rotate,
 * see it in position, and commit with `Drop`. Every path is complete on its
 * own — nothing here is reachable only by gesture.
 *
 * One compact row, worn by both towers. It used to be two layouts: a bottom
 * sheet for Personal Build that covered the tower it was placing onto, and
 * Crew's in-field row. The sheet is gone rather than kept as an option,
 * because "the two Builds work differently" was the complaint, and a variant
 * nobody selects is just the old screen waiting to come back.
 *
 * What the block *is* lives above the tower in `PlacementContext`, not here.
 * These are the verbs.
 *
 * The row renders into the shell's dock — a shell row directly above the
 * primary nav, outside the app's scrolling region — rather than pinning
 * itself over the page. In the flow of the construction field it landed
 * wherever the tower happened to end, which on a tall tower was under the nav
 * (issue #204); pinned with `position: fixed` it was reachable, but only by
 * holding a copy of the nav's height and trusting the browser about where the
 * bottom of the screen was. Docked, it simply sits on the navigation, and the
 * page above ends where the controls begin instead of reserving room behind
 * them. Rendered in place when there is no shell — a screen on its own in a
 * test — so nothing depends on the dock existing.
 */
export function PlacementBar({
  pieceColor,
  title,
  canDrop,
  blockedReason = null,
  canStepBack,
  canStepForward,
  onStep,
  onRotate,
  onAutoPlace,
  onDrop,
  onCancel,
  pending = false,
  error = null,
}: PlacementBarProps) {
  const style = {
    "--piece-color": pieceColor,
  } as CSSProperties;

  const blocked = !canDrop;

  // The shell's dock row, or nothing when there is no shell — a screen
  // rendered on its own in a test keeps the controls in place.
  const dock = useContext(AppDockContext);

  const bar = (
    <div
      className="placement-bar"
      role="group"
      aria-label={`${title} controls`}
      style={style}
    >
      <div className="placement-bar__controls">
        <IconButton
          className="placement-bar__cancel"
          label="Cancel placing"
          title="Cancel placing"
          icon={<X size={20} strokeWidth={1.8} />}
          onClick={onCancel}
          disabled={pending}
        />
        <IconButton
          label="Move block left"
          icon={<ChevronLeft size={22} strokeWidth={2} />}
          disabled={!canStepBack || pending}
          onClick={() => onStep(-1)}
        />
        {onRotate && (
          <IconButton
            className="placement-bar__rotate"
            label="Rotate block"
            title="Rotate"
            icon={<RotateCw size={20} strokeWidth={1.9} />}
            onClick={onRotate}
            // Never disabled by a blocked position: turning the block back is
            // the way out of a rotation that took it off the grid, so this is
            // the one control that has to keep working while Drop cannot.
            disabled={pending}
          />
        )}
        <Button
          className="placement-bar__drop"
          onClick={onDrop}
          disabled={blocked || pending}
        >
          {pending ? "Placing…" : "Drop"}
        </Button>
        <IconButton
          label="Move block right"
          icon={<ChevronRight size={22} strokeWidth={2} />}
          disabled={!canStepForward || pending}
          onClick={() => onStep(1)}
        />
        <IconButton
          className="placement-bar__auto-icon"
          label="Auto Place"
          title="Auto Place"
          icon={<WandSparkles size={19} strokeWidth={1.8} />}
          onClick={onAutoPlace}
          // Auto Place still has somewhere to go when the *chosen* column is
          // off the grid: it is the one-tap way back to a position that works.
          disabled={pending}
        />
      </div>

      {blocked && blockedReason && (
        <p className="placement-bar__blocked" role="status">
          {blockedReason}
        </p>
      )}

      {error && (
        <p className="placement-bar__error" role="status">
          {error}
        </p>
      )}
    </div>
  );

  return dock ? createPortal(bar, dock) : bar;
}
