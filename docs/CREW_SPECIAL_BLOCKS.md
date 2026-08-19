# Crew Special Blocks

Crew Special Blocks are zero-mile weekly awards that become physical, winner-owned pieces in the shared Crew Build.

## Weekly awards

Every completed Monday-Sunday Crew week can mint four standard awards plus one rotating Feature award.

Standard awards:

- **Most Miles** — highest total qualifying running mileage.
- **Best Zone 2** — highest percentage of a qualifying 30+ minute run spent in Zone 2.
- **Fastest Avg. Pace** — fastest average pace on a qualifying run of at least 2 miles.
- **Most Runs** — most qualifying runs; a run counts at 1+ mile or 10+ minutes.

Feature rotation, one per week:

1. **Long Haul** — longest single qualifying run.
2. **Steady** — lowest verified within-run pace variability on a qualifying 30+ minute run.
3. **On Target** — best execution against the scheduled workout's target-distance range.
4. **Level Up** — largest positive pace improvement against that runner's recent comparable baseline.

Then the four-week Feature cycle repeats from the Crew Build-start week.

`Steady` deliberately has no fabricated fallback. STACK currently does not persist a source-verified within-run pace-variability value, so a Steady week can show `No qualifier yet` until that scalar can be derived honestly from a verified source.

## Award lifecycle

- The server finalizes only fully completed weeks.
- Award finalization is idempotent.
- Once a Crew/week/award winner is created, late sync does not silently transfer that historical award to somebody else.
- An award has one winner and only that winner may place or move it.
- An unplaced award is `READY` only for its winner.
- In normal product UI, only the winning runner sees the compact `Special Block Ready` placement prompt.
- Other Crew members do not see another runner's unplaced award as something they can place.
- After placement, every Crew member can see and inspect the award in the shared tower.
- Award placement uses the same eight-column gravity/support rules as normal Crew Build blocks.
- Run blocks and award blocks collide with and support one another server-side.
- Moving a supporting block is rejected if the move would leave another block unsupported.

The full five-row current-week standings panel is a QA surface, not normal product UI. Add `?awardTest=1` to a preview URL to expose that diagnostic view while testing award calculations and empty states.

## Temporary end-to-end QA harness

PR #123 also carries a temporary deterministic harness that must be removed before the PR is merged.

1. Apply `20260819031500_crew_award_qa_harness.sql` to the QA Supabase project.
2. Sign in as the owner of the Crew named exactly `TEST CLUB`.
3. Open the preview with `?awardTest=1` and press **Seed 8 QA Blocks**.
4. The fixture creates eight fixed-ID, zero-mile award rows and leaves all of them READY.
5. The TEST CLUB owner receives **Miles, Pace, Long Haul, and On Target**.
6. The earliest joined second TEST CLUB member receives **Zone 2, Runs, Steady, and Level Up**.
7. Switch between the two QA accounts and verify that each account only receives placement prompts for its own four blocks.
8. Place and move the blocks through the normal Crew Build UI. These fixture rows use the same real `place_crew_award_block` RPC, collision rules, support rules, RLS, and Miles Built accounting as production awards.
9. Use **Clear QA Blocks** from the owner account when finished. Clearing runs mixed-tower support repair so any block that depended on a removed QA award returns safely to READY.

The harness is server-guarded: seed/clear only work for `auth.uid()` when that user owns a Crew named exactly `TEST CLUB`. It cannot seed another Crew even if someone exposes the RPC outside the hidden test UI.

`supabase/tests/0020_crew_award_qa_harness.sql` verifies the owner restriction, deterministic 4/4 winner split, READY start state, idempotent reseeding, and cleanup.

## Zero-mile rule

Award blocks are never runs and never contribute to `Miles Built`.

The physical Crew Build is therefore:

```text
placed run rectangles + placed award rectangles
```

while mileage remains:

```text
Miles Built = sum(placed run mileage only)
```

Award geometry is intentionally rectangular so the existing placement engine remains authoritative. Award identity is visual, not collision geometry.

## Footprints

Awards stay compact so they read as accents inside the eight-column tower rather than replacing the tower's run-built structure.

| Award | Footprint |
| --- | --- |
| Most Miles | 2 × 1 |
| Best Zone 2 | 2 × 1 |
| Fastest Avg. Pace | 2 × 1 |
| Most Runs | 2 × 1 |
| Long Haul | 3 × 1 |
| Steady | 2 × 1 |
| On Target | 2 × 1 |
| Level Up | 2 × 1 |

Long Haul is the only intentionally longer award piece. It gets one extra column so it still reads as a span without consuming half of the Crew Build.

## Visual language

All award blocks share a dark graphite/trophy-hardware shell.

- Runner Icon on the face = **who won it**.
- Award color + glyph = **what they won**.
- Feature awards add a restrained brass keyline.
- Award blocks show no mileage text.

Approved award language:

| Award | Face language |
| --- | --- |
| Most Miles | lime / three heavy vertical slabs |
| Best Zone 2 | cyan / controlled-effort gauge |
| Fastest Avg. Pace | orange / horizontal speed streaks |
| Most Runs | yellow / stacked mini bricks |
| Long Haul | brass / long structural span |
| Steady | blue / equal parallel lines |
| On Target | magenta / centered bullseye |
| Level Up | purple / rising steps |

## Safe Crew projection

Special Blocks narrowly extend the Crew-safe projection approved in D-056/D-061.

Raw private source data remains forbidden. In particular, STACK still does **not** send raw:

- heart rate or max heart rate;
- HR-zone arrays or raw zone durations;
- workout targets/details;
- GPS/routes/location;
- exact start time;
- notes or effort;
- Intervals external ids or credentials;
- private training history or AppState.

For award ranking only, a runner's device may publish these derived scalar scores onto that runner's own `shared_runs` row:

- `award_zone2_percent`;
- `award_target_percent`;
- `award_level_up_percent`;
- `award_steady_seconds` when a verified source exists.

The `sync_crew_award_metrics` RPC always scopes updates to `auth.uid()`, so one runner cannot submit or change another runner's award scores. These scalars exist only to make the approved Crew competition deterministic without crossing the raw-health-data boundary.

## Persistence

`crew_award_blocks` stores the historical award artifact separately from `shared_runs`:

- Crew;
- week start;
- award type;
- winner;
- winning scalar result;
- optional source shared-run reference;
- Crew Build row/column/placed timestamp.

Clients may read award rows only as active Crew members. Clients cannot directly insert/update/delete award rows; finalization and placement occur through authenticated RPCs.
