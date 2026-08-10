import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialAppState } from "../../storage/migrations";
import type { AppState } from "../../domain/types";
import type { fetchIntervals } from "../../connected/intervals";
import { useConnectedSync } from "./useConnectedSync";

const activity = (id: string, date: string) => ({ id, type: "Run", start_date_local: `${date}T07:00:00`, distance: 5000, moving_time: 1500 });
/** A stub with the client's own signature, so the range argument stays typed. */
const reader = (respond: () => unknown): typeof fetchIntervals => vi.fn(async () => respond());
/** How many days a recorded call asked for. */
function rangeDays(call: Parameters<typeof fetchIntervals> | undefined): number {
  const range = call?.[2];
  if (!range) throw new Error("The sync asked for no date range.");
  return (Date.parse(`${range.newest}T00:00:00Z`) - Date.parse(`${range.oldest}T00:00:00Z`)) / 86_400_000;
}

function stateWith(overrides: Partial<AppState["intervalsSync"]> = {}, runLogs: AppState["runLogs"] = []): AppState {
  const base = createInitialAppState();
  return { ...base, runLogs, intervalsSync: { ...base.intervalsSync, ...overrides } };
}

afterEach(() => vi.restoreAllMocks());

describe("useConnectedSync", () => {
  it("syncs when the app opens with a connection and nothing recent", async () => {
    const read = vi.fn(reader(() => [activity("i1", "2026-08-09")]));
    const onSynced = vi.fn();
    const { result } = renderHook(() => useConnectedSync({ token: "t", state: stateWith(), onSynced, read }));

    await waitFor(() => expect(result.current.candidates).toHaveLength(1));
    expect(onSynced).toHaveBeenCalledTimes(1);
    // No stored sync yet, so the first look reaches back far enough to find a
    // HealthFit backlog rather than only the rolling window.
    expect(rangeDays(read.mock.calls[0])).toBe(90);
  });

  it("leaves a fresh sync alone and asks nothing at all", async () => {
    const read = vi.fn(reader(() => []));
    renderHook(() => useConnectedSync({ token: "t", state: stateWith({ lastSuccessfulActivitySyncAt: new Date().toISOString() }), onSynced: vi.fn(), read }));
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(read).not.toHaveBeenCalled();
  });

  it("uses the rolling lookback once a sync has succeeded, so a late upload is still found", async () => {
    const read = vi.fn(reader(() => []));
    const stale = new Date(Date.now() - 60 * 60_000).toISOString();
    renderHook(() => useConnectedSync({ token: "t", state: stateWith({ lastSuccessfulActivitySyncAt: stale }), onSynced: vi.fn(), read }));

    await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    expect(rangeDays(read.mock.calls[0])).toBe(14);
  });

  it("does not storm when returning to the app fires every event it has", async () => {
    const read = vi.fn(reader(() => []));
    renderHook(() => useConnectedSync({ token: "t", state: stateWith(), onSynced: vi.fn(), read }));
    await waitFor(() => expect(read).toHaveBeenCalledTimes(1));

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
    });
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("keeps a manual sync working when a quiet one would have been skipped", async () => {
    const read = vi.fn(reader(() => []));
    const { result } = renderHook(() => useConnectedSync({ token: "t", state: stateWith({ lastSuccessfulActivitySyncAt: new Date().toISOString() }), onSynced: vi.fn(), read }));
    expect(read).not.toHaveBeenCalled();

    await act(async () => { await result.current.sync(); });
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("reports a failure without losing the connection or blocking anything", async () => {
    const read = vi.fn(reader(() => { throw new Error("Intervals.icu could not be reached."); }));
    const onSynced = vi.fn();
    const { result } = renderHook(() => useConnectedSync({ token: "t", state: stateWith(), onSynced, read }));

    await waitFor(() => expect(result.current.error).toBe("Intervals.icu could not be reached."));
    expect(result.current.status).toBe("idle");
    expect(onSynced).not.toHaveBeenCalled();
  });

  it("hides a dismissed run for the session and drops a settled one outright", async () => {
    const read = vi.fn(reader(() => [activity("i1", "2026-08-09"), activity("i2", "2026-08-08")]));
    const { result } = renderHook(() => useConnectedSync({ token: "t", state: stateWith(), onSynced: vi.fn(), read }));
    await waitFor(() => expect(result.current.candidates).toHaveLength(2));

    act(() => result.current.dismiss("i1"));
    expect(result.current.candidates.map((candidate) => candidate.externalId)).toEqual(["i2"]);

    act(() => result.current.settle("i2"));
    expect(result.current.candidates).toHaveLength(0);
  });

  it("asks for nothing at all without a connection", async () => {
    const read = vi.fn(reader(() => []));
    renderHook(() => useConnectedSync({ token: null, state: stateWith(), onSynced: vi.fn(), read }));
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(read).not.toHaveBeenCalled();
  });
});
