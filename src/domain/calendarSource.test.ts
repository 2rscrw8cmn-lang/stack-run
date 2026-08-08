import { afterEach, describe, expect, it, vi } from "vitest";
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
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the body of a successful response, without involving the server", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("BEGIN:VCALENDAR", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchCalendar("https://example.com/x.ics")).resolves.toBe(
      "BEGIN:VCALENDAR",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("https://example.com/x.ics", {
      headers: { Accept: "text/calendar" },
    });
  });

  it("asks the deployment's reader when the browser is refused", async () => {
    // A cross-origin refusal and a dead network are the same rejection here.
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("failed"))
      .mockResolvedValueOnce(new Response("BEGIN:VCALENDAR", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchCalendar("https://example.com/x.ics")).resolves.toBe(
      "BEGIN:VCALENDAR",
    );

    const [path, init] = fetchMock.mock.calls[1];
    expect(path).toBe("/api/calendar");
    expect(init.method).toBe("POST");
    // The link travels in the body, so it stays out of request logs.
    expect(init.body).toBe(
      JSON.stringify({ url: "https://example.com/x.ics" }),
    );
  });

  it("passes on the reader's own explanation when it has one", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValueOnce(new TypeError("failed"))
        .mockResolvedValueOnce(
          new Response("That link answered 403.", {
            status: 502,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          }),
        ),
    );

    await expect(fetchCalendar("https://example.com/x.ics")).rejects.toThrow(
      /answered 403\. Otherwise download the \.ics file/,
    );
  });

  it("points at the file picker when there is no reader deployed", async () => {
    // A static-only deployment answers /api/calendar with the app's own HTML.
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValueOnce(new TypeError("failed"))
        .mockResolvedValueOnce(
          new Response("<!doctype html>", {
            status: 404,
            headers: { "Content-Type": "text/html" },
          }),
        ),
    );

    await expect(fetchCalendar("https://example.com/x.ics")).rejects.toThrow(
      /Could not reach that link.*choose it below/s,
    );
  });

  it("reports the status of a link that answers with an error", async () => {
    // The host answered; asking again from a server would get the same answer.
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("nope", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchCalendar("https://example.com/x.ics")).rejects.toThrow(
      /answered 403/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects an empty calendar rather than importing nothing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("   ", { status: 200 })),
    );

    await expect(fetchCalendar("https://example.com/x.ics")).rejects.toThrow(
      CalendarFetchError,
    );
  });
});
