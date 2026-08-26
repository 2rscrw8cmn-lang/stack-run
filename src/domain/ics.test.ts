import { describe, expect, it } from "vitest";
import { CalendarParseError, parseCalendar } from "./ics.js";

function calendar(...events: string[]): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Test//EN",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}

const allDay = [
  "BEGIN:VEVENT",
  "UID:1@example.com",
  "SUMMARY:MICU Day",
  "DTSTART;VALUE=DATE:20260810",
  "DTEND;VALUE=DATE:20260811",
  "END:VEVENT",
].join("\r\n");

const timed = [
  "BEGIN:VEVENT",
  "UID:2@example.com",
  "SUMMARY:Clinic PM",
  "DTSTART;TZID=America/New_York:20260812T130000",
  "DTEND;TZID=America/New_York:20260812T210000",
  "END:VEVENT",
].join("\r\n");

describe("parseCalendar", () => {
  it("ignores a cancelled shift, which is a day off", () => {
    // Rosters keep a cancelled event rather than deleting it. Blocking a run
    // for one would be exactly backwards.
    const cancelled = [
      "BEGIN:VEVENT",
      "UID:3@example.com",
      "SUMMARY:MICU Day",
      "DTSTART;VALUE=DATE:20260815",
      "DTEND;VALUE=DATE:20260816",
      "STATUS:CANCELLED",
      "END:VEVENT",
    ].join("\r\n");
    const { shifts, skipped } = parseCalendar(calendar(allDay, cancelled));

    expect(shifts).toEqual([
      { date: "2026-08-10", label: "MICU Day", startTime: null, endTime: null },
    ]);
    // Not "skipped" either: there is nothing for the user to do about it.
    expect(skipped).toEqual([]);
  });

  it("keeps a confirmed shift", () => {
    const confirmed = allDay.replace(
      "END:VEVENT",
      "STATUS:CONFIRMED\r\nEND:VEVENT",
    );

    expect(parseCalendar(calendar(confirmed)).shifts).toHaveLength(1);
  });

  it("reads an all-day shift as one day, not two", () => {
    // An all-day DTEND is exclusive, so this is Aug 10 alone.
    const { shifts } = parseCalendar(calendar(allDay));

    expect(shifts).toEqual([
      { date: "2026-08-10", label: "MICU Day", startTime: null, endTime: null },
    ]);
  });

  it("reads a timed shift with its local start and end", () => {
    const { shifts } = parseCalendar(calendar(timed));

    expect(shifts).toEqual([
      {
        date: "2026-08-12",
        label: "Clinic PM",
        startTime: "13:00",
        endTime: "21:00",
      },
    ]);
  });

  it("converts a UTC time into the local day it falls on", () => {
    const event = [
      "BEGIN:VEVENT",
      "SUMMARY:Night",
      // Chosen so the local date depends on the conversion happening at all.
      "DTSTART:20260810T120000Z",
      "END:VEVENT",
    ].join("\r\n");

    const { shifts } = parseCalendar(calendar(event));
    const expected = new Date(Date.UTC(2026, 7, 10, 12, 0));
    const pad = (value: number) => String(value).padStart(2, "0");

    expect(shifts[0].date).toBe(
      `${expected.getFullYear()}-${pad(expected.getMonth() + 1)}-${pad(expected.getDate())}`,
    );
    expect(shifts[0].startTime).toBe(
      `${pad(expected.getHours())}:${pad(expected.getMinutes())}`,
    );
  });

  it("expands a multi-day shift into each day it covers", () => {
    const event = [
      "BEGIN:VEVENT",
      "SUMMARY:Weekend Call",
      "DTSTART;VALUE=DATE:20260814",
      "DTEND;VALUE=DATE:20260817",
      "END:VEVENT",
    ].join("\r\n");

    const { shifts } = parseCalendar(calendar(event));
    expect(shifts.map((shift) => shift.date)).toEqual([
      "2026-08-14",
      "2026-08-15",
      "2026-08-16",
    ]);
  });

  it("unfolds a wrapped line before reading it", () => {
    const event = [
      "BEGIN:VEVENT",
      "SUMMARY:Medical Intensive Care Unit",
      "  Day Shift",
      "DTSTART;VALUE=DATE:20260810",
      "END:VEVENT",
    ].join("\r\n");

    expect(parseCalendar(calendar(event)).shifts[0].label).toBe(
      "Medical Intensive Care Unit Day Shift",
    );
  });

  it("unescapes the text a summary is allowed to carry", () => {
    const event = [
      "BEGIN:VEVENT",
      "SUMMARY:Clinic\\, West\\; Room 4",
      "DTSTART;VALUE=DATE:20260810",
      "END:VEVENT",
    ].join("\r\n");

    expect(parseCalendar(calendar(event)).shifts[0].label).toBe(
      "Clinic, West; Room 4",
    );
  });

  it("skips a recurring event rather than inventing the days it would fall on", () => {
    const event = [
      "BEGIN:VEVENT",
      "SUMMARY:Every Monday",
      "DTSTART;VALUE=DATE:20260810",
      "RRULE:FREQ=WEEKLY;COUNT=12",
      "END:VEVENT",
    ].join("\r\n");

    const parsed = parseCalendar(calendar(event, allDay));

    expect(parsed.shifts.map((shift) => shift.label)).toEqual(["MICU Day"]);
    expect(parsed.skipped).toEqual([
      { label: "Every Monday", reason: "repeats on a rule" },
    ]);
  });

  it("reports an event whose date it cannot read", () => {
    const event = [
      "BEGIN:VEVENT",
      "SUMMARY:Broken",
      "DTSTART:not-a-date",
      "END:VEVENT",
    ].join("\r\n");

    const parsed = parseCalendar(calendar(event, allDay));
    expect(parsed.skipped).toEqual([
      { label: "Broken", reason: "has no readable date" },
    ]);
  });

  it("names an event with no summary rather than dropping it", () => {
    const event = [
      "BEGIN:VEVENT",
      "DTSTART;VALUE=DATE:20260810",
      "END:VEVENT",
    ].join("\r\n");

    expect(parseCalendar(calendar(event)).shifts[0].label).toBe("Untitled");
  });

  it("orders shifts by date", () => {
    const { shifts } = parseCalendar(calendar(timed, allDay));
    expect(shifts.map((shift) => shift.date)).toEqual([
      "2026-08-10",
      "2026-08-12",
    ]);
  });

  it("handles a file with LF line endings", () => {
    expect(parseCalendar(calendar(allDay).replace(/\r\n/g, "\n")).shifts).toHaveLength(
      1,
    );
  });

  it("rejects something that is not a calendar at all", () => {
    expect(() => parseCalendar("hello")).toThrow(CalendarParseError);
    expect(() => parseCalendar("")).toThrow(CalendarParseError);
  });

  it("rejects a calendar with nothing in it", () => {
    expect(() => parseCalendar(calendar())).toThrow(CalendarParseError);
  });
});
