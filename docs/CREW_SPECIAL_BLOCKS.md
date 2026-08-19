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

`Steady` deliberately has no fabricated fallback. STACK currently does not persist a source-verified within-run pace-variability value (`crewAwardMetricsByRunId` publishes `steadySeconds: null`), so a Steady week produces no Feature award at all — one week in four — until that scalar can be derived honestly from a verified source. That is a known gap, not a bug: inventing steadiness from an average pace would be worse than awarding nothing.

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

Weekly standings are deliberately not a v1 surface. The finalizer is the single
authority on who won a week, and a Special Block enters the Crew Build by being
placed, not by being announced — so Crew shows the winner's placement prompt and
nothing else. The client does not mirror the ranking logic (D-080).

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

Every Special Block, standard and Feature alike, is one treatment: a **hollow block**.

- The **frame** is the runner's own colour — the same `--piece-color` a run block of
  theirs carries — so ownership reads identically everywhere in the tower.
- The **opening** is a recess, not a badge or a panel.
- The **award glyph** is suspended in the recess in the award's own colour, independent
  of the frame.

So the block answers two questions on two independent channels: the frame says *whose*,
the glyph says *which award*.

Rules that follow from that:

- No runner icon on the face. The frame colour is the ownership signal, and a second
  mark would say the same thing twice.
- No separate Feature treatment. Feature awards are the same hollow block; the glyph and
  its colour are the only difference. There is no brass keyline.
- No badges, inset chips, extra borders, or metal/stone/glass texture. The look stays
  arcade-simple.
- Award blocks show no mileage text.
- Geometry is unchanged from a run block: same 2:1 oblique, same top/right faces, same
  collision and support rules, so awards stack natively.

The same hollow block is the award's portrait away from the tower — the detail sheet
renders it at hero size and a member's profile lists it at row size, both in the
winner's frame colour. They are flat (no top/right faces) because nothing stacks on them.

Approved award language (OUC Half v1 monoline set; the glyph paths live in
`src/features/crew/AwardBrick.tsx`, the colours in `src/features/crew/awardBlock.css`):

| Award | Glyph colour | Glyph |
| --- | --- | --- |
| Most Miles | green `#39ff6a` | measured span between two rules |
| Best Zone 2 | red `#ff5a5f` | heart with a controlled-effort trace |
| Fastest Avg. Pace | cyan `#35d6ff` | stopwatch |
| Most Runs | amber `#ffb038` | stacked mini bricks |
| Long Haul | lime `#b6ff3a` | long structural span |
| Steady | teal `#2fe6c4` | metronome |
| On Target | magenta `#ff5ac8` | centred bullseye |
| Level Up | purple `#9d7bff` | rising steps |

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
