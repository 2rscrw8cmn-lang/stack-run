# Crew Special Block visual study

This branch contains a visual-only prototype for the eight proposed Crew Special Blocks:

- Most Miles
- Best Zone 2
- Fastest Avg. Pace
- Most Runs
- Long Haul
- Steady
- On Target
- Level Up

## Safety boundary

The study is intentionally isolated from the live Crew Build data model. It does not change `shared_runs`, mileage totals, Crew placement RPCs, or the existing `Brick` primitive. Award blocks are treated as zero-mile visual concepts only.

## Visual rule being tested

- Runner identity: existing runner icon
- Award identity: face geometry/glyph
- Special status: shared heavy inset/hardware treatment
- Physical footprint: rectangular 8-column-grid-compatible shape
- Mileage contribution: zero

The purpose of this branch is approval of the visual language before implementing award persistence, winner calculation, or live placement.
