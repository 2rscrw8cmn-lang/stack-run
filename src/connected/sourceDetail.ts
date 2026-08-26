import { createContext, useContext, useMemo } from "react";
import {
  fetchIntervalsActivityDetail,
  fetchIntervalsRunProfile,
  intervalsBasicAuthorization,
  normalizeIntervalsRunProfile,
  RUN_PROFILE_STREAM_TYPES,
  type IntervalsActivityDetail,
  type IntervalsConnection,
  type IntervalsRunProfile,
} from "./intervals.js";

/**
 * The external read boundary Run Detail depends on.
 *
 * Run Detail needs exactly two things from outside the app: the structured
 * groups a source recorded for one activity, and that activity's per-sample
 * profile. Naming those two reads as an interface — rather than letting the
 * detail surface call `fetch` wrappers directly — is what lets the reusable QA
 * Runner review the real Run Profile presentation with no credential and no
 * network, and it is the seam a historical-only run now uses to reach the same
 * source-owned detail an accepted run already had.
 *
 * A reader is already bound to whatever credential it needs. Nothing that
 * consumes one can tell a production read from a synthetic one, and nothing
 * about the production token/network boundary is relaxed to make that true:
 * the production factory still refuses to produce a reader without a
 * connection, exactly as the old inline `if (!token)` did.
 */
export interface SourceDetailReader {
  /** Structured source groups. Rejects on a genuine read failure. */
  readDetail(activityId: string): Promise<IntervalsActivityDetail>;
  /**
   * The run's per-sample profile, or `null` when the source has none STACK
   * recognizes. `null` is an ordinary answer, not a failure.
   */
  readProfile(activityId: string): Promise<IntervalsRunProfile | null>;
}

/** Whatever the current device holds, including the legacy string token. */
export type SourceConnection = IntervalsConnection | string | null | undefined;

/**
 * How a device turns its connection into a reader.
 *
 * `null` means this device cannot read richer source detail at all, which is
 * the normal case for a runner who has never connected Intervals. Callers
 * render the normalized summary and nothing else.
 */
export type SourceDetailReaderFactory = (connection: SourceConnection) => SourceDetailReader | null;

/**
 * Intervals' streams route is format-sensitive in current deployments. The
 * server-proxy path is fixed in `api/intervals.ts`; local API-key mode reaches
 * Intervals directly, so it must request JSON explicitly here as well.
 */
async function readDirectProfileJson(
  activityId: string,
  connection: IntervalsConnection & { mode: "local-api-key" },
): Promise<IntervalsRunProfile | null> {
  let response: Response;
  try {
    response = await fetch(
      `https://intervals.icu/api/v1/activity/${encodeURIComponent(activityId)}/streams.json?types=${RUN_PROFILE_STREAM_TYPES.join(",")}`,
      {
        headers: { Authorization: intervalsBasicAuthorization(connection.credential) },
        cache: "no-store",
      },
    );
  } catch {
    throw new Error(
      "Run detail could not be loaded. Check this device's connection and browser access to Intervals.icu.",
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error(
      "Intervals.icu did not accept that personal API key. Copy a new key from Developer Settings and try again.",
    );
  }
  if (response.status === 429) {
    throw new Error("Intervals.icu is rate limiting requests. Try again later.");
  }
  if (!response.ok) throw new Error(`Run detail could not be loaded (HTTP ${response.status}).`);

  try {
    return normalizeIntervalsRunProfile(await response.json());
  } catch {
    throw new Error("Run detail could not be loaded: Intervals.icu returned an unreadable response.");
  }
}

function readProfile(
  activityId: string,
  connection: Exclude<SourceConnection, null | undefined | "">,
): Promise<IntervalsRunProfile | null> {
  if (typeof connection !== "string" && connection.mode === "local-api-key") {
    return readDirectProfileJson(activityId, connection);
  }
  return fetchIntervalsRunProfile(activityId, connection);
}

/** The production reader: the existing Intervals reads, with explicit JSON for profile streams. */
export const intervalsSourceDetailReader: SourceDetailReaderFactory = (connection) =>
  connection
    ? {
        readDetail: (activityId) => fetchIntervalsActivityDetail(activityId, connection),
        readProfile: (activityId) => readProfile(activityId, connection),
      }
    : null;

/**
 * Production by default, so ordinary product code never has to opt in and a
 * missing provider can never quietly disable a real runner's Run Profile.
 */
const SourceDetailReaderContext = createContext<SourceDetailReaderFactory>(
  intervalsSourceDetailReader,
);

/** Only the QA harness supplies this. See `src/qa/qaSourceDetail.ts`. */
export const SourceDetailReaderProvider = SourceDetailReaderContext.Provider;

/**
 * What the connection *is*, as a value rather than as an object identity.
 *
 * The app rebuilds its `IntervalsConnection` object on every render, so a
 * reader keyed on that object would be a new reader every render — and an
 * effect that depends on the reader would re-read the source every time
 * anything in the app changed. Two connections that name the same mode and
 * the same credential are the same connection, and this says so.
 */
function connectionKey(connection: SourceConnection): string {
  if (!connection) return "";
  return typeof connection === "string"
    ? `legacy-proxy:${connection}`
    : `${connection.mode}:${connection.credential}`;
}

/** The key read back as a connection. A bare string token is a legacy proxy one. */
function connectionFromKey(key: string): IntervalsConnection | null {
  if (!key) return null;
  const separator = key.indexOf(":");
  return {
    mode: key.slice(0, separator) as IntervalsConnection["mode"],
    credential: key.slice(separator + 1),
  };
}

/**
 * The reader for this device's connection, or null when there can be none.
 *
 * Stable while the connection's value is unchanged, which is what makes it
 * safe for a caller to put in an effect's dependencies: the source is read
 * because a run's detail opened, not because the app re-rendered.
 */
export function useSourceDetailReader(connection: SourceConnection): SourceDetailReader | null {
  const readerFor = useContext(SourceDetailReaderContext);
  const key = connectionKey(connection);
  return useMemo(() => readerFor(connectionFromKey(key)), [readerFor, key]);
}
