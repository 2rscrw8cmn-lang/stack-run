import type { PointerEvent, RefObject } from "react";
import { useRef } from "react";

/**
 * How far a pointer has to travel before it counts as a drag rather than a
 * tap. Below this a finger that wobbles on the way up is still a tap, and a
 * tap must never commit a placement — it selects, and the caller commits with
 * its own confirm action. Above it the user is unmistakably carrying the
 * block somewhere.
 */
const DRAG_THRESHOLD_PX = 8;

interface DragSession {
  pointerId: number;
  startX: number;
  /** Set once the pointer has travelled past the threshold. */
  isDrag: boolean;
}

export interface ColumnOption {
  columnStart: number;
}

interface UseColumnDragPlacementArgs<Option extends ColumnOption> {
  /** The grid the pointer's x position is measured against. */
  containerRef: RefObject<HTMLElement | null>;
  /** Tracks across the placement grid — logical units, not visible columns. */
  gridUnits: number;
  /** The width, in units, of the block being carried. */
  width: number;
  options: readonly Option[];
  chosenColumnStart: number | undefined;
  onChoose: (option: Option) => void;
  /** Commits the chosen candidate. Release after a drag calls this. */
  onCommit: () => void;
}

/**
 * Pointer mechanics for carrying a hovering block sideways across the tower,
 * snapped to whichever anchors are actually valid landings. Anchors are
 * logical placement units — the finer grid an eight-column tower is built on
 * (issue #206) — so a turned block can be carried onto the half-column its
 * rotation needs. Extracted from Personal Build's `BuiltStructure` so Crew
 * Build gets the identical drag/tap feel — pick the block up from wherever the
 * finger went down, follow the finger, commit on release after a deliberate
 * drag — rather than a second implementation of the same interaction.
 *
 * The row is never touched here: gravity already decided it by the time an
 * option exists, so dragging can only ever choose a column.
 */
export function useColumnDragPlacement<Option extends ColumnOption>({
  containerRef,
  gridUnits,
  width,
  options,
  chosenColumnStart,
  onChoose,
  onCommit,
}: UseColumnDragPlacementArgs<Option>) {
  const dragRef = useRef<DragSession | null>(null);

  /**
   * Where the placement tracks actually start, and how wide one is.
   *
   * The grid pads itself for the oblique's depth and centres its tracks when
   * a capped unit leaves room to spare (issue #206), so the element's own box
   * is not the track run. The used `grid-template-columns` is a resolved list
   * of pixel tracks in every browser that lays the grid out, which is the
   * measurement rather than a second copy of the sizing rule; where it is not
   * available the padded box is a close enough fallback.
   */
  function trackRun(container: HTMLElement, bounds: DOMRect) {
    const style = getComputedStyle(container);
    const tracks = style.gridTemplateColumns
      .split(" ")
      .map((track) => Number.parseFloat(track))
      .filter((track) => Number.isFinite(track) && track > 0);
    if (tracks.length === gridUnits) {
      const run = tracks.reduce((total, track) => total + track, 0);
      const padLeft = Number.parseFloat(style.paddingLeft) || 0;
      const padRight = Number.parseFloat(style.paddingRight) || 0;
      const spare = bounds.width - padLeft - padRight - run;
      return {
        left: bounds.left + padLeft + Math.max(0, spare) / 2,
        unitWidth: run / gridUnits,
      };
    }
    return { left: bounds.left, unitWidth: bounds.width / gridUnits };
  }

  function dragToColumn(clientX: number) {
    const container = containerRef.current;
    if (!container || options.length === 0) {
      return;
    }
    const bounds = container.getBoundingClientRect();
    const { left, unitWidth } = trackRun(container, bounds);
    if (unitWidth <= 0) {
      return;
    }

    // Centre the block under the finger rather than pinning its left edge.
    const wanted = Math.round((clientX - left) / unitWidth - width / 2 + 1);
    const nearest = options.reduce((best, option) =>
      Math.abs(option.columnStart - wanted) <
      Math.abs(best.columnStart - wanted)
        ? option
        : best,
    );
    if (nearest.columnStart !== chosenColumnStart) {
      onChoose(nearest);
    }
  }

  /**
   * Picking the block up, from wherever the finger went down.
   *
   * Every landing gets this, not only the chosen one. A block three columns
   * wide has a landing starting at six different columns and they overlap, so
   * the topmost thing under a finger is usually not the slot the block is
   * currently sitting in — gating this on "chosen" meant a press in most of
   * the tower started no drag at all.
   *
   * Capture is taken on the slot the press landed on so the block keeps
   * following a finger that slides off it. `trackDrag`/`release` are meant to
   * live on the shared container rather than the slot for the same reason:
   * the slot that was grabbed stops being the chosen one the moment the drag
   * reaches the next column.
   */
  function grab(event: PointerEvent<HTMLElement>, option: Option) {
    if (option.columnStart !== chosenColumnStart) {
      onChoose(option);
    }
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      isDrag: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function trackDrag(event: PointerEvent<HTMLElement>) {
    const session = dragRef.current;
    // `buttons` is 0 for a mouse merely passing over the container.
    if (!session || session.pointerId !== event.pointerId || event.buttons === 0) {
      return;
    }
    if (Math.abs(event.clientX - session.startX) >= DRAG_THRESHOLD_PX) {
      session.isDrag = true;
    }
    if (session.isDrag) {
      dragToColumn(event.clientX);
    }
  }

  /**
   * Letting go. Release commits only after a deliberate drag — a plain tap on
   * a landing selects it and leaves confirmation to a separate action, which
   * is what keeps the tap and keyboard paths honest.
   */
  function release(event: PointerEvent<HTMLElement>) {
    const session = dragRef.current;
    dragRef.current = null;
    if (!session || session.pointerId !== event.pointerId || !session.isDrag) {
      return;
    }
    onCommit();
  }

  function cancelDrag() {
    dragRef.current = null;
  }

  return { grab, trackDrag, release, cancelDrag };
}
