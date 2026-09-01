# Run Detail 3.0 — review screenshots

The visual review for issue #214, captured from the **QA Runner's synthetic
fixture** through the production components (`RunDetailSheet` →
`RunResultDetail` → `SourceRunDetail`), with no credential and no network. Every
number in them is invented: see `src/qa/qaRunner.ts` and `src/qa/qaSourceDetail.ts`.
No real activity, route or account data appears here, and none may.

| File | What it shows |
| --- | --- |
| `run-detail-390-result.png` | ~390px: identity, result, metric strip, insight, analysis tabs, pace over its elevation silhouette |
| `run-detail-320.png` | 320px: the same screen with the result still on one line and no horizontal scroll |
| `run-detail-390-heart-rate.png` | Heart rate with the imported average drawn across it, and the zone distribution inside it |
| `run-detail-390-scrub.png` | Scrubbing: crosshair, selected point, and the callout's companion readings |
| `run-detail-390-cadence.png` | Cadence as a step, stated verbatim at the source's own convention |
| `run-detail-390-aggregate-only.png` | A run with aggregates and zones but no stream: no empty chart frame, zones kept |
| `run-detail-390-run-options.png` | The `…` sheet: edit, plan linking, provenance and `How STACK calculates this` |
| `run-detail-desktop.png` | Desktop/tablet sanity check at 1024px |
