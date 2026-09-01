import { formatDurationSeconds } from "../../domain/duration.js";
import { formatDateLabel, isLocalDateString } from "../../domain/dates.js";
import type { SourceRunFacts } from "./sourceRunFacts.js";

export interface RunOptionFact {
  label: string;
  value: string;
}

/**
 * How different elapsed time has to be from moving time before it is a fact
 * about the run rather than rounding.
 */
const ELAPSED_SIGNIFICANCE_SECONDS = 30;

/**
 * The run's provenance, as rows.
 *
 * Everything here used to sit at the top of Run Detail, above the result, in a
 * line reading `SOURCE · INTERVALS.ICU`. Issue #214 moved it behind the run
 * options control, and the reason is worth stating: which service a run came
 * through is not what the run *was*. It is how STACK knows about it, which is
 * exactly the kind of question a runner asks occasionally and deliberately.
 *
 * Nothing is defaulted. A row appears when the fact exists and is absent when
 * it does not, so an empty list is a truthful answer and not a broken screen.
 */
export function sourceRunOptionFacts(
  facts: SourceRunFacts,
  options: {
    sourceLabel?: string | null;
    effortLabel?: string | null;
    /** A heart rate the runner typed, which is never a source-verified fact. */
    manualHeartRate?: number | null;
    importedAt?: string | null;
    sourceUpdatedAt?: string | null;
  } = {},
): RunOptionFact[] {
  const rows: RunOptionFact[] = [];
  if (options.sourceLabel) rows.push({ label: "Source", value: options.sourceLabel });
  if (options.effortLabel) rows.push({ label: "Effort", value: options.effortLabel });
  if (options.manualHeartRate != null) {
    rows.push({ label: "Avg HR (entered)", value: `${Math.round(options.manualHeartRate)} bpm` });
  }
  if (
    facts.durationSeconds !== null &&
    facts.elapsedTimeSeconds !== null &&
    Math.abs(facts.elapsedTimeSeconds - facts.durationSeconds) >= ELAPSED_SIGNIFICANCE_SECONDS
  ) {
    rows.push({ label: "Elapsed", value: formatDurationSeconds(facts.elapsedTimeSeconds) });
    rows.push({ label: "Moving", value: formatDurationSeconds(facts.durationSeconds) });
  }
  const imported = stampLabel(options.importedAt);
  if (imported) rows.push({ label: "Imported", value: imported });
  const updated = stampLabel(options.sourceUpdatedAt);
  if (updated) rows.push({ label: "Source updated", value: updated });
  return rows;
}

/**
 * A stored timestamp as a plain calendar day.
 *
 * Only the date part is read: the stamp is a UTC instant, and turning it into a
 * local time here would be a guess about which day it belongs to for a runner
 * who has since travelled. A value that is not a timestamp at all — legacy
 * fixtures wrote `"now"` — yields nothing rather than `Invalid Date`.
 */
function stampLabel(timestamp: string | null | undefined): string | null {
  const day = timestamp?.slice(0, 10);
  return day && isLocalDateString(day)
    ? formatDateLabel(day, { month: "short", day: "numeric", year: "numeric" })
    : null;
}

/**
 * `How STACK calculates this`, in the fewest sentences that answer it.
 *
 * These are the rules a runner would otherwise have to take on trust when a
 * STACK number disagrees with another app's — most often elevation gain, where
 * Intervals' climbing total and HealthFit's much coarser threshold genuinely
 * answer different questions. See `docs/CONNECTED_DATA_FIELDS.md`.
 */
export const RUN_METHODOLOGY_NOTES: readonly string[] = [
  "Distance, duration, pace, heart rate, elevation gain, cadence and load are the source's own summary values. STACK states them as imported and never recomputes them.",
  "Charts are drawn from the run's per-second streams. They show the shape of the run; they are never averaged into a summary number.",
  "Gain is the source's climbing total over the whole run, not the difference between the lowest and highest point, which is why it can differ from another app's figure.",
  "Cadence is shown exactly as the source reports it, with no doubling and no unit STACK has not verified.",
  "A metric with no reading is left out rather than shown as zero, and a gap in a stream is drawn as a gap.",
];
