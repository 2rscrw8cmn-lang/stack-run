import { useEffect, useRef } from "react";
import type { AvailabilityCalendar } from "../../domain/availability.js";
import { fetchCalendar } from "../../domain/calendarSource.js";
import { parseCalendar } from "../../domain/ics.js";

/**
 * Re-reads a remembered roster once, quietly, when the app opens.
 *
 * A shift calendar is somebody else's document and it changes without warning.
 * Requiring a tap on Refresh to notice means the blocked days are only ever as
 * current as the last time the user thought about them, which is the opposite
 * of the point.
 *
 * Three things it deliberately does not do:
 *
 * - **Say anything when it fails.** The stored roster is still the best thing
 *   available, and an error on every cold start for a link that is briefly
 *   down is noise, not information. The sheet's own Refresh is where a failure
 *   is worth reporting, because there the user asked.
 * - **Touch the choices.** Which shifts block a run, and whether the calendar
 *   is used at all, are the user's and survive every refresh.
 * - **Change the plan.** New blocked days surface as proposals on Plan, one
 *   accept at a time, exactly as an import does.
 */
export function useRosterRefresh(
  calendar: AvailabilityCalendar | null,
  onRefreshed: (calendar: AvailabilityCalendar) => void,
  fetchIcs: (url: string) => Promise<string> = fetchCalendar,
): void {
  // What was stored when the app opened, which is the only thing this is about.
  // Reacting to the current value instead would re-read a calendar the moment
  // the user finished importing it by hand, which is a request nobody made.
  const atOpen = useRef(calendar);
  // Once per load, whatever else re-renders.
  const done = useRef(false);

  useEffect(() => {
    const stored = atOpen.current;
    if (done.current || !stored?.sourceUrl || !stored.enabled) {
      return;
    }
    done.current = true;

    let abandoned = false;
    void (async () => {
      try {
        const parsed = parseCalendar(await fetchIcs(stored.sourceUrl!));
        if (abandoned) {
          return;
        }
        onRefreshed({
          ...stored,
          shifts: parsed.shifts,
          importedAt: new Date().toISOString(),
        });
      } catch {
        // Deliberately silent. See above.
      }
    })();

    return () => {
      abandoned = true;
    };
  }, [onRefreshed, fetchIcs]);
}
