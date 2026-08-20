import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

/** How far a drag must travel before it commits to a horizontal swipe rather than a vertical scroll or a tap. */
const DRAG_THRESHOLD_PX = 10;
/** How far a released swipe must have travelled to clear the row outright. */
const DISMISS_THRESHOLD_PX = 72;
/** Where the row lands once a dismiss commits, before the caller drops it from the list. */
const EXIT_DISTANCE_PX = 320;
/** Matches the CSS transition on `data-exiting`, so the row is gone from the DOM only once it's visibly gone from the screen. */
const EXIT_ANIMATION_MS = 180;

interface SwipeSession {
  pointerId: number;
  startX: number;
  startY: number;
  /** Null until the drag proves its direction; false once it proves vertical. */
  isHorizontalDrag: boolean | null;
}

/**
 * Swipe-left-to-clear for one row in a list — the gesture, not the row's own
 * markup. `touch-action: pan-y` on the row plus the direction check below is
 * what keeps a normal vertical scroll from being hijacked as a swipe: nothing
 * commits to horizontal until the drag has actually proven itself so.
 *
 * Pointer events rather than touch events, so a mouse-drag on desktop clears
 * a row the same way a finger does — there is no separate desktop affordance
 * to build or forget.
 */
export function useSwipeToDismiss(onDismiss: () => void) {
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setDragging] = useState(false);
  const [isExiting, setExiting] = useState(false);
  const session = useRef<SwipeSession | null>(null);

  function onPointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (isExiting) return;
    session.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      isHorizontalDrag: null,
    };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const active = session.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - active.startX;
    const deltaY = event.clientY - active.startY;

    if (active.isHorizontalDrag === null) {
      if (Math.abs(deltaX) < DRAG_THRESHOLD_PX && Math.abs(deltaY) < DRAG_THRESHOLD_PX) return;
      active.isHorizontalDrag = Math.abs(deltaX) > Math.abs(deltaY);
      if (active.isHorizontalDrag) {
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setDragging(true);
      }
    }
    if (!active.isHorizontalDrag) return;

    event.preventDefault();
    // Only leftward travel clears a row; dragging right just resists back to 0.
    setOffsetX(Math.min(0, deltaX));
  }

  function release(event: ReactPointerEvent<HTMLElement>) {
    const active = session.current;
    session.current = null;
    setDragging(false);
    if (!active || active.pointerId !== event.pointerId || !active.isHorizontalDrag) {
      setOffsetX(0);
      return;
    }
    if (-offsetX >= DISMISS_THRESHOLD_PX) {
      trigger();
    } else {
      setOffsetX(0);
    }
  }

  /** Plays the same exit a completed swipe would, for a button that does the same thing without one. */
  function trigger() {
    setExiting(true);
    setOffsetX(-EXIT_DISTANCE_PX);
    window.setTimeout(onDismiss, EXIT_ANIMATION_MS);
  }

  return {
    offsetX,
    isDragging,
    isExiting,
    trigger,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: release,
      onPointerCancel: release,
    },
  };
}
