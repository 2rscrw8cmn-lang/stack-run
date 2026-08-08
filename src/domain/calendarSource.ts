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

/**
 * A request that never answers is worse than one that fails: the app sits
 * there looking broken and the user has nothing to act on. Neither of these
 * is a performance budget — they are the point at which waiting longer stops
 * being useful.
 */
const DIRECT_TIMEOUT_MS = 8_000;
/** Longer, because the reader is allowed ten seconds of its own upstream. */
const READER_TIMEOUT_MS = 25_000;

function timeoutSignal(ms: number): AbortSignal | undefined {
  return typeof AbortSignal !== "undefined" &&
    typeof AbortSignal.timeout === "function"
    ? AbortSignal.timeout(ms)
    : undefined;
}

function isTimeout(caught: unknown): boolean {
  return (caught as { name?: string } | null)?.name === "TimeoutError";
}

const UNREACHABLE =
  "Could not reach that link, either directly or through this app. Download the .ics file and choose it below instead.";

/**
 * Told apart from an ordinary failure on purpose.
 *
 * Standing in front of the app with a link that will not import, the first
 * thing worth knowing is whether this build has a reader at all — a deploy
 * that has not finished, or one that dropped `api/`, looks exactly like a
 * calendar host having a bad day unless the app says which it is.
 */
const NO_READER =
  "This build has no calendar reader: /api/calendar did not answer. If the app was deployed just now, give it a minute and try again. Otherwise download the .ics file and choose it below.";

const TIMED_OUT =
  "The calendar reader did not answer in time. Try again, or download the .ics file and choose it below.";

function requireCalendar(text: string): string {
  if (!text.trim()) {
    throw new CalendarFetchError("That link returned an empty calendar.");
  }
  return text;
}

/** Enough of a calendar to be worth handing to the parser. */
function looksLikeCalendar(text: string): boolean {
  return text.toUpperCase().includes("BEGIN:VCALENDAR");
}

/**
 * Asks the deployment's own function to read the link.
 *
 * The link goes in the body, not the query string, so it does not end up in
 * request logs.
 *
 * The reader always answers a POST: with a calendar, or with its own short
 * plain-text explanation, which is worth repeating. A 404 or a 405 therefore
 * means there is no reader here. So does a 200 that is not a calendar, which
 * is what a static host does when it rewrites every unknown path to the app's
 * own HTML.
 */
async function fetchThroughProxy(url: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(PROXY_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/calendar" },
      body: JSON.stringify({ url }),
      signal: timeoutSignal(READER_TIMEOUT_MS),
    });
  } catch (caught) {
    throw new CalendarFetchError(isTimeout(caught) ? TIMED_OUT : UNREACHABLE);
  }

  if (response.status === 404 || response.status === 405) {
    throw new CalendarFetchError(NO_READER);
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

  const text = requireCalendar(await response.text());
  if (!looksLikeCalendar(text)) {
    throw new CalendarFetchError(NO_READER);
  }
  return text;
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
 * A refused read, a dead network and a host that never answers are all the
 * same thing from here — the page cannot see a response — so all three take
 * that path. A host that answers with an error status has genuinely answered,
 * and repeating the question from a server would get the same reply.
 */
export async function fetchCalendar(url: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "text/calendar" },
      signal: timeoutSignal(DIRECT_TIMEOUT_MS),
    });
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
