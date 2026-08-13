import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/Button";
import { DonutChart } from "../../components/charts/DonutChart";
import { zoneDonutSegments } from "../../components/charts/zoneDonutSegments";
import { RunProfileChart } from "../../components/charts/RunProfileChart";
import {
  fetchIntervalsActivityDetail,
  fetchIntervalsRunProfile,
  type IntervalsActivityDetail,
  type IntervalsConnection,
  type IntervalsRunProfile,
} from "../../connected/intervals";
import { formatMiles } from "../../domain/distance";
import { formatDurationSeconds } from "../../domain/duration";
import { formatPace, formatPaceSeconds } from "../../domain/runs";
import type { RunLog } from "../../domain/types";
import { EFFORT_LABEL } from "../../domain/workout";

const ELAPSED_SIGNIFICANCE_SECONDS = 30;

type RunProfileMetricId = "pace" | "heartRate" | "elevation";

const RUN_PROFILE_METRICS: Array<{
  id: RunProfileMetricId;
  label: string;
  invert?: boolean;
  formatValue: (value: number) => string;
  sample: (samples: IntervalsRunProfile["samples"][number]) => number | undefined;
}> = [
  { id: "pace", label: "Pace", invert: true, formatValue: formatPaceSeconds, sample: (sample) => sample.paceSecondsPerMile },
  { id: "heartRate", label: "Heart Rate", formatValue: (value) => `${Math.round(value)} bpm`, sample: (sample) => sample.heartRate },
  { id: "elevation", label: "Elevation", formatValue: (value) => `${Math.round(value)} ft`, sample: (sample) => sample.elevationFeet },
];

function rounded(value: number): string {
  return Math.round(value).toLocaleString();
}

export function RunResultDetail({ run, syncToken }: { run: RunLog; syncToken?: IntervalsConnection | string | null }) {
  const metrics = run.importedMetrics;
  const imported = run.externalSource?.provider === "intervals";
  const activityId = run.externalSource?.activityId;
  const pace = formatPace(run.distanceMiles, run.durationSeconds);
  const elapsed = metrics?.elapsedTimeSeconds;
  const showElapsed = elapsed !== undefined &&
    Math.abs(elapsed - run.durationSeconds) >= ELAPSED_SIGNIFICANCE_SECONDS;
  const zoneTotal = metrics?.hrZoneSeconds?.reduce((sum, seconds) => sum + seconds, 0) ?? 0;
  const dominantZoneSeconds = metrics?.hrZoneSeconds && zoneTotal > 0
    ? Math.max(...metrics.hrZoneSeconds)
    : 0;
  const dominantZoneIndex = metrics?.hrZoneSeconds?.indexOf(dominantZoneSeconds) ?? -1;

  const [detail, setDetail] = useState<IntervalsActivityDetail | null>(null);
  const [detailState, setDetailState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<IntervalsRunProfile | null>(null);
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
      return;
    }
    setDetailState("loading");
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
    // The Run Profile stream is unverified (see `normalizeIntervalsRunProfile`)
    // and kept independent: a failure here stays quiet and simply leaves the
    // Run Profile section absent, same as a run that never had one.
    fetchIntervalsRunProfile(id, token)
      .then((result) => { if (requestIdRef.current === requestId) setProfile(result); })
      .catch(() => undefined);
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

  const availableProfileMetrics = RUN_PROFILE_METRICS.filter((metric) =>
    profile?.samples.some((sample) => metric.sample(sample) !== undefined));
  const activeMetric = availableProfileMetrics.find((metric) => metric.id === selectedProfileMetric) ?? availableProfileMetrics[0];
  const profileSamples = activeMetric && profile
    ? profile.samples.flatMap((sample) => {
        const value = activeMetric.sample(sample);
        return value === undefined ? [] : [{ timeSeconds: sample.timeSeconds, value }];
      })
    : [];

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

      {(metrics?.averageHeartRate !== undefined ||
        metrics?.maxHeartRate !== undefined ||
        metrics?.elevationGainFeet !== undefined ||
        metrics?.trainingLoad !== undefined) && (
        <dl className="run-result-detail__secondary" aria-label="Imported run metrics">
          {metrics?.averageHeartRate !== undefined && (
            <div><dd className="data-value">{rounded(metrics.averageHeartRate)} bpm</dd><dt className="machine-label">Avg HR</dt></div>
          )}
          {metrics?.maxHeartRate !== undefined && (
            <div><dd className="data-value">{rounded(metrics.maxHeartRate)} bpm</dd><dt className="machine-label">Max HR</dt></div>
          )}
          {metrics?.elevationGainFeet !== undefined && (
            <div><dd className="data-value">{rounded(metrics.elevationGainFeet)} ft</dd><dt className="machine-label">Gain</dt></div>
          )}
          {metrics?.trainingLoad !== undefined && (
            <div><dd className="data-value">{rounded(metrics.trainingLoad)}</dd><dt className="machine-label">Load</dt></div>
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
            samples={profileSamples}
            formatValue={activeMetric.formatValue}
            invert={activeMetric.invert}
          />
        </section>
      )}

      {metrics?.hrZoneSeconds && zoneTotal > 0 && (
        <section className="run-result-detail__zones">
          <h3 className="machine-label">Heart rate zones</h3>
          <DonutChart
            size="large"
            segments={zoneDonutSegments(metrics.hrZoneSeconds)}
            label="Heart rate zone distribution"
            centerValue={`${Math.round((dominantZoneSeconds / zoneTotal) * 100)}%`}
            centerLabel={`Zone ${dominantZoneIndex + 1}`}
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
