import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/Button";
import { DonutChart } from "../../components/charts/DonutChart";
import { zoneDonutSegments } from "../../components/charts/zoneDonutSegments";
import { RunProfileChart, type RunProfileFact } from "../../components/charts/RunProfileChart";
import {
  fetchIntervalsActivityDetail,
  fetchIntervalsRunProfile,
  type IntervalsActivityDetail,
  type IntervalsConnection,
  type IntervalsRunProfile,
  type IntervalsRunProfileSample,
} from "../../connected/intervals";
import { formatMiles } from "../../domain/distance";
import { formatDurationSeconds } from "../../domain/duration";
import { formatPace } from "../../domain/runs";
import type { ImportedRunMetrics, RunLog } from "../../domain/types";
import { EFFORT_LABEL } from "../../domain/workout";

const ELAPSED_SIGNIFICANCE_SECONDS = 30;

type RunProfileMetricId = "pace" | "heartRate" | "elevation" | "cadence";

interface RunProfileFactContext {
  /** The whole run's pace, derived from the stored distance and duration. */
  pace: string | null;
  metrics: ImportedRunMetrics | null | undefined;
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
 * elevation *gain* still does not — that stays the imported Intervals
 * aggregate in the summary grid above, which is why STACK's Gain agrees with
 * Intervals' Climbing rather than with anything recomputed here.
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
    facts: ({ pace }) => (pace ? [{ label: "Avg pace", value: pace }] : []),
  },
  {
    id: "heartRate",
    label: "Heart Rate",
    sample: (sample) => sample.heartRate,
    facts: ({ metrics }) => [
      ...(metrics?.averageHeartRate !== undefined
        ? [{ label: "Avg", value: `${rounded(metrics.averageHeartRate)} bpm` }]
        : []),
      ...(metrics?.maxHeartRate !== undefined
        ? [{ label: "Max", value: `${rounded(metrics.maxHeartRate)} bpm` }]
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
    // Stated exactly as Intervals reports it, with no unit STACK has not
    // verified and no doubling into steps per minute.
    facts: ({ metrics }) =>
      metrics?.averageCadence !== undefined
        ? [{ label: "Avg cadence", value: rounded(metrics.averageCadence) }]
        : [],
  },
];

export function RunResultDetail({ run, syncToken }: { run: RunLog; syncToken?: IntervalsConnection | string | null }) {
  const metrics = run.importedMetrics;
  const imported = run.externalSource?.provider === "intervals";
  const activityId = run.externalSource?.activityId;
  const pace = formatPace(run.distanceMiles, run.durationSeconds);
  const elapsed = metrics?.elapsedTimeSeconds;
  const showElapsed = elapsed !== undefined &&
    Math.abs(elapsed - run.durationSeconds) >= ELAPSED_SIGNIFICANCE_SECONDS;
  const zoneTotal = metrics?.hrZoneSeconds?.reduce((sum, seconds) => sum + seconds, 0) ?? 0;

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
   * Synchronizes local state with the external Intervals read for one
   * request. Kept out of the effect body itself — see the effect below — so
   * the reset-and-fetch calls read as one external synchronization, not
   * several bare `setState`s a linter (rightly) reads as derived-state churn.
   */
  const loadDetail = useCallback((id: string | undefined, token: IntervalsConnection | string | null | undefined, requestId: number) => {
    setDetail(null);
    setProfile(null);
    setSelectedProfileMetric(null);
    setError("");
    if (!id || !token) {
      setDetailState("idle");
      setProfileSettled(true);
      return;
    }
    setDetailState("loading");
    setProfileSettled(false);
    fetchIntervalsActivityDetail(id, token)
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
    fetchIntervalsRunProfile(id, token)
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
   * Richer detail loads once the sheet is showing this run, replacing the old
   * explicit "View intervals" tap. Normal sync still never requests it — this
   * effect only runs because a detail sheet opened for a specific synced run.
   */
  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    loadDetail(imported ? activityId : undefined, syncToken, requestId);
  }, [run.id, imported, syncToken, activityId, loadAttempt, loadDetail]);

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
        pace,
        metrics,
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
    ? metrics?.averageCadence
    : undefined;

  // A hand-typed heart rate is never a source-verified fact the way an
  // imported average is, so it only ever fills in for a run with no
  // imported reading rather than standing beside one.
  const showManualHeartRate =
    metrics?.averageHeartRate === undefined && run.manualHeartRate != null;

  const hasSecondaryMetrics = metrics?.averageHeartRate !== undefined ||
    metrics?.maxHeartRate !== undefined ||
    metrics?.elevationGainFeet !== undefined ||
    metrics?.trainingLoad !== undefined ||
    summaryCadence !== undefined ||
    showManualHeartRate;

  return (
    <div className="run-result-detail">
      <div className="run-result-detail__meta machine-label">
        {imported && <span>Synced via Intervals.icu</span>}
        <span><span>Effort</span><span aria-hidden="true"> · </span><strong>{EFFORT_LABEL[run.effort]}</strong></span>
        {showElapsed && (
          <span><strong>Elapsed</strong><span aria-hidden="true"> · </span><span>{formatDurationSeconds(elapsed)}</span></span>
        )}
      </div>

      <dl className="run-result-detail__primary" aria-label="Primary run results">
        <div>
          <dd className="data-value">{formatMiles(run.distanceMiles)} mi</dd>
          <dt className="machine-label">Distance</dt>
        </div>
        <div>
          <dd className="data-value">{formatDurationSeconds(run.durationSeconds)}</dd>
          <dt className="machine-label">{showElapsed ? "Moving" : "Duration"}</dt>
        </div>
        {pace && (
          <div>
            <dd className="data-value">{pace}</dd>
            <dt className="machine-label">Avg pace</dt>
          </div>
        )}
      </dl>

      {hasSecondaryMetrics && (
        <dl className="run-result-detail__secondary" aria-label="Run metrics">
          {metrics?.averageHeartRate !== undefined && (
            <div><dd className="data-value">{rounded(metrics.averageHeartRate)} bpm</dd><dt className="machine-label">Avg HR</dt></div>
          )}
          {showManualHeartRate && (
            <div><dd className="data-value">{rounded(run.manualHeartRate!)} bpm</dd><dt className="machine-label">Avg HR</dt></div>
          )}
          {metrics?.maxHeartRate !== undefined && (
            <div><dd className="data-value">{rounded(metrics.maxHeartRate)} bpm</dd><dt className="machine-label">Max HR</dt></div>
          )}
          {/* The source's own climbing total, not a sum of altitude changes. */}
          {metrics?.elevationGainFeet !== undefined && (
            <div><dd className="data-value">{rounded(metrics.elevationGainFeet)} ft</dd><dt className="machine-label">Gain</dt></div>
          )}
          {metrics?.trainingLoad !== undefined && (
            <div><dd className="data-value">{rounded(metrics.trainingLoad)}</dd><dt className="machine-label">Load</dt></div>
          )}
          {summaryCadence !== undefined && (
            <div><dd className="data-value">{rounded(summaryCadence)}</dd><dt className="machine-label">Cadence</dt></div>
          )}
        </dl>
      )}

      {run.notes && <p className="workout-detail__notes">{run.notes}</p>}

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
                  {metric.label}
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

      {metrics?.hrZoneSeconds && zoneTotal > 0 && (
        <section className="run-result-detail__zones">
          <h3 className="machine-label">Heart rate zones</h3>
          <DonutChart
            size="large"
            interactive
            segments={zoneDonutSegments(metrics.hrZoneSeconds)}
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
