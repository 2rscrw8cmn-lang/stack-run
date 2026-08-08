import { describe, expect, it, vi } from "vitest";
import {
  CalendarFetchError,
  fetchCalendar,
  nameFromUrl,
  normalizeCalendarUrl,
  readCalendarSource,
} from "./calendarSource";

describe("readCalendarSource", () => {
  it("recognises a link", () => {
    expect(readCalendarSource("https://app.example.com/ical?key=abc")).toEqual({
      kind: "url",
      url: "https://app.example.com/ical?key=abc",
    });
  });

  it("recognises a link with spaces around it, as pasting tends to leave", () => {
    expect(readCalendarSource("  https://example.com/x.ics \n")).toEqual({
      kind: "url",
      url: "https://example.com/x.ics",
    });
  });

  it("turns a webcal link into the https request it really is", () => {
    expect(readCalendarSource("webcal://example.com/x.ics")).toEqual({
      kind: "url",
      url: "https://example.com/x.ics",
    });
    expect(normalizeCalendarUrl("WEBCAL://example.com/x")).toBe(
      "https://example.com/x",
    );
  });

  it("treats calendar contents as contents, not a link", () => {
    const body = "BEGIN:VCALENDAR\r\nEND:VCALENDAR";
    expect(readCalendarSource(body)).toEqual({ kind: "text", text: body });
  });

  it("treats prose as contents, so the parser explains the problem", () => {
    expect(readCalendarSource("my wife's schedule").kind).toBe("text");
  });
});

describe("nameFromUrl", () => {
  it("names a calendar after the host it came from", () => {
    expect(nameFromUrl("https://app.qgenda.com/ical?key=abc")).toBe(
      "app.qgenda.com",
    );
    expect(nameFromUrl("https://www.example.com/x.ics")).toBe("example.com");
  });

  it("falls back rather than throwing on nonsense", () => {
    expect(nameFromUrl("not a url")).toBe("Imported calendar");
  });
});

describe("fetchCalendar", () => {
  it("returns the body of a successful response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("BEGIN:VCALENDAR", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchCalendar("https://example.com/x.ics")).resolves.toBe(
      "BEGIN:VCALENDAR",
    );
    expect(fetchMock).toHaveBeenCalledWith("https://example.com/x.ics", {
      headers: { Accept: "text/calendar" },
    });
    vi.unstubAllGlobals();
  });

  it("explains a blocked or failed request, and points at the file picker", async () => {
    // A cross-origin refusal and a dead network are the same rejection here.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("failed")));

    await expect(fetchCalendar("https://example.com/x.ics")).rejects.toThrow(
      /does not allow apps to read it directly|connection failed/,
    );
    await expect(fetchCalendar("https://example.com/x.ics")).rejects.toThrow(
      /choose it below/,
    );
    vi.unstubAllGlobals();
  });

  it("reports the status of a link that answers with an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("nope", { status: 403 })),
    );

    await expect(fetchCalendar("https://example.com/x.ics")).rejects.toThrow(
      /answered 403/,
    );
    vi.unstubAllGlobals();
  });

  it("rejects an empty calendar rather than importing nothing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("   ", { status: 200 })),
    );

    await expect(fetchCalendar("https://example.com/x.ics")).rejects.toThrow(
      CalendarFetchError,
    );
    vi.unstubAllGlobals();
  });
});
