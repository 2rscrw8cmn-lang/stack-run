import { Footprints, HeartPulse, MountainSnow, PersonStanding, Repeat, Zap } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Button } from "../../components/ui/Button.js";
import type {
  IntervalsActivityDetail,
  IntervalsRunProfile,
} from "../../connected/intervals.js";
import {
  useSourceDetailReader,
  type SourceConnection,
  type SourceDetailReader,
} from "../../connected/sourceDetail.js";
import { formatDateLabel } from "../../domain/dates.js";
import { formatMiles } from "../../domain/distance.js";
import { formatDurationSeconds } from "../../domain/duration.js";
import { formatPaceSeconds } from "../../domain/runs.js";
import { RunAnalysis } from "./RunAnalysis.js";
import { availableAnalysisMetrics, type RunMetricId } from "./runAnalysisMetrics.js";
import { RunMetricSummaries } from "./RunMetricSummaries.js";
import { runInsight } from "./runInsight.js";
import type { RunIdentity } from "./runIdentity.js";
import type { SourceRunFacts } from "./sourceRunFacts.js";

const ELAPSED_SIGNIFICANCE_SECONDS = 30;

function rounded(value: number): string {
  return Math.round(value).toLocaleString();
}

/**
 * A pace as two parts: the figure, and the unit that qualifies it.
 *
 * `formatPaceSeconds` stays the single authority for what a pace *says* — this
 * only splits its answer so the hero can set the unit smaller than the number,
 * which is the hierarchy the approved reference asks for.
 */
function splitPace(secondsPerMile: number): { value: string; unit: string } {
  const [value, unit = ""] = formatPaceSeconds(secondsPerMile).split(" ");
  return { value, unit };
}

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
  /**
   * Who this run is. Supplied by the sheets that lead with the activity — Run
   * Detail and the historical sheet — and absent on the surfaces that embed a
   * run's result inside something else's heading, such as a Build block or a
   * planned workout.
   */
  identity?: RunIdentity | null;
  /**
   * STACK-owned context above the result, for a surface with nowhere else to
   * put it. Run Detail passes nothing here: issue #214 moved provenance behind
   * its `…` control, and a permanent `SOURCE · INTERVALS.ICU` line above the
   * result is exactly what that decision removed.
   */
  meta?: ReactNode;
  /** STACK-owned notes below the result. Only an owned run supplies them. */
  notes?: ReactNode;
  /**
   * One factual line under the distance — `+0.12 mi vs plan`. Supplied only
   * where the comparison is real: a run linked to a workout with an exact
   * target. See `planDistanceComparison`.
   */
  distanceNote?: string | null;
}

/**
 * One run as its **source** recorded it: what it was, what it came to, and what
 * happened inside it.
 *
 * This is the single source-owned presentation in STACK. An accepted run
 * reaches it through `RunResultDetail`, which adds the STACK-owned effort,
 * notes and actions around it; a historical-only run reaches it through
 * `HistoricalRunSheet`, which adds nothing at all, because nobody has decided
 * anything about that run. Neither one is a copy of the other, and a run the
 * runner never accepted is not visually second-class for it.
 *
 * Issue #214 rebuilt the composition around the order a runner actually reads
 * in — **identity, result, investigation, supporting detail** — rather than
 * around what fields happened to exist:
 *
 * 1. the run's own identity, when the caller knows it;
 * 2. one dominant result: distance, with duration and pace beside it;
 * 3. a compact strip of the source's other aggregates, each with its own colour
 *    and icon so heart rate is never mistaken for elevation at a glance;
 * 4. one factual insight, when there is one worth a line;
 * 5. **Analysis**, the centre of the screen: the run's shape, scrubbable;
 * 6. structured intervals, when the source named real groups.
 *
 * The governing rule is unchanged: **streams provide shape, aggregates provide
 * the stated numbers.** Loading is still summary-first — everything above
 * Analysis comes from `facts`, which the caller already holds, so nothing waits
 * on a network read — and a profile that never resolves leaves exactly what a
 * run with no profile leaves: nothing.
 */
