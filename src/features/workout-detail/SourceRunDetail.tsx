import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "../../components/ui/Button";
import { DonutChart } from "../../components/charts/DonutChart";
import { zoneDonutSegments } from "../../components/charts/zoneDonutSegments";
import { RunProfileChart, type RunProfileFact } from "../../components/charts/RunProfileChart";
import type {
  IntervalsActivityDetail,
  IntervalsRunProfile,
  IntervalsRunProfileSample,
} from "../../connected/intervals";
import {
  useSourceDetailReader,
  type SourceConnection,
  type SourceDetailReader,
} from "../../connected/sourceDetail";
import { formatMiles } from "../../domain/distance";
import { formatDurationSeconds } from "../../domain/duration";
import { formatPaceSeconds } from "../../domain/runs";
import type { SourceRunFacts } from "./sourceRunFacts";

const ELAPSED_SIGNIFICANCE_SECONDS = 30;

type RunProfileMetricId = "pace" | "heartRate" | "elevation" | "cadence";

interface RunProfileFactContext {
  facts: SourceRunFacts;
  /** The metric's own measured samples, for the facts that genuinely belong to the series. */
  values: number[];
}

interface RunProfileMetric {
  id: RunProfileMetricId;
  label: string;
  invert?: boolean;
  robustDomain?: boolean;
  sample: (sample: IntervalsRunProfileSample) => number | undefined;
  facts: (context: RunProfileFactContext) => RunProfileFact[];
}

function rounded(value: number): string {
  return Math.round(value).toLocaleString();
}

/**
 * What each Run Profile metric plots, and what it states beneath the plot.
 *
 * The facts are the important half. A stream says how the run *moved*; it is
 * a poor source for what the run *was*. Averaging instantaneous pace samples
 * answers a different question from distance over time and disagrees with
 * every other screen; the fastest and slowest samples are a GPS artefact and
 * a traffic light, not a best and worst pace. So wherever STACK already holds
 * the source's own aggregate — the run's pace, its average and max heart
 * rate, its cadence — that aggregate is what is shown, and the stream is left
 * to do the one job it is good at.
 *
 * Elevation is the exception that proves it: a low and a high point are
 * properties of the series itself, so they come from the samples. Total
 * elevation *gain* still does not — that stays the imported source aggregate
 * in the summary grid above, which is why STACK's Gain agrees with Intervals'
 * Climbing rather than with anything recomputed here.
 */
const RUN_PROFILE_METRICS: RunProfileMetric[] = [
  {
    id: "pace",
    label: "Pace",
    invert: true,
    // Near-stops and speed spikes are real, kept, and must not be allowed to
    // squash the rest of the run into a flat line.
    robustDomain: true,
    sample: (sample) => sample.paceSecondsPerMile,
    facts: ({ facts }) =>
      facts.paceSecondsPerMile === null
        ? []
        : [{ label: "Avg pace", value: formatPaceSeconds(facts.paceSecondsPerMile) }],
  },
  {
    id: "heartRate",
    label: "Heart Rate",
    sample: (sample) => sample.heartRate,
    facts: ({ facts }) => [
      ...(facts.averageHeartRate !== null
        ? [{ label: "Avg", value: `${rounded(facts.averageHeartRate)} bpm` }]
        : []),
      ...(facts.maxHeartRate !== null
        ? [{ label: "Max", value: `${rounded(facts.maxHeartRate)} bpm` }]
        : []),
    ],
  },
  {
    id: "elevation",
    label: "Elevation",
    sample: (sample) => sample.elevationFeet,
    facts: ({ values }) =>
      values.length > 0
        ? [
            { label: "Low", value: `${rounded(Math.min(...values))} ft` },
            { label: "High", value: `${rounded(Math.max(...values))} ft` },
          ]
        : [],
  },
  {
    id: "cadence",
    label: "Cadence",
    sample: (sample) => sample.cadence,
    // Stated exactly as the source reports it, with no unit STACK has not
    // verified and no doubling into steps per minute.
    facts: ({ facts }) =>
      facts.averageCadence !== null
        ? [{ label: "Avg cadence", value: rounded(facts.averageCadence) }]
        : [],
  },
];

interface SourceRunDetailProps {
  /** The run's source-owned facts. Already normalized; never recomputed here. */
  facts: SourceRunFacts;
  /**
   * The stable source activity id, or null when this run has none. Without it
   * there is nothing to ask the source about and no read is attempted.
   */
  activityId: string | null;
  /** Which run this is, so a reopened sheet never shows the previous run's detail. */
  runKey: string;
  connection: SourceConnection;
  /** STACK-owned context above the result. Only an owned run supplies it. */
  meta?: ReactNode;
  /** STACK-owned notes below the result. Only an owned run supplies them. */
  notes?: ReactNode;
}

