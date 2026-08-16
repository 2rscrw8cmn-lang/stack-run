import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { fetchIntervals } from "../../connected/intervals";
import { emptyRejectionCounts } from "../../history/historicalActivity";
import { fixtureActivities } from "../../history/historicalFixtures";
import {
  historicalActivities,
  type HistoricalSyncResult,
} from "../../history/historicalSync";
import {
  HISTORY_REFRESH_LOOKBACK_DAYS,
  HISTORY_STALE_AFTER_MS,
} from "../../history/historySyncPolicy";
import { historicalRun, stackRun } from "../../history/runnerFixtures";
import {
  loadHistorySyncRecord,
  saveHistorySyncRecord,
} from "../../storage/historySyncStateRepository";
import { useRunnerHistory, type RunnerHistoryOptions } from "./useRunnerHistory";

/**
 * The lifecycle end to end: the policy, NEXT-1's sync service and real
 * device storage, with only the network faked.
 *
 * The properties under test are the ones a runner would notice if they broke —
 * that opening the app twice does not fetch a year twice, that a rate limit
 * leaves the history that was already read in place, and that none of it can
 * stop the app working.
 */

const TODAY = "2026-08-15";
const connection = { mode: "local-api-key" as const, credential: "fake-personal-key" };

/** A reader that answers a window with whatever fixture activity falls in it. */
function reader(activities: readonly Record<string, unknown>[], calls: { ranges: string[] }) {
  return (async (_resource, _connection, range) => {
    if (!range) throw new Error("historical reads must always be ranged");
    calls.ranges.push(`${range.oldest}..${range.newest}`);
    return activities.filter((activity) => {
      const date = String(activity.start_date_local).slice(0, 10);
      return date >= range.oldest && date <= range.newest;
    });
  }) as typeof fetchIntervals;
}

function failingReader(message: string, calls: { ranges: string[] }) {
  return (async (_resource, _connection, range) => {
    calls.ranges.push(`${range!.oldest}..${range!.newest}`);
    throw new Error(message);
  }) as typeof fetchIntervals;
}

/** Renders the hook and prints everything a test needs to read. */
function Probe(options: RunnerHistoryOptions) {
  const history = useRunnerHistory(options);
  return (
    <div>
      <p data-testid="phase">{history.phase}</p>
      <p data-testid="runs">{history.runs.length}</p>
      <p data-testid="activities">{history.activities.length}</p>
      <p data-testid="error">{history.error ?? "none"}</p>
      <button type="button" onClick={() => void history.refresh()}>
        Refresh
      </button>
    </div>
  );
}

function renderHistory(options: Partial<RunnerHistoryOptions> = {}) {
  return render(
    <Probe
      connection={connection}
      runLogs={[]}
      today={TODAY}
      now={() => Date.parse(`${TODAY}T09:00:00.000Z`)}
      {...options}
    />,
  );
}

