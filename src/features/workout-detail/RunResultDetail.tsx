import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { DonutChart } from "../../components/charts/DonutChart";
import { zoneDonutSegments } from "../../components/charts/zoneDonutSegments";
import { fetchIntervalsActivityDetail, type IntervalsActivityDetail, type IntervalsConnection } from "../../connected/intervals";
import { formatMiles } from "../../domain/distance";
import { formatDurationSeconds } from "../../domain/duration";
import { formatPace } from "../../domain/runs";
import type { RunLog } from "../../domain/types";
import { EFFORT_LABEL } from "../../domain/workout";

const ELAPSED_SIGNIFICANCE_SECONDS = 30;

function rounded(value: number): string {
  return Math.round(value).toLocaleString();
}

export function RunResultDetail({ run, syncToken }: { run: RunLog; syncToken?: IntervalsConnection | string | null }) {
  const metrics = run.importedMetrics;
  const imported = run.externalSource?.provider === "intervals";
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

  async function loadDetail() {
    if (!run.externalSource || !syncToken) return;
    setDetailState("loading");
    setError("");
    try {
      setDetail(await fetchIntervalsActivityDetail(run.externalSource.activityId, syncToken));
      setDetailState("idle");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Run detail could not be loaded.");
      setDetailState("error");
    }
  }

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
            <div><dd className="data-value">{rounded(metrics.averageHeartRate)} bpm</dd><dt className="machine-label">Average HR</dt></div>
          )}
          {metrics?.maxHeartRate !== undefined && (
            <div><dd className="data-value">{rounded(metrics.maxHeartRate)} bpm</dd><dt className="machine-label">Max HR</dt></div>
          )}
          {metrics?.elevationGainFeet !== undefined && (
            <div><dd className="data-value">{rounded(metrics.elevationGainFeet)} ft</dd><dt className="machine-label">Elevation gain</dt></div>
          )}
          {metrics?.trainingLoad !== undefined && (
            <div><dd className="data-value">{rounded(metrics.trainingLoad)}</dd><dt className="machine-label">Training Load</dt></div>
          )}
        </dl>
      )}

      {run.notes && <p className="workout-detail__notes">{run.notes}</p>}

      {metrics?.hrZoneSeconds && zoneTotal > 0 && (
        <section className="run-result-detail__zones">
          <h3 className="machine-label">Heart rate zones</h3>
          <DonutChart
            segments={zoneDonutSegments(metrics.hrZoneSeconds)}
            label="Heart rate zone distribution"
            centerValue={`${Math.round((dominantZoneSeconds / zoneTotal) * 100)}%`}
            centerLabel={`Zone ${dominantZoneIndex + 1}`}
          />
        </section>
      )}

      {imported && syncToken && detail === null && (
        <div className="run-result-detail__request">
          <Button variant="secondary" onClick={loadDetail} disabled={detailState === "loading"}>
            {detailState === "loading" ? "Loading details…" : detailState === "error" ? "Retry details" : "View intervals"}
          </Button>
          {error && <p role="alert" className="run-result-detail__error">{error}</p>}
        </div>
      )}
      {detail && detail.intervals.length === 0 && <p className="run-result-detail__empty">No understandable interval groups were found.</p>}
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
