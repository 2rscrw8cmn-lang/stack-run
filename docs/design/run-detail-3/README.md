# Run Detail 3.0 — review screenshots

The visual review for issue #214, captured from the **QA Runner's synthetic
fixture** through the production components (`RunDetailSheet` →
`RunResultDetail` → `SourceRunDetail`), with no credential and no network. Every
number in them is invented: see `src/qa/qaRunner.ts` and `src/qa/qaSourceDetail.ts`.
No real activity, route or account data appears here, and none may.

| File | What it shows |
| --- | --- |
| `run-detail-390-result.png` | ~390px: identity in the scrolling body, the result, the insight, and the analysis tab bar — with no strip of secondary aggregates between them |
| `run-detail-390-long-values.png` | The three result acceptance cases at ~390px: `5.2 mi / 49:40 / 9:33`, `6 mi / 1:05:00 / 10:50` and `13.1 mi / 2:08:45 / 9:50`, each on one row with `/MI` intact |
| `run-detail-390-pace.png` | Pace over its elevation silhouette, with both axes, the legend and the drag hint |
| `run-detail-390-heart-rate.png` | Heart rate with the imported average across it, and `Time in zone` as full-width rows — no ring — inside the same module |
| `run-detail-390-elevation.png` | Elevation with the source Gain, stream Low/High and the scrubbable terrain profile |
| `run-detail-390-cadence.png` | Cadence with its source-stated average and calmer discrete step treatment |
| `run-detail-390-scrub.png` | Scrubbing: crosshair, selected point, and a callout whose companion rows are named (`HR 146 bpm`, `Elev 53 ft`) |
| `run-detail-390-aggregate-only.png` | A run with aggregates but no stream: one complete result and no empty chart or fallback metric cards |
| `run-detail-390-run-options.png` | The `…` sheet: edit, plan linking, source (including the source's own activity name), every source aggregate — avg/max HR, gain, cadence, training load — and `How STACK calculates this` |
| `run-detail-320.png` | 320px: the result still on one line with its unit intact, the tab labels in their short form, no horizontal scroll |
| `run-detail-desktop.png` | Desktop/tablet sanity check at 1024px |

The long-value capture overrides only the fixture run's distance and duration,
and is cropped to the result: the chart below it is drawn from the fixture's own
49:40 stream and would contradict an overridden duration.

The rich fixture run is an **extra** run — the QA fixture deliberately leaves it
unlinked so it cannot change which plan days read as completed — so these show
STACK's own classification as the identity and no plan line. A plan-linked run
adds `Week N` and, for an exact plan target, the distance comparison beneath the
result.
