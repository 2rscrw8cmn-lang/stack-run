import { addDaysToLocalDate, formatLocalDate } from "./dates.js";

/**
 * One shift from an imported calendar, reduced to what STACK needs to know:
 * which day it falls on, what it is called, and when it runs.
 *
 * Everything else in the file — locations, descriptions, attendees, unique
 * ids — is dropped at the door. The app only has to answer "can I run that
 * morning", and the less of somebody else's calendar it stores, the better.
 */
export interface CalendarShift {
  /** Local calendar date, `YYYY-MM-DD`. */
  date: string;
  /** The event summary, e.g. `MICU Day`. Empty summaries become `Untitled`. */
  label: string;
  /** Local `HH:MM`, or null for an all-day event. */
  startTime: string | null;
  endTime: string | null;
}

export interface ParsedCalendar {
  shifts: CalendarShift[];
  /**
   * Events that were recognised but not imported, with the reason. Reported
   * rather than dropped quietly: a schedule missing half its shifts is worse
   * than one that says what it could not read.
   */
  skipped: { label: string; reason: string }[];
}

export class CalendarParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalendarParseError";
  }
}

/**
 * iCalendar wraps long lines by starting the continuation with a space or a
 * tab (RFC 5545 §3.1). Unfolding has to happen before anything is read, or a
 * wrapped summary parses as a property nobody recognises.
 */
function unfold(text: string): string[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const unfolded: string[] = [];

  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += line.slice(1);
    } else {
      unfolded.push(line);
    }
  }
  return unfolded;
}

/** `DTSTART;TZID=America/New_York:20260810T090000` → name, params, value. */
function splitProperty(line: string): {
  name: string;
  params: Record<string, string>;
  value: string;
} | null {
  const colon = line.indexOf(":");
  if (colon === -1) {
    return null;
  }
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const [name, ...paramParts] = head.split(";");

  const params: Record<string, string> = {};
  for (const part of paramParts) {
    const equals = part.indexOf("=");
    if (equals > 0) {
      params[part.slice(0, equals).toUpperCase()] = part.slice(equals + 1);
    }
  }
  return { name: name.toUpperCase(), params, value };
}

/** RFC 5545 escapes commas, semicolons, backslashes, and newlines in text. */
function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

interface Moment {
  date: string;
  time: string | null;
}

/**
 * Reads a DATE or DATE-TIME value into a local date and time.
 *
 * A trailing `Z` is UTC and is converted, because a shift starting 23:00 UTC
 * is a different day where the runner lives. A value with a TZID is read as
 * wall-clock time in that zone and used as written: converting it properly
 * would need a timezone database, and the calendar being imported is one the
 * user reads in their own zone anyway. That assumption is why the import
 * screen shows the times it parsed.
 */
function parseMoment(value: string): Moment | null {
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return { date: `${year}-${month}-${day}`, time: null };
  }

  const dateTime = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(
    value,
  );
  if (!dateTime) {
    return null;
  }
  const [, year, month, day, hour, minute, , utc] = dateTime;

  if (utc) {
    const instant = new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
      ),
    );
    return {
      date: formatLocalDate(instant),
      time: `${String(instant.getHours()).padStart(2, "0")}:${String(
        instant.getMinutes(),
      ).padStart(2, "0")}`,
    };
  }

  return { date: `${year}-${month}-${day}`, time: `${hour}:${minute}` };
}

/**
 * Every date an event covers. An all-day DTEND is exclusive (RFC 5545 §3.6.1),
 * so a single all-day shift ends the morning after it starts and must not
 * count as two days.
 */
function datesCovered(start: Moment, end: Moment | null): string[] {
  if (!end || end.date <= start.date) {
    return [start.date];
  }

  const lastDate =
    start.time === null && end.time === null
      ? addDaysToLocalDate(end.date, -1)
      : end.date;

  const dates: string[] = [];
  for (
    let date = start.date;
    date <= lastDate && dates.length < 30;
    date = addDaysToLocalDate(date, 1)
  ) {
    dates.push(date);
  }
  return dates;
}

/**
 * Reads an iCalendar file into shifts.
 *
 * Recurrence rules are not expanded. Rostering exports list every shift
 * explicitly, and a half-implemented RRULE would invent working days that do
 * not exist — so a recurring event is skipped and reported instead.
 */
export function parseCalendar(text: string): ParsedCalendar {
  if (!/BEGIN:VCALENDAR/i.test(text)) {
    throw new CalendarParseError(
      "That does not look like a calendar file. Export an .ics file and try again.",
    );
  }

  const lines = unfold(text);
  const shifts: CalendarShift[] = [];
  const skipped: ParsedCalendar["skipped"] = [];

  let inEvent = false;
  let summary = "";
  let start: Moment | null = null;
  let end: Moment | null = null;
  let recurring = false;
  let unreadable = false;
  let cancelled = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^BEGIN:VEVENT$/i.test(trimmed)) {
      inEvent = true;
      summary = "";
      start = null;
      end = null;
      recurring = false;
      unreadable = false;
      cancelled = false;
      continue;
    }

    if (/^END:VEVENT$/i.test(trimmed)) {
      inEvent = false;
      const label = summary || "Untitled";
      // A cancelled shift is a day off, and rosters keep the event around
      // rather than deleting it. Blocking a run for one would be exactly
      // backwards.
      if (cancelled) {
        continue;
      }
      if (recurring) {
        skipped.push({ label, reason: "repeats on a rule" });
      } else if (!start || unreadable) {
        skipped.push({ label, reason: "has no readable date" });
      } else {
        for (const date of datesCovered(start, end)) {
          shifts.push({
            date,
            label,
            startTime: start.time,
            endTime: end?.time ?? null,
          });
        }
      }
      continue;
    }

    if (!inEvent) {
      continue;
    }

    const property = splitProperty(trimmed);
    if (!property) {
      continue;
    }

    if (property.name === "SUMMARY") {
      summary = unescapeText(property.value);
    } else if (property.name === "RRULE") {
      recurring = true;
    } else if (property.name === "STATUS") {
      cancelled = /^CANCELLED$/i.test(property.value.trim());
    } else if (property.name === "DTSTART") {
      start = parseMoment(property.value);
      if (!start) {
        unreadable = true;
      }
    } else if (property.name === "DTEND") {
      end = parseMoment(property.value);
    }
  }

  if (shifts.length === 0 && skipped.length === 0) {
    throw new CalendarParseError(
      "That calendar has no events in it. Check the export and try again.",
    );
  }

  shifts.sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));
  return { shifts, skipped };
}
