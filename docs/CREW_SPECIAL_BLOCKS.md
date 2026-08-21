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

- Awards roll out forward, never backward. `crews.awards_start_date` is a floor the
  finalizer never reaches behind: it defaults to the Crew's creation date, and existing
  Crews were backfilled to the rollout date, so nobody inherits a stack of READY blocks
  for weeks that closed before Special Blocks existed. The first awarded week is the
  first full Monday–Sunday week on or after that floor.
- The floor is forward-only. It stops finalization from minting retroactive awards but
  does not remove rows minted before it existed, and preview deployments shared the
  production Supabase project, so QA finalization wrote real award rows. Migration
  `20260820140000_remove_pre_rollout_award_blocks.sql` is the one-time cleanup: it deletes
  exactly the rows the finalizer would no longer create, then heals any construction that
  was resting on a removed award back to READY.
- The floor is a fairness rule, not just a launch convenience. Zone 2, On Target and
  Level Up rank on `award_*` scalars that each runner's own device publishes, and a
  Crew load syncs the viewer's history immediately before finalizing — so a retroactive
  week would go to whoever opened Crew first rather than to whoever won it, and
  `on conflict do nothing` would make that permanent. It applies to a new Crew whose
  owner backdates `build_start_date` for the same reason.
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

A placed award is lit: the frame carries a soft halo of the runner's own colour and the
glyph burns in the award's colour, with its light washing up off the floor of the recess.
That is what separates a Special Block from the matte run blocks around it — the piece
reads as switched on rather than as another rectangle.

The award detail sheet is the block's own trophy case. It renders the same `AwardBrick`
at a size the tower can never give it, with both depth faces drawn because nothing is
stacked on it there, beside three facts — winner, winning result, week — each carrying
the award's colour. A member's profile lists the same block flat at row size, small
enough that depth faces would only muddy it.

Approved award language (OUC Half v1 monoline set; the glyph paths live in
`src/features/crew/AwardBrick.tsx`, the colours in `src/styles/tokens.css`):

| Award | Glyph colour | Token | Glyph |
| --- | --- | --- | --- |
| Most Miles | green `#39ff6a` | `--award-miles` | measured span between two rules |
| Best Zone 2 | red `#ff5a5f` | `--award-zone2` | heart with a controlled-effort trace |
| Fastest Avg. Pace | cyan `#35d6ff` | `--award-pace` | stopwatch |
| Most Runs | amber `#ffb038` | `--award-runs` | stacked mini bricks |
| Long Haul | lime `#b6ff3a` | `--award-long-haul` | long structural span |
| Steady | teal `#2fe6c4` | `--award-steady` | metronome |
| On Target | magenta `#ff5ac8` | `--award-on-target` | centred bullseye |
| Level Up | purple `#9d7bff` | `--award-level-up` | rising steps |

An award wears this colour on every surface that shows it — the placed brick, the
detail sheet, a member's profile row and the ready panel that announces it. One table
in `src/features/crew/awardBlock.css` resolves `--award-mark` from these tokens for all
of them; no surface may assign an award a colour of its own. Stabilization 1.08 removed
a second palette in the ready panel that had Best Zone 2 arriving cyan there and red on
the brick it became.

The colour identifies which award this is. It is never a status: red here is Best Zone
2's mark, not a failure, and no award colour doubles as danger treatment.

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

These scores are published by the ordinary projection upload (`projectSharedRunsFromState` in `src/crew/projection.ts`), alongside distance, duration and heart rate — not by a separate call from the Crew screen. That matters for fairness: a runner who logs runs all week but never opens the Crew tab would otherwise have null scores when the week closed, and the finalizer freezes its answer, so Zone 2, On Target and Level Up would go to whoever opened Crew first. They are also part of the projection fingerprint, so a device that synced before the scores existed re-uploads once and backfills.

Writing them directly is not a widening of who may write what: RLS policy `shared_runs_update_self` restricts a runner to rows where `user_id = auth.uid()`, and the 0–100 / non-negative CHECK constraints bound the values on every path. The `sync_crew_award_metrics` RPC remains for the same guarantee and is still exercised by `supabase/tests/0021_crew_special_blocks.sql`; it is simply no longer the only writer. These scalars exist only to make the approved Crew competition deterministic without crossing the raw-health-data boundary.

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
