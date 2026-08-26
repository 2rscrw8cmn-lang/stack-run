import { useCallback, useEffect, useState } from "react";
import { PLACEMENT_DROP_MS } from "./placementDrop.js";

/**
 * Which block this session just placed, for as long as its landing lasts.
 *
 * Deliberately session state and nothing more: it is set by an intentional
 * placement and by nothing else, so a page load, an account hydration or a
 * routine Crew refresh brings a tower back exactly as it was, with no block
 * falling into a position it has held for days.
 *
 * Personal Build already carries this inside its placement payoff, which
 * outlives the landing on purpose; Crew has no payoff sentence, so it holds
 * the mark here for the length of the landing itself and then lets go, which
 * is also what makes a landing a moment rather than a badge on the newest
 * brick.
 */
export function useJustPlaced(holdMs: number = PLACEMENT_DROP_MS + 60) {
  const [justPlacedId, setJustPlacedId] = useState<string | null>(null);

  useEffect(() => {
    if (!justPlacedId) {
      return;
    }
    const timer = setTimeout(() => setJustPlacedId(null), holdMs);
    return () => clearTimeout(timer);
  }, [justPlacedId, holdMs]);

  // Marking is one call at the moment of commit. Re-marking the block that is
  // still landing changes nothing — the same block moved twice inside one
  // landing simply keeps the landing it already has, which is the harmless
  // half of "correct even when the animation is skipped".
  const markJustPlaced = useCallback((id: string) => setJustPlacedId(id), []);

  return { justPlacedId, markJustPlaced };
}
