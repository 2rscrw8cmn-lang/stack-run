import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialAppState } from "../../storage/migrations";
import type { AppState, RunLog } from "../../domain/types";
import type { fetchIntervals } from "../../connected/intervals";
import { loadPendingIntervalsCandidates } from "../../storage/intervalsPendingRepository";
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

function importedRun(activityId: string): RunLog {
  return { id: `run-${activityId}`, workoutId: null, completedDate: "2026-08-09", activityType: "easy", distanceMiles: 3.11, durationSeconds: 1500, effort: "solid", notes: "", createdAt: "now", updatedAt: "now", source: "intervals", externalSource: { provider: "intervals", activityId, sourceUpdatedAt: null, importedAt: "now" }, importedMetrics: null };
}
/** A device that has synced before, so a normal sync uses the rolling window. */
const SYNCED_BEFORE = { lastSuccessfulActivitySyncAt: new Date(Date.now() - 60 * 60_000).toISOString() };
const ids = (result: { current: { candidates: { externalId: string }[] } }) =>
  result.current.candidates.map((candidate) => candidate.externalId);

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

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

/**
 * Issue #41 in full. The first 90-day read finds A, B and C; the next morning
 * the rolling 14-day read mentions only B and C, and A used to be gone — from
 * the screen and from any way of getting it back short of a fresh connection.
 */
describe("the unresolved Run Data queue", () => {
  const A = activity("a", "2026-07-01");
  const B = activity("b", "2026-08-08");
  const C = activity("c", "2026-08-09");

  async function firstSync(onSynced = vi.fn()) {
    const read = vi.fn(reader(() => [A, B, C]));
    const view = renderHook(() => useConnectedSync({ token: "t", state: stateWith(), onSynced, read }));
    await waitFor(() => expect(view.result.current.candidates).toHaveLength(3));
    expect(rangeDays(read.mock.calls[0])).toBe(90);
    return view;
  }

  it("keeps a run the next rolling read no longer covers", async () => {
    const first = await firstSync();
    first.unmount();

    const read = vi.fn(reader(() => [B, C]));
    const { result } = renderHook(() => useConnectedSync({ token: "t", state: stateWith(SYNCED_BEFORE), onSynced: vi.fn(), read }));

    await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    expect(rangeDays(read.mock.calls[0])).toBe(14);
    await waitFor(() => expect(ids(result)).toEqual(["c", "b", "a"]));
  });

  it("still has all three after a reload, before any sync answers", async () => {
    const first = await firstSync();
    first.unmount();

    const read = vi.fn(reader(() => new Promise(() => {})));
    const { result } = renderHook(() => useConnectedSync({ token: "t", state: stateWith(SYNCED_BEFORE), onSynced: vi.fn(), read }));
    expect(ids(result)).toEqual(["c", "b", "a"]);
  });

  it("drops a run once it is imported, and does not offer it again", async () => {
    const first = await firstSync();
    act(() => first.result.current.settle("b"));
    expect(ids(first.result)).toEqual(["c", "a"]);
    expect(loadPendingIntervalsCandidates().map((item) => item.externalId)).toEqual(["c", "a"]);
    first.unmount();

    // The reload filter is the belt to settle()'s braces: even a queue that
    // still held it would not offer a run the log already owns.
    const read = vi.fn(reader(() => [A, B, C]));
    const { result } = renderHook(() => useConnectedSync({ token: "t", state: stateWith(SYNCED_BEFORE, [importedRun("b")]), onSynced: vi.fn(), read }));
    await waitFor(() => expect(ids(result)).toEqual(["c", "a"]));
  });

  it("drops an ignored run and leaves it ignored", async () => {
    const first = await firstSync();
    act(() => first.result.current.settle("a"));
    first.unmount();

    const read = vi.fn(reader(() => [A, B, C]));
    const { result } = renderHook(() => useConnectedSync({ token: "t", state: stateWith({ ...SYNCED_BEFORE, ignoredActivityIds: ["a"] }), onSynced: vi.fn(), read }));
    await waitFor(() => expect(ids(result)).toEqual(["c", "b"]));
    expect(loadPendingIntervalsCandidates().map((item) => item.externalId)).not.toContain("a");
  });

  it("hides a dismissed run for this session only and offers it again in the next", async () => {
    const first = await firstSync();
    act(() => first.result.current.dismiss("c"));
    expect(ids(first.result)).toEqual(["b", "a"]);
    // Closing a suggestion is not ignoring it, so it stays on the device.
    expect(loadPendingIntervalsCandidates().map((item) => item.externalId)).toEqual(["c", "b", "a"]);
    first.unmount();

    const read = vi.fn(reader(() => []));
    const { result } = renderHook(() => useConnectedSync({ token: "t", state: stateWith(SYNCED_BEFORE), onSynced: vi.fn(), read }));
    expect(ids(result)).toEqual(["c", "b", "a"]);
  });

  it("updates a re-read run in place rather than listing it twice", async () => {
    const first = await firstSync();
    first.unmount();

    const corrected = { ...A, moving_time: 2400, distance: 9000 };
    const read = vi.fn(reader(() => [corrected]));
    const { result } = renderHook(() => useConnectedSync({ token: "t", state: stateWith(SYNCED_BEFORE), onSynced: vi.fn(), read }));

    await waitFor(() => expect(result.current.candidates.find((item) => item.externalId === "a")?.durationSeconds).toBe(2400));
    expect(ids(result)).toEqual(["c", "b", "a"]);
  });

  it("finds older runs on request without touching imports, ignores or sync history", async () => {
    // The device this fix ships to: it synced before, so its rolling window
    // cannot reach the run an earlier release discovered and then dropped.
    let window: unknown[] = [B, C];
    const read = vi.fn(reader(() => window));
    const onSynced = vi.fn();
    const { result } = renderHook(() => useConnectedSync({ token: "t", state: stateWith({ ...SYNCED_BEFORE, ignoredActivityIds: ["b"] }, [importedRun("c")]), onSynced, read }));
    await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    expect(rangeDays(read.mock.calls[0])).toBe(14);
    expect(ids(result)).toEqual([]);
    window = [A, B, C];

    let added: number | null = null;
    await act(async () => { added = await result.current.findOlderRuns(); });

    expect(rangeDays(read.mock.calls[1])).toBe(90);
    expect(added).toBe(1);
    expect(ids(result)).toEqual(["a"]);

    // A second look adds nothing, which is what the sheet says out loud.
    await act(async () => { added = await result.current.findOlderRuns(); });
    expect(added).toBe(0);
  });

  it("reports a failed older-runs read instead of a count", async () => {
    const read = vi.fn(reader(() => { throw new Error("Intervals.icu could not be reached."); }));
    const { result } = renderHook(() => useConnectedSync({ token: "t", state: stateWith(SYNCED_BEFORE), onSynced: vi.fn(), read }));
    await waitFor(() => expect(result.current.error).toBe("Intervals.icu could not be reached."));

    let added: number | null = 1;
    await act(async () => { added = await result.current.findOlderRuns(); });
    expect(added).toBeNull();
  });

  it("keeps the session usable and says so when the queue cannot be saved", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    const read = vi.fn(reader(() => [A, B, C]));
    const { result } = renderHook(() => useConnectedSync({ token: "t", state: stateWith(), onSynced: vi.fn(), read }));

    await waitFor(() => expect(result.current.candidates).toHaveLength(3));
    expect(result.current.error).toMatch(/could not save the list of runs/);
  });
});