export function SourceRunDetail({
  facts,
  activityId,
  runKey,
  connection,
  identity = null,
  meta,
  notes,
  distanceNote = null,
}: SourceRunDetailProps) {
  const reader = useSourceDetailReader(connection);
  const showElapsed = facts.durationSeconds !== null &&
    facts.elapsedTimeSeconds !== null &&
    Math.abs(facts.elapsedTimeSeconds - facts.durationSeconds) >= ELAPSED_SIGNIFICANCE_SECONDS;

  const [detail, setDetail] = useState<IntervalsActivityDetail | null>(null);
  const [detailState, setDetailState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<IntervalsRunProfile | null>(null);
  /** False until the stream read has resolved either way, so nothing flashes into place and out again. */
  const [profileSettled, setProfileSettled] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  /**
   * Which metric Analysis is investigating. Held here rather than inside the
   * module because the summaries below depend on it: the one metric being
   * scrubbed above does not also get a summary card.
   */
  const [selectedMetric, setSelectedMetric] = useState<RunMetricId | null>(null);
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
    // The stream read is kept independent: a failure here stays quiet and
    // simply leaves Analysis absent, same as a run that never had a profile.
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
   * What Analysis is actually showing: the runner's choice when that metric has
   * coverage, and otherwise whichever metric the module defaults to. Null when
   * there is no analysis at all, which is when every summary applies.
   */
  const analysisMetrics = profile ? availableAnalysisMetrics(profile) : [];
  const activeAnalysisMetric = analysisMetrics.includes(selectedMetric as RunMetricId)
    ? selectedMetric
    : analysisMetrics[0] ?? null;

  const structuredIntervals = detail?.intervals ?? [];
  /**
   * One headline fact. The zone rows further down state the whole distribution;
   * this states the one line of it a runner would repeat afterwards.
   */
  const insight = runInsight({
    hrZoneSeconds: facts.hrZoneSeconds,
    structuredIntervalCount: structuredIntervals.length,
  });

  /**
   * The four supporting facts, as one strip. Max heart rate is deliberately not
   * among them: it is a heart-rate fact, and the heart-rate module states it
   * beside the average — either as the chart's own facts, or in the summary
   * below. The strip is what a runner scans, not everything STACK holds.
   */
  const metrics = [
    ...(facts.averageHeartRate !== null
      ? [{ id: "heart-rate", icon: HeartPulse, label: "Avg HR", value: `${rounded(facts.averageHeartRate)} bpm` }]
      : []),
    // The source's own climbing total, not a sum of altitude changes.
    ...(facts.elevationGainFeet !== null
      ? [{ id: "elevation", icon: MountainSnow, label: "Gain", value: `${rounded(facts.elevationGainFeet)} ft` }]
      : []),
    ...(facts.averageCadence !== null
      ? [{ id: "cadence", icon: Footprints, label: "Cadence", value: rounded(facts.averageCadence) }]
      : []),
    ...(facts.trainingLoad !== null
      ? [{ id: "load", icon: Zap, label: "Load", value: rounded(facts.trainingLoad) }]
      : []),
  ];

  const primaryCount = (facts.distanceMiles > 0 ? 1 : 0) +
    (facts.durationSeconds !== null ? 1 : 0) +
    (facts.paceSecondsPerMile !== null ? 1 : 0);
  const pace = facts.paceSecondsPerMile === null ? null : splitPace(facts.paceSecondsPerMile);

  return (
    <div className="run-result-detail">
      {identity && (
        <header className="run-identity">
          {/*
            The run's own mark. One symbol for every run rather than the
            activity-type icon set: the type is stated in the chip below, and
            `Footprints` already means cadence in this design system.
          */}
          <span className="run-identity__mark" aria-hidden="true">
            <PersonStanding size={20} strokeWidth={1.9} />
          </span>
          <div className="run-identity__lines">
            <h3 className="run-identity__title">{identity.title}</h3>
            <p className="run-identity__when machine-label">
              {formatDateLabel(identity.date, { weekday: "short", month: "short", day: "numeric" })}
              {identity.startTimeLabel && (
                <>
                  <span aria-hidden="true"> · </span>
                  {identity.startTimeLabel}
                </>
              )}
            </p>
            <div className="run-identity__chips">
              {identity.chips.map((chip) => (
                <span key={chip.id} className="run-identity__chip machine-label" data-tone={chip.tone}>
                  {chip.label}
                </span>
              ))}
            </div>
            {identity.planLine && <p className="run-identity__plan">{identity.planLine}</p>}
          </div>
        </header>
      )}

      {meta}

      <dl className="run-hero" data-count={primaryCount} aria-label="Primary activity results">
        {facts.distanceMiles > 0 && (
          <div data-metric="distance">
            <dd className="data-value">
              {formatMiles(facts.distanceMiles)} <span className="run-hero__unit">mi</span>
            </dd>
            <dt className="machine-label">
              Distance
              {distanceNote && <span className="run-hero__note">{distanceNote}</span>}
            </dt>
          </div>
        )}
        {facts.durationSeconds !== null && (
          <div data-metric="duration">
            <dd className="data-value">{formatDurationSeconds(facts.durationSeconds)}</dd>
            <dt className="machine-label">{showElapsed ? "Moving" : "Duration"}</dt>
          </div>
        )}
        {pace && (
          <div data-metric="pace">
            <dd className="data-value">
              {pace.value} <span className="run-hero__unit">{pace.unit}</span>
            </dd>
            <dt className="machine-label">Avg pace</dt>
          </div>
        )}
      </dl>

      {metrics.length > 0 && (
        <dl
          className="run-metrics"
          aria-label="Imported run metrics"
          data-count={metrics.length}
          style={{ "--metric-columns": Math.min(metrics.length, 4) } as CSSProperties}
        >
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div key={metric.label} data-metric={metric.id}>
                <Icon className="run-metrics__icon" size={15} strokeWidth={2} aria-hidden="true" />
                <dd className="data-value">{metric.value}</dd>
                <dt className="machine-label">{metric.label}</dt>
              </div>
            );
          })}
        </dl>
      )}

      {insight && (
        <p className="run-insight" data-kind={insight.kind}>
          {insight.kind === "zone"
            ? <HeartPulse size={14} strokeWidth={2} aria-hidden="true" />
            : <Repeat size={14} strokeWidth={2} aria-hidden="true" />}
          <span>{insight.text}</span>
        </p>
      )}

      {notes}

      {profile && (
        <RunAnalysis
          key={runKey}
          facts={facts}
          profile={profile}
          selectedMetric={selectedMetric}
          onSelectMetric={setSelectedMetric}
        />
      )}

      <RunMetricSummaries facts={facts} profile={profile} activeMetric={activeAnalysisMetric} />

      {detailState === "error" && (
        <div className="run-result-detail__request">
          <p role="alert" className="run-result-detail__error">{error}</p>
          <Button variant="secondary" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
            Retry
          </Button>
        </div>
      )}

      {structuredIntervals.length > 0 && (
        <section className="run-intervals">
          <h3 className="run-detail__section-heading machine-label">Intervals</h3>
          <ol className="run-intervals__list" aria-label="Structured workout intervals">
            {structuredIntervals.map((interval, index) => (
              <li key={`${interval.label}-${index}`} className="run-intervals__row">
                <strong className="run-intervals__label">{interval.label}</strong>
                <span className="run-intervals__time data-value">
                  {formatDurationSeconds(interval.durationSeconds)}
                </span>
                <span className="run-intervals__facts machine-label">
                  {[
                    interval.distanceMiles !== undefined ? `${interval.distanceMiles.toFixed(2)} mi` : null,
                    interval.averageHeartRate !== undefined ? `${rounded(interval.averageHeartRate)} bpm` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Kept mounted so a run whose stream is still in flight does not shift
          the sheet as it lands; it renders nothing at all either way. */}
      {!profileSettled && <span className="visually-hidden" role="status">Loading run analysis</span>}
    </div>
  );
}
