# Runs Reframe R4 — Integration Review

**Status:** implementation/review brief for `feature/runs-integration-review`.  
**Base:** `feature/stack-next`.  
**Phase:** R4. R1, R2 and R3 are owner-accepted and merged into `feature/stack-next`.  
**Purpose:** review Runs as one finished product system and make only the integration/polish fixes needed for coherence before NEXT-5 resumes.

## Goal

R4 is not a new feature phase.

It answers one question:

> **Does Runs now feel like one coherent STACK product from overview to history to single-run investigation?**

The product model to preserve is:

> **Overview explains the runner. History locates the run. Run Detail investigates the run.**

And the visual rule remains:

> **Interface is quiet. Data is STACK.**

R4 should remove seams between R1, R2 and R3. It should not invent a fourth layer of analytics or reinterpret the underlying running data.

---

# Read first

Before changing code, read the current branch versions of:

1. `AGENTS.md`
2. `START_HERE.md`
3. `docs/STACK_NEXT.md`
4. `docs/STACK_NEXT_ACCEPTANCE_LOG.md`
5. `docs/RUNS_PRODUCT_MODEL.md`
6. `docs/RUNS_VISUALIZATION_SYSTEM.md`
7. `docs/RUNS_R2_INFORMATION_ARCHITECTURE.md`
8. `docs/RUNS_R2_HISTORY_EXPLORER.md`
9. `docs/RUNS_R2_CHART_SYSTEM.md`
10. `docs/RUN_DETAIL_PRODUCT_SPEC.md`
11. `docs/RUNS_R3_RUN_DETAIL_ENRICHMENT.md`
12. `docs/CONNECTED_DATA_FIELDS.md`
13. `docs/QA_RUNNER.md`
14. `docs/RUNS_REFRAME_IMPLEMENTATION.md`
15. `docs/CURRENT_APPLICATION_STRUCTURE.md`
16. `docs/ENGINEERING_STANDARDS.md`

Then inspect the current integrated implementation rather than assuming the phase docs still describe every final detail exactly.

---

# R4 product review path

Review the full experience in this order.

## 1. Today → Runs handoff

Confirm the runner can move from the Today decision surface into Runs without a conceptual reset.

Check:

- Today remains about what matters now;
- Runs remains about how running has been going;
- Today does not duplicate the full Runs analysis;
- the transition into Runs feels expected and preserves context;
- no new Today feature is added in R4.

## 2. Runs Overview

The Overview should answer the runner's status quickly without turning into a dashboard or archive.

Confirm:

- current snapshot is understandable at a glance;
- Recent Training has one clear visual job;
- three featured Signals are enough before expansion;
- `Show all signals` expands inline cleanly;
- three Recent Runs orient the runner without dominating the page;
- bounded `Show more` remains useful but does not become History;
- `Explore history` reads as a distinct destination;
- no section repeats a fact merely because another component can display it;
- section order still feels intentional after R2/R3 changes.

## 3. Signal detail

Confirm Signal detail feels like explanation of an observation, not a second analytics app.

Check:

- visual first, methodology second;
- chart/readout hierarchy matches the R2 chart system;
- selected/current period treatment is consistent with History;
- no tiny or colliding labels;
- methodology remains available without occupying the default path;
- signal formulas, thresholds, ranking and availability are unchanged.

## 4. History Explorer

History should answer:

> **What happened over this period, and which runs make up that result?**

Confirm:

- History opens at its own top;
- Back restores the prior Overview scroll position;
- header is compact and safe-area correct;
- metric and range controls are visually quiet with 44px interaction targets;
- Miles and Time use bars;
- Runs, Load and Gain use lines;
- Zones remains composition-first;
- selected-period information belongs to the primary readout rather than a duplicate block below the graph;
- `4W` is exactly four trailing seven-day buckets;
- longer ranges aggregate at a readable density;
- axis labels never collide and are not made unreadably small to fit;
- aggregate mileage uses one decimal;
- optional-metric coverage is truthful and subordinate;
- `Runs in period` clearly corresponds to the active range/selection;
- run rows remain compact, flat and easy to scan;
- no Planned / Extra / History-only filter row returns;
- historical-only activities are never assigned an inferred STACK workout type.

