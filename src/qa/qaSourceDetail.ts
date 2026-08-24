import {
  normalizeIntervalsActivityDetail,
  normalizeIntervalsRunProfile,
} from "../connected/intervals";
import type { SourceDetailReader, SourceDetailReaderFactory } from "../connected/sourceDetail";

/**
 * Deterministic synthetic answers to the two external reads Run Detail makes.
 *
 * The QA Runner deliberately holds no Intervals credential and calls Intervals
 * never, which left one real gap in owner review: the Run Profile is fetched
 * on demand, so with nothing to fetch it simply never appeared. Every phase
 * since has reviewed a Run Detail missing the surface that is arguably its
 * whole point.
 *
 * This closes that gap at the read boundary rather than inside the components.
 * `RunResultDetail`, `HistoricalRunSheet` and `SourceRunDetail` know nothing
 * about QA; they ask a `SourceDetailReader` for a run's detail and profile and
 * render whatever comes back. Here that reader answers from a fixture instead
 * of from the network.
 *
 * Two further things are deliberate:
 *
 * 1. **The payloads are raw, not normalized.** They are shaped like an
 *    upstream streams/activity response and handed to the real
 *    `normalizeIntervalsRunProfile` / `normalizeIntervalsActivityDetail`. QA
 *    therefore exercises the production normalizer, the production chart and
 *    the production summary-number discipline, not a QA-only rendering path.
 * 2. **This proves rendering, never source truth.** Synthetic samples cannot
 *    verify a real Intervals stream shape or unit. The Run Profile stream rows
 *    in `docs/CONNECTED_DATA_FIELDS.md` stay `Expected` until a real pipeline
 *    says otherwise, and nothing here may be cited as evidence for promoting
 *    them.
 *
 * There is no route, no coordinate, no FIT payload and no personal data below,
 * and nothing here is written anywhere: the fixture is generated on demand and
 * lives only as long as the sheet that asked for it.
 */

/** The accepted/logged QA run whose source supplied a full profile. */
export const QA_RICH_PROFILE_ACTIVITY_ID = "qa-detail-rich";
/** The accepted/logged QA run whose source supplied summary aggregates only. */
export const QA_AGGREGATE_ONLY_ACTIVITY_ID = "qa-detail-aggregate";
/** The historical-only QA run whose source supplied a full profile. */
export const QA_HISTORICAL_RICH_ACTIVITY_ID = "qa-detail-history-rich";
/** The historical-only QA run whose source supplied summary aggregates only. */
export const QA_HISTORICAL_AGGREGATE_ACTIVITY_ID = "qa-detail-history-aggregate";

const METERS_PER_MILE = 1609.344;

interface ProfileShape {
  sampleCount: number;
  intervalSeconds: number;
  /** Whole-run pace the velocity samples should average around, seconds/mile. */
  paceSecondsPerMile: number;
  startHeartRate: number;
  endHeartRate: number;
  /** Where the heart-rate strap drops out, as inclusive sample indexes. */
  heartRateGap: [number, number];
  /** Where the position stream drops out, so pace and cadence break together. */
  positionGap: [number, number];
  /** One sample the runner spent standing still. */
  stopIndex: number;
  startElevationMeters: number;
  /** Verbatim at the source's convention: the number, never doubled. */
  cadence: number;
}

function within([first, last]: [number, number], index: number): boolean {
  return index >= first && index <= last;
}

/** Rounded so the fixture is byte-identical between runs, machines and reviews. */
function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * A raw streams payload in the shape `normalizeIntervalsRunProfile` reads.
 *
 * `null` entries are the point of the exercise: a stream that stopped
 * recording must reach the chart as a gap that breaks the line, not as a
 * missing row that lets the samples either side be joined across it.
 */