/**
 * One run as its **source** recorded it: the result, its shape, and whatever
 * else the source supplied about it.
 *
 * This is the single source-owned presentation in STACK. An accepted run
 * reaches it through `RunResultDetail`, which adds the STACK-owned effort,
 * notes and actions around it; a historical-only run reaches it through
 * `HistoricalRunSheet`, which adds nothing at all, because nobody has decided
 * anything about that run. Neither one is a copy of the other, and a run the
 * runner never accepted is not visually second-class for it — it is the same
 * telemetry, minus the facts that genuinely do not exist.
 *
 * The governing rule is unchanged and lives here now rather than in two
 * places: **streams provide shape, aggregates provide the stated numbers.**
 *
 * Loading is summary-first by construction. Everything above the Run Profile
 * comes from `facts`, which the caller already has, so nothing waits on a
 * network read. The profile and the structured groups appear if and when they
 * resolve, and a profile that never resolves leaves exactly what a run with no
 * profile leaves: nothing.
 */
export function SourceRunDetail({
  facts,
  activityId,
  runKey,
  connection,
  meta,
  notes,
}: SourceRunDetailProps) {
  const reader = useSourceDetailReader(connection);
  const showElapsed = facts.durationSeconds !== null &&
    facts.elapsedTimeSeconds !== null &&
    Math.abs(facts.elapsedTimeSeconds - facts.durationSeconds) >= ELAPSED_SIGNIFICANCE_SECONDS;
  const zoneTotal = facts.hrZoneSeconds?.reduce((sum, seconds) => sum + seconds, 0) ?? 0;

  const [detail, setDetail] = useState<IntervalsActivityDetail | null>(null);
  const [detailState, setDetailState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<IntervalsRunProfile | null>(null);
  /** False until the stream read has resolved either way, so nothing flashes into place and out again. */
  const [profileSettled, setProfileSettled] = useState(false);
  const [selectedProfileMetric, setSelectedProfileMetric] = useState<RunProfileMetricId | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  /** Guards a slow, superseded request from overwriting a newer one's state. */
  const requestIdRef = useRef(0);

  /**
   * Synchronizes local state with the external source read for one request.
   * Kept out of the effect body itself — see the effect below — so the
   * reset-and-fetch calls read as one external synchronization, not several
   * bare `setState`s a linter (rightly) reads as derived-state churn.
   */
  const loadDetail = useCallback((
    id: string | null,
    source: SourceDetailReader | null,
    requestId: number,
  ) => {
    setDetail(null);
    setProfile(null);
    setSelectedProfileMetric(null);
    setError("");
    if (!id || !source) {
      setDetailState("idle");
      setProfileSettled(true);
      return;
    }
    setDetailState("loading");
    setProfileSettled(false);
    source.readDetail(id)
      .then((result) => {
        if (requestIdRef.current !== requestId) return;
        setDetail(result);
        setDetailState("idle");
      })
      .catch((reason: unknown) => {
        if (requestIdRef.current !== requestId) return;
        setError(reason instanceof Error ? reason.message : "Run detail could not be loaded.");
        setDetailState("error");
      });
    // The Run Profile stream is kept independent: a failure here stays quiet
    // and simply leaves the Run Profile section absent, same as a run that
    // never had one.
    source.readProfile(id)
      .then((result) => {
        if (requestIdRef.current !== requestId) return;
        setProfile(result);
        setProfileSettled(true);
      })
      .catch(() => {
        if (requestIdRef.current === requestId) setProfileSettled(true);
      });
  }, []);

  /**
   * Richer detail loads once a sheet is showing this run. Ordinary history
   * sync still never requests it — this effect only runs because one run's
   * detail is open, and the request id makes the newest open the only one that
   * can write, so switching from run A to run B can never let A's slow answer
   * land in B.
   */
  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    loadDetail(activityId, reader, requestId);
  }, [runKey, activityId, reader, loadAttempt, loadDetail]);

  /**
   * Every time position the stream covered, with `null` wherever this metric
   * had no value. Dropping those rows instead would join the samples either
   * side of a gap into one straight line across data that was never recorded.
   */
  const pointsFor = (metric: RunProfileMetric) =>
    (profile?.samples ?? []).map((sample) => ({
      timeSeconds: sample.timeSeconds,
      value: metric.sample(sample) ?? null,
    }));

  const availableProfileMetrics = RUN_PROFILE_METRICS.filter((metric) =>
    profile?.samples.some((sample) => metric.sample(sample) !== undefined));
  const activeMetric = availableProfileMetrics.find((metric) => metric.id === selectedProfileMetric) ??
    availableProfileMetrics[0];
  const activePoints = activeMetric ? pointsFor(activeMetric) : [];
  const activeFacts = activeMetric
    ? activeMetric.facts({
        facts,
        values: activePoints.flatMap((point) => (point.value === null ? [] : [point.value])),
      })
    : [];

  /**
   * Cadence belongs in the profile, where it has a shape worth showing. When
   * the stream has none but the imported average does exist, the verified
   * number still deserves to be on screen rather than dropped, so it joins
   * the summary grid instead.
   */
  const summaryCadence = profileSettled &&
    !availableProfileMetrics.some((metric) => metric.id === "cadence")
    ? facts.averageCadence
    : null;

  const hasSecondaryMetrics = facts.averageHeartRate !== null ||
    facts.maxHeartRate !== null ||
    facts.elevationGainFeet !== null ||
    facts.trainingLoad !== null ||
    summaryCadence !== null;

  const primaryCount = (facts.distanceMiles > 0 ? 1 : 0) +
    (facts.durationSeconds !== null ? 1 : 0) +
    (facts.paceSecondsPerMile !== null ? 1 : 0);

  return (
    <div className="run-result-detail">
      {meta}

      <dl className="run-result-detail__primary" data-count={primaryCount} aria-label="Primary activity results">
        {facts.distanceMiles > 0 && (
          <div>
            <dd className="data-value">{formatMiles(facts.distanceMiles)} mi</dd>
            <dt className="machine-label">Distance</dt>
          </div>
        )}
        {facts.durationSeconds !== null && (
          <div>
            <dd className="data-value">{formatDurationSeconds(facts.durationSeconds)}</dd>
            <dt className="machine-label">{showElapsed ? "Moving" : "Duration"}</dt>
          </div>
        )}
        {facts.paceSecondsPerMile !== null && (
          <div data-metric="pace">
            <dd className="data-value">{formatPaceSeconds(facts.paceSecondsPerMile)}</dd>
            <dt className="machine-label">Avg pace</dt>
          </div>
        )}
      </dl>

      {hasSecondaryMetrics && (
        <dl className="run-result-detail__secondary" aria-label="Imported run metrics">
          {facts.averageHeartRate !== null && (
            <div><dd className="data-value">{rounded(facts.averageHeartRate)} bpm</dd><dt className="machine-label">Avg HR</dt></div>
          )}
          {facts.maxHeartRate !== null && (
            <div><dd className="data-value">{rounded(facts.maxHeartRate)} bpm</dd><dt className="machine-label">Max HR</dt></div>
          )}
          {/* The source's own climbing total, not a sum of altitude changes. */}
          {facts.elevationGainFeet !== null && (
            <div><dd className="data-value">{rounded(facts.elevationGainFeet)} ft</dd><dt className="machine-label">Gain</dt></div>
          )}
          {facts.trainingLoad !== null && (
            <div><dd className="data-value">{rounded(facts.trainingLoad)}</dd><dt className="machine-label">Load</dt></div>
          )}
          {summaryCadence !== null && (
            <div><dd className="data-value">{rounded(summaryCadence)}</dd><dt className="machine-label">Cadence</dt></div>
          )}
        </dl>
      )}

      {notes}

      {availableProfileMetrics.length > 0 && activeMetric && (
        <section className="run-result-detail__profile">
          <h3 className="machine-label">Run Profile</h3>
          {availableProfileMetrics.length > 1 && (
            <div className="run-profile__selectors" role="group" aria-label="Run Profile metric">
              {availableProfileMetrics.map((metric) => (
                <button
                  key={metric.id}
                  type="button"
                  className="run-profile__selector"
                  aria-pressed={metric.id === activeMetric.id}
                  onClick={() => setSelectedProfileMetric(metric.id)}
                >
                  <span>{metric.label}</span>
                </button>
              ))}
            </div>
          )}
          <RunProfileChart
            points={activePoints}
            facts={activeFacts}
            invert={activeMetric.invert}
            robustDomain={activeMetric.robustDomain}
          />
        </section>
      )}

      {facts.hrZoneSeconds && zoneTotal > 0 && (
        <section className="run-result-detail__zones">
          <h3 className="machine-label">Heart rate zones</h3>
          <DonutChart
            size="large"
            interactive
            segments={zoneDonutSegments(facts.hrZoneSeconds)}
            label="Heart rate zone distribution"
          />
        </section>
      )}

      {detailState === "error" && (
        <div className="run-result-detail__request">
          <p role="alert" className="run-result-detail__error">{error}</p>
          <Button variant="secondary" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
            Retry
          </Button>
        </div>
      )}

      {detail && detail.intervals.length > 0 && (
        <section className="run-result-detail__intervals">
          <h3 className="machine-label">Intervals</h3>
          <div className="run-result-detail__interval-head machine-label" aria-hidden="true">
            <span>Rep</span><span>Time</span><span>Distance</span><span>Avg HR</span>
          </div>
          <ol aria-label="Structured workout intervals">
            {detail.intervals.map((interval, index) => (
              <li key={`${interval.label}-${index}`}>
                <strong>{interval.label}</strong>
                <span>{formatDurationSeconds(interval.durationSeconds)}</span>
                <span>{interval.distanceMiles !== undefined ? `${interval.distanceMiles.toFixed(2)} mi` : "—"}</span>
                <span>{interval.averageHeartRate !== undefined ? `${rounded(interval.averageHeartRate)} bpm` : "—"}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