## 5. Run Detail — aggregate-only

An aggregate-only run must look intentionally complete rather than broken.

Confirm:

- primary result is dominant;
- available secondary source facts are compact;
- HR zones appear when recorded;
- no empty Run Profile shell appears;
- no alarming error is shown merely because profile streams are unavailable;
- missing remains missing rather than becoming zero;
- cadence follows the verified source convention and is never doubled.

## 6. Run Detail — rich profile

A rich run should feel like the deepest investigative layer of Runs.

Confirm:

- Pace / Heart Rate / Elevation / Cadence selectors are legible and touch-friendly;
- selected-state styling is consistent with the rest of Runs;
- charts are visually stronger than their grids/frames;
- missing samples create visible gaps rather than false interpolation;
- Pace shape does not replace trusted average pace;
- HR shape does not replace imported Avg/Max;
- elevation shape does not replace source Gain;
- cadence is displayed under the documented source convention;
- HR zones remain descriptive;
- structured source intervals remain subordinate to the main result/profile hierarchy;
- no persistent debug or preview diagnostic UI remains.

### Real-source review requirement

At least one real Intervals-backed owner run must be opened on iPhone Safari with Intervals connected on the **same hostname being reviewed**.

Intervals credentials are browser/domain-local. A Vercel preview with no connection should correctly produce no source reader and therefore no live Run Profile request; that state must not be mistaken for a stream/normalizer failure.

Do not expose credentials, raw stream payloads, GPS/route data or private activity payloads for R4 review.

## 7. Historical-only Run Detail

Confirm historical-only source runs use the same source-owned presentation without gaining fake STACK ownership.

They may show source-owned telemetry when a stable activity id and connection exist, but must not gain:

- effort;
- notes;
- plan relationship;
- edit controls;
- extra/planned classification;
- Build block;
- import/accept action;
- inferred workout type.

Historical-only detail should not feel visually second-class merely because the run was never accepted into STACK.

## 8. Build and Plan adjacency

R4 may inspect Build and Plan only to verify that the new Runs system still makes sense around them.

Confirm:

- opening/editing/deleting a run still preserves Build semantics;
- Runs does not imply historical Build backfill;
- Plan matching/linking remains intact;
- Run Detail plan actions still behave correctly;
- Runs does not duplicate Plan's future-intent job;
- Build remains the emotional reward layer rather than an analytics destination.

**Do not redesign Build or Plan in R4.** Plan role revision is NEXT-5.

---

# Visual consistency targets

R4 is allowed to fix inconsistent presentation created by the separate R1/R2/R3 phases.

Prioritize:

- consistent screen/sheet hierarchy;
- consistent section spacing and hairlines;
- normal STACK sans for interface/navigation language;
- machine/mono treatment mainly for values, units, dates, axes and technical metadata;
- lime for active/current/selected states rather than general decoration;
- compact controls with 44px interaction floors;
- readable chart labels before dense tick counts;
- one visual job per fact;
- flat run rows rather than unnecessary rounded-card repetition;
- safe-area behavior on real iPhone Safari;
- correct scroll restoration between Overview and History;
- no horizontal overflow at phone widths;
- no persistent touch-focus ring that visually overwhelms the selected control while preserving true keyboard `:focus-visible` accessibility.

A styling change is justified only when it improves coherence across the integrated Runs experience, not because one isolated screen could be made more decorative.

---

# Allowed R4 fixes

R4 may make small integration corrections such as:

- spacing/hierarchy cleanup;
- label/copy consistency;
- chart density/readability fixes;
- selected/default-period consistency;
- touch/focus/accessibility polish;
- safe-area or sheet-height fixes;
- scroll restoration/navigation-state fixes;
- removing duplicated readouts or redundant chrome;
- aligning Recent Runs and History run-row presentation;
- aligning Run Detail selectors with the R2 control language;
- fixing a genuine regression uncovered by the end-to-end review.