function rawStreams(shape: ProfileShape): Record<string, (number | null)[]> {
  const indexes = Array.from({ length: shape.sampleCount }, (_, index) => index);
  const meanVelocity = METERS_PER_MILE / shape.paceSecondsPerMile;

  return {
    time: indexes.map((index) => index * shape.intervalSeconds),
    velocity_smooth: indexes.map((index) => {
      if (within(shape.positionGap, index)) return null;
      if (index === shape.stopIndex) return 0.4;
      // A rolling effort rather than a metronome, so the plotted line has a
      // shape worth looking at and the robust pace domain has work to do.
      return round(meanVelocity + 0.24 * Math.sin(index / 9) + 0.08 * Math.sin(index / 2.5), 2);
    }),
    heartrate: indexes.map((index) => {
      if (within(shape.heartRateGap, index)) return null;
      const drift = (shape.endHeartRate - shape.startHeartRate) *
        (index / Math.max(1, shape.sampleCount - 1));
      return Math.round(shape.startHeartRate + drift + 4 * Math.sin(index / 7));
    }),
    altitude: indexes.map((index) =>
      round(shape.startElevationMeters + 11 * Math.sin(index / 17) + 5 * Math.sin(index / 5), 1)),
    cadence: indexes.map((index) => {
      if (within(shape.positionGap, index)) return null;
      // Zero is the runner standing still. The normalizer treats it as absent,
      // which is what draws a gap instead of a plunge to the floor.
      if (index === shape.stopIndex) return 0;
      return shape.cadence + Math.round(2 * Math.sin(index / 11));
    }),
  };
}

const RICH_PROFILE: ProfileShape = {
  sampleCount: 150,
  intervalSeconds: 20,
  paceSecondsPerMile: 573,
  startHeartRate: 132,
  endHeartRate: 161,
  heartRateGap: [40, 47],
  positionGap: [95, 99],
  stopIndex: 64,
  startElevationMeters: 31,
  cadence: 79,
};

const HISTORICAL_RICH_PROFILE: ProfileShape = {
  sampleCount: 200,
  intervalSeconds: 24,
  paceSecondsPerMile: 649,
  startHeartRate: 126,
  endHeartRate: 152,
  heartRateGap: [118, 131],
  positionGap: [61, 64],
  stopIndex: 150,
  startElevationMeters: 44,
  cadence: 78,
};

/**
 * A structured session on the accepted rich run and nothing on the historical
 * one, because an unstructured long run genuinely has no named groups and the
 * shared detail path has to be reviewable in both states.
 */
const RICH_INTERVALS = {
  icu_intervals: [
    { name: "Warm Up", moving_time: 720, distance: 1_770, average_heartrate: 139 },
    { name: "Rep 1", moving_time: 300, distance: 1_130, average_heartrate: 163 },
    { name: "Recovery", moving_time: 120, distance: 320, average_heartrate: 145 },
    { name: "Rep 2", moving_time: 300, distance: 1_140, average_heartrate: 166 },
    { name: "Recovery", moving_time: 120, distance: 315, average_heartrate: 147 },
    { name: "Rep 3", moving_time: 300, distance: 1_125, average_heartrate: 168 },
    { name: "Cool Down", moving_time: 720, distance: 1_670, average_heartrate: 138 },
  ],
};

/** The raw streams response for one activity id, or nothing to normalize. */
function qaRawStreams(activityId: string): unknown {
  if (activityId === QA_RICH_PROFILE_ACTIVITY_ID) return rawStreams(RICH_PROFILE);
  if (activityId === QA_HISTORICAL_RICH_ACTIVITY_ID) return rawStreams(HISTORICAL_RICH_PROFILE);
  // Every other synthetic run is aggregate-only, exactly like a real run whose
  // source recorded no streams: no profile, no error, no empty chart frame.
  return null;
}

/** The raw activity-detail response for one activity id. */
function qaRawDetail(activityId: string): unknown {
  return activityId === QA_RICH_PROFILE_ACTIVITY_ID ? RICH_INTERVALS : { icu_intervals: [] };
}

/**
 * The QA Runner's stand-in for the Intervals reads.
 *
 * Module-level and connection-independent: the harness has no credential to
 * offer, and a reader rebuilt on every render would restart the read every
 * time anything in the app changed.
 */
const QA_SOURCE_DETAIL_READER: SourceDetailReader = {
  readDetail: (activityId) =>
    Promise.resolve(normalizeIntervalsActivityDetail(qaRawDetail(activityId))),
  readProfile: (activityId) =>
    Promise.resolve(normalizeIntervalsRunProfile(qaRawStreams(activityId))),
};

/**
 * QA always has a reader, connection or not — that is the whole point of
 * injecting one. Production is untouched: `intervalsSourceDetailReader` still
 * refuses to produce a reader without a real connection.
 */
export const qaSourceDetailReaderFor: SourceDetailReaderFactory = () => QA_SOURCE_DETAIL_READER;
