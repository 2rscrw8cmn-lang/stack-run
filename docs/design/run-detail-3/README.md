# Run Detail 3.0 — review screenshots

The visual review for issue #214, captured from the **QA Runner's synthetic
fixture** through the production components (`RunDetailSheet` →
`RunResultDetail` → `SourceRunDetail`), with no credential and no network. Every
number in them is invented: see `src/qa/qaRunner.ts` and `src/qa/qaSourceDetail.ts`.
No real activity, route or account data appears here, and none may.

| File | What it shows |
| --- | --- |
| `run-detail-390-result.png` | ~390px: identity in the scrolling body, the open result, the one metric strip, the insight, and the analysis tab bar |
| `run-detail-390-pace.png` | Pace over its elevation silhouette, with both axes, the legend and the drag hint |
| `run-detail-390-heart-rate.png` | Heart rate with the imported average across it, and `Time in zone` — ring and rows — inside the same module |
| `run-detail-390-scrub.png` | Scrubbing: crosshair, selected point, and a callout whose companion rows are named (`HR 148 bpm`, `Elev 52 ft`) |
| `run-detail-390-summaries.png` | The supporting modules: Elevation and Cadence side by side with their own sparklines |
| `run-detail-390-aggregate-only.png` | A run with aggregates and zones but no stream: no empty chart frame, and the summaries still carry it |
| `run-detail-390-run-options.png` | The `…` sheet: edit, plan linking, source (including the source's own activity name) and `How STACK calculates this` |
| `run-detail-320.png` | 320px: the result still on one line, the strip folded to 2×2, no horizontal scroll |
| `run-detail-desktop.png` | Desktop/tablet sanity check at 1024px |
