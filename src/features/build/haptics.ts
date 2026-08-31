/**
 * The one physical answer the app makes: a tick under the thumb when a block
 * turns.
 *
 * Rotation is the only placement action with no travel of its own — a step
 * moves the ghost along the grid and a drop drops it, but a rotation happens
 * where the block already is, and on a small screen a thumb is usually over
 * the part that changed. The tick is what makes it land as a thing that
 * happened rather than a redraw.
 *
 * Deliberately not a general haptics layer. There is one pattern here because
 * there is one event worth feeling; a vocabulary of buzzes for every tap is
 * how a phone starts to feel cheap.
 */

/** Short enough to read as a tick rather than a buzz. */
const ROTATE_TICK_MS = 8;

/**
 * Fires the rotation tick where the platform has one.
 *
 * `navigator.vibrate` is absent on iOS Safari and present-but-refused inside
 * a cross-origin frame, and it throws on nothing — but it is still a platform
 * API called from a render path, so a failure here must never be the reason a
 * block does not turn. Silence is the correct degradation: the rotation is
 * the feedback, and the tick only ever accompanies it.
 */
export function rotationTick(): void {
  try {
    navigator.vibrate?.(ROTATE_TICK_MS);
  } catch {
    // A device that will not buzz still turns the block.
  }
}