If a fix requires changing a domain calculation or inventing a new product concept, stop and treat it as a separate phase/issue rather than sneaking it into R4.

---

# Non-goals

R4 does **not** add:

- new Training Signals;
- new signal formulas or thresholds;
- Best Efforts / PR detection;
- aggregate pace or HR trend across runs;
- new workout-type inference;
- route maps or GPS visualization;
- FIT parsing;
- VO2 max;
- readiness/recovery/fatigue scoring;
- performance prediction;
- wellness UI;
- historical Build backfill;
- new Crew functionality;
- Plan redesign;
- automatic plan changes;
- new persistence/schema/migrations;
- durable raw-stream storage.

Do not begin NEXT-5 inside this branch.

---

# Data and domain boundaries

R4 must not change the meaning of:

- `unifiedRunnerHistory` identity/dedupe;
- historical reconciliation;
- account-scoped historical isolation;
- historical sync lifecycle;
- `RunnerRun` ownership semantics;
- Training Signal formulas/thresholds/order/availability;
- source aggregate semantics;
- cadence convention;
- elevation-gain truth;
- run matching/linking;
- RunLog editing/deletion;
- Build earning/placement;
- Crew safe projection;
- missing-is-missing behavior.

The governing Run Detail rule remains:

> **Streams provide shape. Aggregates provide stated numbers.**

---

# QA and review matrix

Use the existing reusable QA Runner. Do not create another demo system.

Review at minimum:

- 320px;
- 390px;
- 430px;
- desktop;
- real iPhone Safari.

Exercise at least:

- Runs Overview default state;
- Signals expanded and collapsed;
- Recent Runs expanded and collapsed;
- one Signal detail;
- History: Miles 4W;
- History: one longer range;
- History: one optional connected metric with partial coverage;
- History: Zones;
- aggregate-only accepted run;
- rich-profile accepted run;
- aggregate-only historical-only run;
- rich-profile historical-only run;
- one real owner Intervals-backed run on the same connected preview hostname;
- History Back → Overview scroll restoration;
- Run Detail close/reopen and switching between runs;
- Plan-linked run actions;
- editing/deleting an accepted run without Build/history regression.

Do not require every real run to have stream data. A genuine aggregate-only run is an accepted product state.

---

# Regression verification

Before R4 is ready for owner acceptance, run on final head:

```text
npm install
npm run check
git diff --check
```

Add focused regression tests only for bugs or integration seams actually changed in R4. Do not create tests that merely restate screenshots.

The final PR description should distinguish:

- issues found during integration review;
- fixes made;
- things intentionally left unchanged;
- real-device states reviewed;
- remaining program-level verification caveats.

---

# Acceptance criteria

R4 is ready to merge when the owner can move through:

> **Today → Runs Overview → Signal/History → Run Detail → back to Runs**

without encountering a change in visual language, data semantics or navigation behavior that feels like entering a different feature.

Specifically:

1. Overview stays concise and actual-first.
2. Signals expand inline and detail explains rather than overwhelms.
3. Recent Runs expands only for orientation; History remains the archive/exploration destination.
4. History metric/range/readout/chart/run-list hierarchy is immediately understandable on iPhone.
5. Charts remain readable without tiny/colliding labels.
6. Logged and historical-only runs open coherent detail through the shared presentation.
7. Rich profiles work when real source access exists; aggregate-only detail remains intentional when it does not.
8. No fact is given multiple competing visual jobs.
9. Today, Build and Plan still make sense around Runs without being redesigned.
10. No domain/source/history semantics changed accidentally.
11. No new feature scope was introduced.
12. The final integrated Runs experience feels finished enough that NEXT-5 can begin without reopening Runs architecture.

After explicit owner acceptance, merge R4 into `feature/stack-next`, record acceptance in `docs/STACK_NEXT_ACCEPTANCE_LOG.md`, and resume **NEXT-5 — Plan role revision** on a fresh branch.