# Phase Status

| Phase | Name | Status | Branch / PR | Notes |
|---:|---|---|---|---|
| 0 | Repository foundation | Ready for review | `feature/phase-0-foundation` | `npm run check` passes (lint, 36 tests, build). Manually verified at 320px, 390px, and 1280px. |
| 1 | App shell | Ready for review | `feature/ui-1-shell` | `npm run check` passes (lint, 54 tests, build). Manually verified at 320px, 390px, 768px, and 1280px. |
| 2 | Today | Ready for review | `feature/ui-2-today` | `npm run check` passes (lint, 72 tests, build). All 5 Today states manually verified at 320px and desktop (via a fixed-clock Playwright pass, since the sandbox's real date is before plan start). |
| 3 | Complete Run | Ready for review | `claude/ui3-log-modal-spacing-k0pwgp` | `npm run check` passes (lint, 91 tests, build). UI-3 implemented with validation, guarded entry/edit, one-log upsert, and local persistence. Sheet layout, keyboard-safe sheet height, digits-only duration entry, and Today card spacing fixed and verified at 320px, 390px, and 1280px via a fixed-clock Playwright pass. |
| 4 | Build | Ready for review | `claude/ui-4-stack-viz-wb437s` | `npm run check` passes (lint, 182 tests, build). Earned-block placement per D-014. Revised again after review: the tower is isometric (D-015) and a training week fills as many five-column courses as its blocks need (D-016), so the full plan builds a 36-course tower instead of an 18-row slab. Schema version 3; version 2 placements are re-laid into the narrower grid. Verified at 320px, 390px, and 768px against a production build; no horizontal overflow, keyboard placement and reduced motion confirmed. The tower stands on a site — ground, sky, and a translucent shaft showing the climb left to the race — with a phase gauge beside it, and placing now happens on the tower itself: the block hovers over its landing course and Drop commits. The tower is drawn in true oblique rather than under a perspective camera, so verticals stay vertical and the depth offset is constant at every height. Carries a temporary data panel for hands-on testing, listed for removal in UI-7. Now revised again per **D-017**: blocks are two-dimensional and earned from the run itself (width from distance, height from type adjusted by pace against the runner's own median), and they stack continuously in one ten-column grid instead of per-week bands. Schema version 4; versions 2 and 3 are replayed through the packer. `docs/BUILD_CONCEPT.md` records the measurements behind it, including the throwaway preview used to settle the open questions before the data model was touched. Verified at 320px, 390px, 768px and 1280px against a production build; no horizontal overflow. Carries a temporary data panel for hands-on testing, listed for removal in UI-7. **Open:** at 320px the narrowest block measures 19px against the 24px WCAG target-size floor — see BUILD_CONCEPT §8.1. |
| 5 | Plan | Not started |  |  |
| 6 | Plan adjustment | Not started |  |  |
| 7 | Polish and release | Not started |  |  |

## Update format

When changing a phase status, add:

- Branch name
- Pull request number
- Latest commit
- Verification result
- Remaining blocker, if any