function syncResult(activities: ReturnType<typeof historicalRun>[]): HistoricalSyncResult {
  return {
    activities,
    windows: [{ oldest: "2025-08-16", newest: TODAY }],
    windowsRead: 1,
    added: activities.length,
    updated: 0,
    unchanged: 0,
    rejected: emptyRejectionCounts(),
    failure: null,
    persisted: true,
    persistError: null,
  };
}

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("historical sync lifecycle", () => {
  it("asks Intervals for nothing at all without a connection", async () => {
    const calls = { ranges: [] as string[] };
    renderHistory({
      connection: null,
      read: undefined,
      sync: (async () => {
        calls.ranges.push("called");
        throw new Error("must not sync without a connection");
      }) as never,
    });

    await waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent("no-connection"));
    expect(calls.ranges).toEqual([]);
  });

  it("still gives a manual-only runner a complete history from their own runs", async () => {
    renderHistory({
      connection: null,
      runLogs: [stackRun("m-1", "2026-08-14"), stackRun("m-2", "2026-08-12")],
      sync: (async () => {
        throw new Error("must not sync without a connection");
      }) as never,
    });

    await waitFor(() => expect(screen.getByTestId("runs")).toHaveTextContent("2"));
    expect(screen.getByTestId("phase")).toHaveTextContent("no-connection");
    expect(screen.getByTestId("error")).toHaveTextContent("none");
  });

  it("reads a full year on a device that has never synced, in bounded windows", async () => {
    const calls = { ranges: [] as string[] };
    const activities = fixtureActivities({ newest: TODAY, runs: 60, everyDays: 5 });
    renderHistory({ read: reader(activities, calls) });

    await waitFor(() => expect(screen.getByTestId("activities")).toHaveTextContent("60"));
    // Paging really happened: a year does not arrive in one request.
    expect(calls.ranges.length).toBeGreaterThan(1);
    expect(loadHistorySyncRecord().lastCompleteAt).not.toBeNull();
    // And it is stored, so the next launch starts with it.
    expect(historicalActivities()).toHaveLength(60);
  });

  it("does not read again when the stored history is fresh", async () => {
    const calls = { ranges: [] as string[] };
    const activities = fixtureActivities({ newest: TODAY, runs: 10, everyDays: 5 });

    const first = renderHistory({ read: reader(activities, calls) });
    await waitFor(() => expect(screen.getByTestId("activities")).toHaveTextContent("10"));
    const firstReads = calls.ranges.length;
    first.unmount();

    // A second launch of the same app, minutes later.
    renderHistory({ read: reader(activities, calls) });
    await waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent("fresh"));
    expect(calls.ranges).toHaveLength(firstReads);
    expect(screen.getByTestId("activities")).toHaveTextContent("10");
  });

  it("refreshes stale history with a single short window", async () => {
    const calls = { ranges: [] as string[] };
    const activities = fixtureActivities({ newest: TODAY, runs: 10, everyDays: 5 });
    const now = Date.parse(`${TODAY}T09:00:00.000Z`);
    saveHistorySyncRecord({
      lastSuccessAt: new Date(now - HISTORY_STALE_AFTER_MS - 60_000).toISOString(),
      lastCompleteAt: new Date(now - HISTORY_STALE_AFTER_MS - 60_000).toISOString(),
      lastAttemptAt: new Date(now - HISTORY_STALE_AFTER_MS - 60_000).toISOString(),
      lastFailureMessage: null,
      storedActivities: 10,
    });

    renderHistory({ read: reader(activities, calls) });

    await waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent("fresh"));
    // One window, not a year of them.
    expect(calls.ranges).toHaveLength(1);
    const [range] = calls.ranges;
    expect(range.endsWith(TODAY)).toBe(true);
    expect(range.startsWith("2026-07-01")).toBe(true); // 45 days back
    expect(HISTORY_REFRESH_LOOKBACK_DAYS).toBe(45);
  });

  it("keeps the history it managed to read when a window is rate limited", async () => {
    const calls = { ranges: [] as string[] };
    const activities = fixtureActivities({ newest: TODAY, runs: 40, everyDays: 5 });
    let window = 0;
    const rateLimitAfterFirst = (async (_resource, _connection, range) => {
      calls.ranges.push(`${range!.oldest}..${range!.newest}`);
      window += 1;
      if (window > 1) throw new Error("Intervals.icu is rate limiting sync. Try again later.");
      return activities.filter((activity) => {
        const date = String(activity.start_date_local).slice(0, 10);
        return date >= range!.oldest && date <= range!.newest;
      });
    }) as typeof fetchIntervals;

    renderHistory({ read: rateLimitAfterFirst });

    await waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent("partial"));
    // The first window's runs are stored, not discarded with the failure.
    expect(historicalActivities().length).toBeGreaterThan(0);
    expect(screen.getByTestId("error")).toHaveTextContent("rate limiting");
    // And the sync stopped rather than hammering the rest of the year.
    expect(calls.ranges).toHaveLength(2);
  });

  it("leaves the app fully usable when the whole read fails", async () => {
    const calls = { ranges: [] as string[] };
    renderHistory({
      runLogs: [stackRun("m-1", "2026-08-14"), stackRun("m-2", "2026-08-12")],
      read: failingReader("Run Data could not be reached.", calls),
    });

    await waitFor(() => expect(screen.getByTestId("error")).toHaveTextContent("could not be reached"));
    // The runner's own runs are still their history.
    expect(screen.getByTestId("runs")).toHaveTextContent("2");
    expect(screen.getByTestId("activities")).toHaveTextContent("0");
    // Nothing threw: the probe is still on screen.
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
  });

  it("does not retry on every focus event after a failure", async () => {
    const calls = { ranges: [] as string[] };
    renderHistory({
      read: failingReader("Run Data could not be reached.", calls),
    });

    await waitFor(() => expect(screen.getByTestId("error")).toHaveTextContent("could not be reached"));
    const attempts = calls.ranges.length;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      act(() => {
        window.dispatchEvent(new Event("focus"));
        document.dispatchEvent(new Event("visibilitychange"));
      });
    }
    await waitFor(() => expect(calls.ranges).toHaveLength(attempts));
  });

  it("does not expose an in-flight account A result after switching to account B", async () => {
    const accountAActivity = historicalRun("account-a-run", "2026-08-14");
    const accountBActivity = historicalRun("account-b-run", "2026-08-13");
    let resolveA!: (result: ReturnType<typeof syncResult>) => void;
    const sync = vi.fn(({ accountId }: { accountId?: string | null }) => {
      if (accountId === "account-a") {
        return new Promise<ReturnType<typeof syncResult>>((resolve) => {
          resolveA = resolve;
        });
      }
      return new Promise<ReturnType<typeof syncResult>>(() => undefined);
    }) as unknown as NonNullable<RunnerHistoryOptions["sync"]>;
    const stored = new Map<string | null, ReturnType<typeof historicalRun>[]>([
      ["account-a", []],
      ["account-b", [accountBActivity]],
    ]);
    const records = new Map<string | null, ReturnType<typeof loadHistorySyncRecord>>();
    const saveRecord = vi.fn((record, accountId) => records.set(accountId ?? null, record));

    const view = renderHistory({
      accountId: "account-a",
      sync,
      loadStored: (accountId) => stored.get(accountId ?? null) ?? [],
      loadRecord: (accountId) => records.get(accountId ?? null) ?? loadHistorySyncRecord("missing"),
      saveRecord,
    });
    await waitFor(() => expect(sync).toHaveBeenCalledWith(expect.objectContaining({ accountId: "account-a" })));

    view.rerender(
      <Probe
        connection={connection}
        accountId="account-b"
        runLogs={[]}
        today={TODAY}
        now={() => Date.parse(`${TODAY}T09:00:00.000Z`)}
        sync={sync}
        loadStored={(accountId) => stored.get(accountId ?? null) ?? []}
        loadRecord={(accountId) => records.get(accountId ?? null) ?? loadHistorySyncRecord("missing")}
        saveRecord={saveRecord}
      />,
    );
    await waitFor(() => expect(screen.getByTestId("activities")).toHaveTextContent("1"));
    await waitFor(() => expect(sync).toHaveBeenCalledWith(expect.objectContaining({ accountId: "account-b" })));

    await act(async () => resolveA(syncResult([accountAActivity])));

    expect(screen.getByTestId("activities")).toHaveTextContent("1");
    expect(screen.getByTestId("phase")).toHaveTextContent("syncing");
    expect(records.get("account-a")?.storedActivities).toBe(1);
    expect(records.get("account-b")).toBeUndefined();
  });

  it("does not carry account A's session retry cooldown into account B", async () => {
    const sync = vi.fn(async () => syncResult([])) as unknown as NonNullable<
      RunnerHistoryOptions["sync"]
    >;
    const view = renderHistory({ accountId: "account-a", sync });
    await waitFor(() => expect(sync).toHaveBeenCalledTimes(1));

    view.rerender(
      <Probe
        connection={connection}
        accountId="account-b"
        runLogs={[]}
        today={TODAY}
        now={() => Date.parse(`${TODAY}T09:00:00.000Z`)}
        sync={sync}
      />,
    );

    await waitFor(() => expect(sync).toHaveBeenCalledTimes(2));
    expect(sync).toHaveBeenLastCalledWith(expect.objectContaining({ accountId: "account-b" }));
  });

  it("reevaluates auto-sync on account change when the connection is unchanged", async () => {
    const now = Date.parse(`${TODAY}T09:00:00.000Z`);
    const freshA = {
      lastSuccessAt: new Date(now).toISOString(),
      lastCompleteAt: new Date(now).toISOString(),
      lastAttemptAt: new Date(now).toISOString(),
      lastFailureMessage: null,
      storedActivities: 4,
    };
    const sync = vi.fn(async () => syncResult([])) as unknown as NonNullable<
      RunnerHistoryOptions["sync"]
    >;
    const view = renderHistory({
      accountId: "account-a",
      sync,
      loadRecord: (accountId) =>
        accountId === "account-a" ? freshA : loadHistorySyncRecord("missing"),
    });
    await waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent("fresh"));
    expect(sync).not.toHaveBeenCalled();

    view.rerender(
      <Probe
        connection={connection}
        accountId="account-b"
        runLogs={[]}
        today={TODAY}
        now={() => now}
        sync={sync}
        loadRecord={(accountId) =>
          accountId === "account-a" ? freshA : loadHistorySyncRecord("missing")
        }
      />,
    );

    await waitFor(() => expect(sync).toHaveBeenCalledTimes(1));
    expect(sync).toHaveBeenCalledWith(expect.objectContaining({ accountId: "account-b" }));
  });

  it("reads on request even when the policy would have refused", async () => {
    const calls = { ranges: [] as string[] };
    const activities = fixtureActivities({ newest: TODAY, runs: 10, everyDays: 5 });
    renderHistory({ read: reader(activities, calls) });
    await waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent("fresh"));
    const automatic = calls.ranges.length;

    await act(async () => {
      screen.getByRole("button", { name: "Refresh" }).click();
    });

    await waitFor(() => expect(calls.ranges.length).toBe(automatic + 1));
  });

  it("reconciles an accepted run and its mirror into one history row", async () => {
    const calls = { ranges: [] as string[] };
    const activities = fixtureActivities({ newest: TODAY, runs: 5, everyDays: 5 });
    renderHistory({
      runLogs: [
        {
          ...stackRun("log-1", TODAY),
          source: "intervals" as const,
          externalSource: {
            provider: "intervals" as const,
            activityId: "fixture-1",
            sourceUpdatedAt: null,
            importedAt: `${TODAY}T13:00:00Z`,
          },
        },
      ],
      read: reader(activities, calls),
    });

    await waitFor(() => expect(screen.getByTestId("activities")).toHaveTextContent("5"));
    // Five source activities, one of them accepted: five runs, not six.
    expect(screen.getByTestId("runs")).toHaveTextContent("5");
  });
});
