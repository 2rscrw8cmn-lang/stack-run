/**
 * Where an imported calendar came from: a link the app can fetch, or the file
 * contents themselves.
 *
 * The distinction exists because of how people actually hold a calendar. A
 * rostering system gives you a subscription link, and on a phone that link is
 * all you have — extracting the file behind it means downloading it, finding
 * it in Files, opening it in something that shows text, and copying the lot.
 * Pasting the link is the obvious move, so the app has to understand one.
 */
export type CalendarSource =
  | { kind: "url"; url: string }
  | { kind: "text"; text: string };

/**
 * Calendar links are often handed out as `webcal://`, which is an ordinary
 * HTTPS request wearing a different scheme so the operating system opens a
 * calendar app. `fetch` does not know it.
 */
export function normalizeCalendarUrl(value: string): string {
  const trimmed = value.trim();
  return /^webcal:\/\//i.test(trimmed)
    ? trimmed.replace(/^webcal:\/\//i, "https://")
    : trimmed;
}

/** What the user pasted: a link to fetch, or a calendar to read as it stands. */
export function readCalendarSource(value: string): CalendarSource {
  const trimmed = value.trim();
  if (/^(https?|webcal):\/\/\S+$/i.test(trimmed)) {
    return { kind: "url", url: normalizeCalendarUrl(trimmed) };
  }
  return { kind: "text", text: trimmed };
}

/** A short name for a calendar, taken from its link when it has no better one. */
export function nameFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Imported calendar";
  }
}

export class CalendarFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalendarFetchError";
  }
}

/**
 * Fetches a calendar link from the browser.
 *
 * There is no server in this app, so the request goes straight from the page
 * to the calendar host — which only works if that host allows it. Many do not,
 * and a browser reports a blocked cross-origin request exactly as it reports a
 * dead network: an opaque failure. The message therefore covers both and
 * points at the fallback that always works, rather than guessing which
 * happened and being wrong half the time.
 */
export async function fetchCalendar(url: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: "text/calendar" } });
  } catch {
    throw new CalendarFetchError(
      "Could not reach that link. Either the calendar provider does not allow apps to read it directly, or the connection failed. Download the .ics file and choose it below instead.",
    );
  }

  if (!response.ok) {
    throw new CalendarFetchError(
      `That link answered ${response.status}. Check it is the current subscription link, or download the .ics file and choose it below.`,
    );
  }

  const text = await response.text();
  if (!text.trim()) {
    throw new CalendarFetchError("That link returned an empty calendar.");
  }
  return text;
}
