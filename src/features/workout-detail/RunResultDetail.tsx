import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { DonutChart } from "../../components/charts/DonutChart";
import { zoneDonutSegments } from "../../components/charts/zoneDonutSegments";
import { fetchIntervalsActivityDetail, type IntervalsActivityDetail } from "../../connected/intervals";
import { formatDateLabel } from "../../domain/dates";
import { formatMiles } from "../../domain/distance";
import { formatDurationSeconds } from "../../domain/duration";
import { formatPace } from "../../domain/runs";
import type { RunLog } from "../../domain/types";
import { EFFORT_LABEL } from "../../domain/workout";

/**
 * How far apart moving and elapsed time have to be before both are worth
 * saying. Under half a minute is a traffic light, and printing the same run
 * twice under two labels teaches the reader that the distinction is noise.
 */
const ELAPSED_SIGNIFICANCE_SECONDS = 30;

function rounded(value: number): string {
  return Math.round(value).toLocaleString();
}

export function RunResultDetail({ run, syncToken }: { run: RunLog; syncToken?: string | null }) {
  const metrics = run.importedMetrics;
  const imported = run.externalSource?.provider === "intervals";
  const pace = formatPace(run.distanceMiles, run.durationSeconds);
  /**
   * A synced run knows how long it took and how long the runner was moving.
   * Both are facts about the same run, and which one a runner means by "my
   * time" depends entirely on the run — so when they genuinely differ, say
   * both and label them.
   */
  const elapsed = metrics?.elapsedTimeSeconds;
  const showElapsed =
    elapsed !== undefined &&
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
      {imported && <p className="run-result-detail__source">Synced via Intervals.icu</p>}
      <dl className="workout-detail__facts">
        <div><dt>Date</dt><dd>{formatDateLabel(run.completedDate)}</dd></div>
        <div><dt>Distance</dt><dd>{formatMiles(run.distanceMiles)} mi</dd></div>
        <div><dt>{showElapsed ? "Moving" : "Duration"}</dt><dd>{formatDurationSeconds(run.durationSeconds)}</dd></div>
        {showElapsed && <div><dt>Elapsed</dt><dd>{formatDurationSeconds(elapsed)}</dd></div>}
        {pace && <div><dt>Pace</dt><dd>{pace}</dd></div>}
        <div><dt>Effort</dt><dd>{EFFORT_LABEL[run.effort]}</dd></div>
        {metrics?.averageHeartRate !== undefined && <div><dt>Average HR</dt><dd>{rounded(metrics.averageHeartRate)} bpm</dd></div>}
        {metrics?.maxHeartRate !== undefined && <div><dt>Max HR</dt><dd>{rounded(metrics.maxHeartRate)} bpm</dd></div>}
        {metrics?.elevationGainFeet !== undefined && <div><dt>Elevation gain</dt><dd>{rounded(metrics.elevationGainFeet)} ft</dd></div>}
        {metrics?.trainingLoad !== undefined && <div><dt>Training Load</dt><dd>{rounded(metrics.trainingLoad)}</dd></div>}
      </dl>
      {run.notes && <p className="workout-detail__notes">{run.notes}</p>}
      {metrics?.hrZoneSeconds && zoneTotal > 0 && (
        <div className="run-result-detail__zones">
          <h3 className="workout-detail__result-title">Heart rate zones</h3>
          <DonutChart
            segments={zoneDonutSegments(metrics.hrZoneSeconds)}
            label="Heart rate zone distribution"
            centerValue={`${Math.round((dominantZoneSeconds / zoneTotal) * 100)}%`}
            centerLabel={`Zone ${dominantZoneIndex + 1}`}
          />
        </div>
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
        <div className="run-result-detail__intervals">
          <h3 className="workout-detail__result-title">Intervals</h3>
          <ol aria-label="Structured workout intervals">
            {detail.intervals.map((interval, index) => (
              <li key={`${interval.label}-${index}`}>
                <strong>{interval.label}</strong>
                <span>{formatDurationSeconds(interval.durationSeconds)}{interval.distanceMiles !== undefined ? ` · ${interval.distanceMiles.toFixed(2)} mi` : ""}{interval.averageHeartRate !== undefined ? ` · ${rounded(interval.averageHeartRate)} bpm average` : ""}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
