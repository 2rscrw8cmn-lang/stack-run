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

/** Where the deployment's calendar reader lives. See `api/calendar.ts`. */
const PROXY_PATH = "/api/calendar";

const UNREACHABLE =
  "Could not reach that link, either directly or through this app. Download the .ics file and choose it below instead.";

function requireCalendar(text: string): string {
  if (!text.trim()) {
    throw new CalendarFetchError("That link returned an empty calendar.");
  }
  return text;
}

/**
 * Asks the deployment's own function to read the link.
 *
 * The link goes in the body, not the query string, so it does not end up in
 * request logs. The function answers failures as short plain text, which is
 * worth showing; anything else — most likely a deployment without the function,
 * answering with the app's own HTML — is not, so it falls back to the message
 * that names the file picker.
 */
async function fetchThroughProxy(url: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(PROXY_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/calendar" },
      body: JSON.stringify({ url }),
    });
  } catch {
    throw new CalendarFetchError(UNREACHABLE);
  }

  if (!response.ok) {
    const isPlain = response.headers
      .get("content-type")
      ?.startsWith("text/plain");
    const reason = isPlain ? (await response.text()).trim() : "";
    throw new CalendarFetchError(
      reason && reason.length <= 200
        ? `${reason} Otherwise download the .ics file and choose it below.`
        : UNREACHABLE,
    );
  }

  return requireCalendar(await response.text());
}

/**
 * Fetches a calendar link.
 *
 * The page asks the calendar host itself first: when that works nothing but
 * the browser ever sees the link. It only works if the host allows
 * cross-origin reads, and rostering systems generally do not — so a refusal
 * falls through to the deployment's own function, which is not bound by the
 * same-origin rule.
 *
 * A refused read and a dead network are the same opaque rejection here, so
 * both take that path; a host that answers with an error status has genuinely
 * answered, and repeating the question from a server would get the same reply.
 */
export async function fetchCalendar(url: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: "text/calendar" } });
  } catch {
    return fetchThroughProxy(url);
  }

  if (!response.ok) {
    throw new CalendarFetchError(
      `That link answered ${response.status}. Check it is the current subscription link, or download the .ics file and choose it below.`,
    );
  }

  return requireCalendar(await response.text());
}
