import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AvailabilityCalendar } from "../../domain/availability.js";
import { useRosterRefresh } from "./useRosterRefresh.js";

const ICS = [
  "BEGIN:VCALENDAR",
  "BEGIN:VEVENT",
  "SUMMARY:MICU Day",
  "DTSTART;VALUE=DATE:20260901",
  "DTEND;VALUE=DATE:20260902",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

function calendar(
  overrides: Partial<AvailabilityCalendar> = {},
): AvailabilityCalendar {
  return {
    name: "Roster",
    importedAt: "2026-08-01T06:00:00.000Z",
    sourceUrl: "https://roster.example/ical?key=abc",
    shifts: [{ date: "2026-08-05", label: "MICU Day", startTime: null, endTime: null }],
    blockingLabels: ["MICU Day"],
    enabled: true,
    ...overrides,
  };
}

describe("re-reading a remembered roster when the app opens", () => {
  it("replaces the shifts and keeps every choice made about them", async () => {
    const onRefreshed = vi.fn();
    renderHook(() =>
      useRosterRefresh(calendar(), onRefreshed, async () => ICS),
    );

    await waitFor(() => expect(onRefreshed).toHaveBeenCalled());
    const saved = onRefreshed.mock.calls[0][0] as AvailabilityCalendar;
    expect(saved.shifts).toEqual([
      { date: "2026-09-01", label: "MICU Day", startTime: null, endTime: null },
    ]);
    expect(saved.blockingLabels).toEqual(["MICU Day"]);
    expect(saved.enabled).toBe(true);
    expect(saved.sourceUrl).toBe("https://roster.example/ical?key=abc");
    expect(saved.importedAt).not.toBe("2026-08-01T06:00:00.000Z");
  });

  it("says nothing and keeps the stored roster when the read fails", async () => {
    const onRefreshed = vi.fn();
    const fetchIcs = vi.fn().mockRejectedValue(new Error("offline"));
    renderHook(() => useRosterRefresh(calendar(), onRefreshed, fetchIcs));

    await waitFor(() => expect(fetchIcs).toHaveBeenCalled());
    expect(onRefreshed).not.toHaveBeenCalled();
  });

  it("reads once, not once per render", async () => {
    const fetchIcs = vi.fn(async () => ICS);
    const { rerender } = renderHook(() =>
      useRosterRefresh(calendar(), vi.fn(), fetchIcs),
    );

    rerender();
    rerender();
    await waitFor(() => expect(fetchIcs).toHaveBeenCalledTimes(1));
  });

  it.each([
    ["there is no calendar", null],
    ["the calendar was typed in rather than linked", calendar({ sourceUrl: null })],
    ["the calendar is switched off", calendar({ enabled: false })],
  ])("does nothing when %s", async (_case, value) => {
    const fetchIcs = vi.fn(async () => ICS);
    renderHook(() => useRosterRefresh(value, vi.fn(), fetchIcs));

    expect(fetchIcs).not.toHaveBeenCalled();
  });
});
