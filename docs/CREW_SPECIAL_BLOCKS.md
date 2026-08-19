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
- An unplaced award is `READY` for its winner.
- Award placement uses the same eight-column gravity/support rules as normal Crew Build blocks.
- Run blocks and award blocks collide with and support one another server-side.
- Moving a supporting block is rejected if the move would leave another block unsupported.

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
