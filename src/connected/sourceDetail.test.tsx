import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { IntervalsConnection } from "./intervals";
import {
  intervalsSourceDetailReader,
  SourceDetailReaderProvider,
  useSourceDetailReader,
  type SourceConnection,
  type SourceDetailReader,
} from "./sourceDetail";

/**
 * The seam R3 put between Run Detail and the outside world.
 *
 * Two properties matter here and nowhere else: production still refuses to
 * read without a real connection, and a reader stays the same object while the
 * connection's *value* is unchanged. The second one is not a micro-optimization
 * — callers put the reader in an effect's dependencies, so a reader rebuilt on
 * every render would re-read the source every time anything in the app changed.
 */

afterEach(() => vi.restoreAllMocks());

function Probe({ connection, onReader }: {
  connection: SourceConnection;
  onReader: (reader: SourceDetailReader | null) => void;
}) {
  onReader(useSourceDetailReader(connection));
  return null;
}

describe("production source-detail boundary", () => {
  it("produces no reader at all without a connection", () => {
    expect(intervalsSourceDetailReader(null)).toBeNull();
    expect(intervalsSourceDetailReader(undefined)).toBeNull();
    expect(intervalsSourceDetailReader("")).toBeNull();
  });

  it("delegates legacy proxy reads through the existing STACK reader", async () => {
    // A fresh Response per call: a body can only be read once.
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockImplementation(async () => new Response(JSON.stringify({ icu_intervals: [] })));

    const reader = intervalsSourceDetailReader("token")!;
    await reader.readDetail("a1");
    await reader.readProfile("a1");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("resource=activity&id=a1&intervals=true"),
      expect.anything(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("resource=activity-streams&id=a1"),
      expect.anything(),
    );
  });

  it("requests explicit JSON from Intervals for local API-key profile reads", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify([
        { type: "time", data: [0, 60] },
        { type: "heartrate", data: [140, 145] },
      ])));

    const reader = intervalsSourceDetailReader({ mode: "local-api-key", credential: "key" })!;
    const profile = await reader.readProfile("activity-1");

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/api/v1/activity/activity-1/streams.json?types=time,heartrate,altitude,velocity_smooth,cadence",
    );
    expect(profile?.samples).toHaveLength(2);
  });
});

describe("useSourceDetailReader", () => {
  it("keeps one reader while the connection's value is unchanged", () => {
    const readers: (SourceDetailReader | null)[] = [];
    const connection = (): IntervalsConnection => ({ mode: "local-api-key", credential: "key" });

    // The app rebuilds this object on every render; two of them are the same
    // connection and must not produce two readers.
    const view = render(<Probe connection={connection()} onReader={(r) => readers.push(r)} />);
    view.rerender(<Probe connection={connection()} onReader={(r) => readers.push(r)} />);

    expect(readers[0]).not.toBeNull();
    expect(readers[1]).toBe(readers[0]);
  });

  it("produces a new reader when the credential actually changes", () => {
    const readers: (SourceDetailReader | null)[] = [];
    const view = render(
      <Probe connection={{ mode: "local-api-key", credential: "one" }} onReader={(r) => readers.push(r)} />,
    );
    view.rerender(
      <Probe connection={{ mode: "local-api-key", credential: "two" }} onReader={(r) => readers.push(r)} />,
    );

    expect(readers[1]).not.toBe(readers[0]);
  });

  it("treats a legacy string token as the legacy proxy connection it has always been", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockImplementation(async () => new Response(JSON.stringify({ icu_intervals: [] })));
    const readers: (SourceDetailReader | null)[] = [];
    render(<Probe connection="legacy" onReader={(r) => readers.push(r)} />);

    await readers[0]!.readDetail("a1");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/intervals?"),
      expect.objectContaining({ headers: { "X-Stack-Sync-Token": "legacy" } }),
    );
  });

  it("lets a harness substitute a reader without any connection at all", () => {
    const injected: SourceDetailReader = {
      readDetail: async () => ({ intervals: [] }),
      readProfile: async () => null,
    };
    const readers: (SourceDetailReader | null)[] = [];

    render(
      <SourceDetailReaderProvider value={() => injected}>
        <Probe connection={null} onReader={(r) => readers.push(r)} />
      </SourceDetailReaderProvider>,
    );

    expect(readers[0]).toBe(injected);
  });
});
