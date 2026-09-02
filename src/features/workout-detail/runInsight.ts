export interface RunInsight {
  /** What is stated, in full. Never a fragment the caller has to complete. */
  text: string;
  kind: "intervals";
}

export interface RunInsightInput {
  /** How many named structured groups the source's own detail carried. */
  structuredIntervalCount: number;
}

/**
 * One factual sentence about this run, or nothing.
 *
 * The rules are deliberately dull, and that is the point. Everything this can
 * say is a count of something the source already stated, so there is no reading
 * of the run in here at all. STACK does not tell a runner their easy run was
 * "nicely aerobic", that their intervals "held together", or that anything
 * about the run was good or bad: it has no product contract for those
 * statements, and inventing one to fill a row is how a training log turns into
 * a horoscope.
 *
 * Heart-rate zones used to be eligible here — `76% of this run was in Zone 2`
 * above the fold. They are not any more, and the reason is placement rather
 * than truth: a zone share is a heart-rate fact, Heart Rate states the whole
 * distribution in rows, and repeating the largest row at the top of the screen
 * made a heart-rate reading into the run's headline for every run that had one.
 *
 * Returning `null` is an ordinary outcome. A run whose source named no
 * structured groups simply has no line here, and the layout closes up around it
 * rather than showing an empty band.
 */
export function runInsight({ structuredIntervalCount }: RunInsightInput): RunInsight | null {
  if (structuredIntervalCount > 0) {
    return {
      kind: "intervals",
      text: `${structuredIntervalCount} structured ${structuredIntervalCount === 1 ? "interval" : "intervals"} recorded`,
    };
  }

  return null;
}
