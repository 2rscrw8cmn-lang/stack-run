# 2026 Training Plan

## Calendar

- Plan start: **Monday, August 3, 2026**
- Race day: **Saturday, December 5, 2026**
- Plan end/recovery day: **Sunday, December 6, 2026**
- Total duration: **18 weeks**

The supplied 12-week plan is preserved as the final 12 weeks, with six conservative foundation weeks added first.

The original template placed race day on Sunday. The final taper week is adjusted to the actual Saturday race.

## Week summary

| Week | Phase | Starts | Scheduled runs |
|---:|---|---|---|
| 1 | Foundation | 2026-08-03 | Tue: 2 Miles<br>Thu: 2 Miles<br>Sat: 2 Miles<br>Sun: Long Run: 4 Miles |
| 2 | Foundation | 2026-08-10 | Tue: 2-3 Miles<br>Thu: 2-3 Miles<br>Sat: 2 Miles<br>Sun: Long Run: 4-5 Miles |
| 3 | Foundation | 2026-08-17 | Tue: 3 Miles<br>Thu: 3 Miles<br>Sat: 2-3 Miles<br>Sun: Long Run: 5 Miles |
| 4 | Foundation Cutback | 2026-08-24 | Tue: 3 Miles<br>Thu: 2-3 Miles<br>Sat: 2 Miles<br>Sun: Long Run: 4 Miles |
| 5 | Foundation | 2026-08-31 | Tue: 3 Miles<br>Thu: 3 Miles<br>Sat: 3 Miles<br>Sun: Long Run: 5 Miles |
| 6 | Foundation | 2026-09-07 | Tue: 3 Miles<br>Thu: 3 Miles<br>Sat: 3 Miles<br>Sun: Long Run: 5 Miles |
| 7 | Prep | 2026-09-14 | Tue: 2-3 Miles<br>Thu: 2-3 Miles<br>Sat: 2-3 Miles<br>Sun: Long Run: 5 Miles |
| 8 | Prep | 2026-09-21 | Tue: 3-4 Miles<br>Thu: 3-4 Miles<br>Sat: 3-4 Miles<br>Sun: Long Run: 5-6 Miles |
| 9 | Main | 2026-09-28 | Tue: 4 Miles<br>Thu: 5 Miles<br>Sat: 3-4 Miles<br>Sun: Long Run: 6-7 Miles |
| 10 | Main | 2026-10-05 | Tue: 5 Miles<br>Thu: 5 Miles<br>Sat: Half Marathon Simulation<br>Sun: 3 Miles |
| 11 | Main | 2026-10-12 | Tue: 4-5 Miles<br>Thu: 5-6 Miles<br>Sat: 4 Miles<br>Sun: Long Run: 7-8 Miles |
| 12 | Main | 2026-10-19 | Tue: 4-5 Miles<br>Thu: 5-6 Miles<br>Sat: Half Marathon Simulation<br>Sun: 3-4 Miles |
| 13 | Main | 2026-10-26 | Tue: 4-5 Miles<br>Thu: 5-6 Miles<br>Sat: 4-5 Miles<br>Sun: Long Run: 8-9 Miles |
| 14 | Main | 2026-11-02 | Tue: 4-5 Miles<br>Thu: 5-6 Miles<br>Sat: Half Marathon Simulation<br>Sun: 3-4 Miles |
| 15 | Main | 2026-11-09 | Tue: 5-6 Miles<br>Thu: 5-6 Miles<br>Sat: 4 Miles<br>Sun: Long Run: 9-10 Miles |
| 16 | Main | 2026-11-16 | Tue: 5-6 Miles<br>Thu: 5-6 Miles<br>Sat: Half Marathon Simulation<br>Sun: 3-4 Miles |
| 17 | Main Cutback | 2026-11-23 | Tue: 4 Miles<br>Thu: 4 Miles<br>Sat: 3 Miles<br>Sun: Long Run: 6 Miles |
| 18 | Taper / Race | 2026-11-30 | Tue: 4 Miles<br>Thu: 3 Miles<br>Sat: OUC Half Marathon |

## Source of truth

The machine-readable source is:

```text
seed/stack-training-plan-2026.json
```

The agent must load the JSON instead of manually duplicating the schedule inside components.

## Editing philosophy

This plan is fixed content that the user may manually adjust.

STACK does not:

- Evaluate fitness
- Recommend pace
- Diagnose injury
- Automatically move missed runs
- Increase or decrease mileage
- Generate a replacement plan

## Safety note

The seed plan is not individualized medical advice. Pain, illness, or injury should not be overridden to preserve the visual stack.
