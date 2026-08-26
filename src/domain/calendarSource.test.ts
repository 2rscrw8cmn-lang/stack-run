import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CalendarFetchError,
  fetchCalendar,
  nameFromFile,
  nameFromUrl,
  normalizeCalendarUrl,
  readCalendarSource,
} from "./calendarSource.js";

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

describe("nameFromFile", () => {
  it("names a calendar after the file, without its extension", () => {
    expect(nameFromFile("Sarah shifts.ics")).toBe("Sarah shifts");
    expect(nameFromFile("roster")).toBe("roster");
  });

  it("ignores the names a phone invents", () => {
    // Safari saves a downloaded calendar as plain `text`.
    expect(nameFromFile("text")).toBe("Imported calendar");
    expect(nameFromFile("text.txt")).toBe("Imported calendar");
    expect(nameFromFile("Untitled")).toBe("Imported calendar");
    expect(nameFromFile("calendar.ics")).toBe("Imported calendar");
    expect(nameFromFile(".ics")).toBe("Imported calendar");
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
    const [target, init] = fetchMock.mock.calls[0];
    expect(target).toBe("https://example.com/x.ics");
    expect(init.headers).toEqual({ Accept: "text/calendar" });
    // A request that never answers must not leave the app waiting forever.
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("treats a host that never answers as one that refused", async () => {
    const timeout = Object.assign(new Error("timed out"), {
      name: "TimeoutError",
    });
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(timeout)
      .mockResolvedValueOnce(new Response("BEGIN:VCALENDAR", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchCalendar("https://example.com/x.ics")).resolves.toBe(
      "BEGIN:VCALENDAR",
    );
    expect(fetchMock.mock.calls[1][0]).toBe("/api/calendar");
  });

  it("says so when the reader itself never answers", async () => {
    const timeout = Object.assign(new Error("timed out"), {
      name: "TimeoutError",
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeout));

    await expect(fetchCalendar("https://example.com/x.ics")).rejects.toThrow(
      /did not answer in time/,
    );
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

  it("says when the build has no reader, rather than blaming the calendar", async () => {
    // A deployment without the function answers a POST to it with a 404.
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValueOnce(new TypeError("failed"))
        .mockResolvedValueOnce(
          new Response("Not Found", {
            status: 404,
            headers: { "Content-Type": "text/plain" },
          }),
        ),
    );

    await expect(fetchCalendar("https://example.com/x.ics")).rejects.toThrow(
      /no calendar reader/,
    );
  });

  it("is not fooled by a static host that rewrites everything to the app", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValueOnce(new TypeError("failed"))
        .mockResolvedValueOnce(
          new Response("<!doctype html><title>STACK</title>", {
            status: 200,
            headers: { "Content-Type": "text/html" },
          }),
        ),
    );

    await expect(fetchCalendar("https://example.com/x.ics")).rejects.toThrow(
      /no calendar reader/,
    );
  });

  it("points at the file picker when nothing can be reached at all", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("failed")));

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
