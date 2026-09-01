/**
 * The app shell's two named seams.
 *
 * STACK is bounded to the viewport the user can actually see: `.app-shell` is
 * `100dvh` and does not scroll, one region inside it does, and the bottom nav
 * is an ordinary row of the shell underneath that region. The document never
 * scrolls, which is the whole point — a document that scrolls is what let iOS
 * Safari's collapsing toolbar move the nav around, and what made "pin the nav
 * with `position: fixed`" a guess about where the bottom of the screen
 * currently is rather than a fact.
 *
 * Two things need to reach across that structure, so both are named here
 * rather than found by each caller in its own way:
 *
 * - the scrolling region, for a screen that has to move the page itself;
 * - the dock, a shell row directly above the nav, where a screen's own bottom
 *   chrome (the placement controls) belongs.
 *
 * Both fall back cleanly when no shell is mounted — a screen rendered on its
 * own in a test, or the Getting Started page — so neither is load-bearing for
 * anything but the real app.
 */

import { createContext } from "react";

/** Marks the one intended app scroll container. */
export const APP_SCROLL_ATTRIBUTE = "data-app-scroll";

/**
 * The shell row directly above the primary nav, once the shell has mounted it.
 *
 * A context rather than a lookup, so a screen's bottom chrome can read it
 * while it renders and portal straight into it — and so nothing has to search
 * the document for an element the shell already has in hand.
 */
export const AppDockContext = createContext<HTMLElement | null>(null);

function scrollElement(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.querySelector<HTMLElement>(`[${APP_SCROLL_ATTRIBUTE}]`);
}

/** Where the app's content is currently scrolled to. */
export function appScrollTop(): number {
  const element = scrollElement();
  if (element) return element.scrollTop;
  return typeof window !== "undefined" && typeof window.scrollY === "number"
    ? window.scrollY
    : 0;
}

/** Moves the app's content, the way `window.scrollTo` used to. */
export function scrollAppTo(top: number): void {
  const element = scrollElement();
  if (element) {
    element.scrollTop = top;
    return;
  }
  if (typeof window !== "undefined" && typeof window.scrollTo === "function") {
    window.scrollTo(0, top);
  }
}
