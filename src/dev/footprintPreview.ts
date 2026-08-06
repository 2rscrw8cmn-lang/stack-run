import { scheduledRuns } from "../domain/build";
import type { RunLog, TrainingPlan, Workout, WorkoutType } from "../domain/types";

/**
 * A throwaway model of the tower proposed in docs/BUILD_CONCEPT.md, built so
 * the open questions in that document can be answered by eye instead of on
 * paper. Nothing here touches `BlockPlacement`, the schema, or the shipped
 * Build screen — it reads the plan and the run logs and computes a tower from
 * scratch, so it can be deleted in one commit if the proposal is rejected.
 */

export type WidthRule = "fine" | "coarse" | "bands";
export type HeightSource = "type" | "effort" | "pace";

export interface PreviewOptions {
  columns: number;
  widthRule: WidthRule;
  heightSource: HeightSource;
  /** Whole plan projects unlogged runs from their target; otherwise logged only. */
  wholePlan: boolean;
  /** Widest brick allowed, in columns. */
  maxWidth: number;
}

export interface PreviewBrick {
  workout: Workout;
  runLog: RunLog | null;
  miles: number;
  /** Grid position, 0-based, y counted up from the ground. */
  x: number;
  y: number;
  width: number;
  height: number;
  showTopFace: boolean;
  showRightFace: boolean;
  /**
   * Paint order. An oblique projection has no depth buffer, and a brick's top
   * and right faces project up and to the right — into the space the bricks
   * above it occupy — so a brick must paint over everything lower than it.
   * Ordering by the brick's top edge rather than its base keeps tall bricks
   * from painting over the course that rests on them.
   */
  depth: number;
}

export interface PreviewMortar {
  weekNumber: number;
  /** The course this week's last brick tops out at, counted up from the ground. */
  y: number;
}

export interface PreviewStats {
  bricks: number;
  courses: number;
  /** Distinct `width`×`height` footprints across the whole tower. */
  footprints: number;
  /** Share of bricks taking the single most common footprint, 0–1. */
  commonestShare: number;
  /** Empty cells enclosed below the skyline — the arches and notches. */
  voids: number;
  /** Every footprint in the tower, most common first, for the readout. */
  histogram: { label: string; count: number }[];
}

export interface PreviewTower {
  bricks: PreviewBrick[];
  mortar: PreviewMortar[];
  stats: PreviewStats;
}

const HEIGHT_BY_TYPE: Record<WorkoutType, number> = {
  rest: 0,
  easy: 1,
  long: 1,
  intervals: 2,
  simulation: 2,
  race: 3,
};

/**
 * `targetDistanceMiles` is a string that may be a range ("4-5"), so the
 * midpoint stands in for runs that have not been logged yet.
 */
export function targetMiles(workout: Workout): number {
  const raw = workout.targetDistanceMiles;
  if (!raw) {
    return 3;
  }
  const parts = raw
    .split("-")
    .map((part) => Number.parseFloat(part))
    .filter((value) => Number.isFinite(value));
  if (parts.length === 0) {
    return 3;
  }
  return parts.reduce((sum, value) => sum + value, 0) / parts.length;
}

/** The three candidate width rules from docs/BUILD_CONCEPT.md §6 question 1. */
export function widthForMiles(miles: number, rule: WidthRule, maxWidth = 6): number {
  const raw =
    rule === "fine"
      ? Math.round(miles / 1.5)
      : rule === "coarse"
        ? Math.ceil(miles / 2)
        : miles < 3
          ? 1
          : miles < 5
            ? 2
            : miles < 8
              ? 3
              : miles < 12
                ? 4
                : 5;
  return Math.min(maxWidth, Math.max(1, raw));
}

/**
 * Median seconds per mile for each workout type, so `pace` height is measured
 * against how this runner actually runs that kind of session rather than an
 * absolute standard.
 */
function medianPaceByType(
  entries: { workout: Workout; runLog: RunLog | null }[],
): Map<WorkoutType, number> {
  const paces = new Map<WorkoutType, number[]>();
  for (const { workout, runLog } of entries) {
    if (!runLog || runLog.distanceMiles <= 0) {
      continue;
    }
    const list = paces.get(workout.type) ?? [];
    list.push(runLog.durationSeconds / runLog.distanceMiles);
    paces.set(workout.type, list);
  }

  const medians = new Map<WorkoutType, number>();
  for (const [type, list] of paces) {
    const sorted = [...list].sort((a, b) => a - b);
    medians.set(type, sorted[Math.floor(sorted.length / 2)]);
  }
  return medians;
}

function heightFor(
  workout: Workout,
  runLog: RunLog | null,
  source: HeightSource,
  medians: Map<WorkoutType, number>,
): number {
  const byType = HEIGHT_BY_TYPE[workout.type];
  if (source === "type" || !runLog) {
    return byType;
  }
  if (source === "effort") {
    // Taller the harder it felt. Whether that is the right incentive is
    // exactly what looking at it is meant to settle.
    return runLog.effort === "rough" ? 3 : runLog.effort === "solid" ? 2 : 1;
  }

  const median = medians.get(workout.type);
  if (median === undefined || runLog.distanceMiles <= 0) {
    return byType;
  }
  const pace = runLog.durationSeconds / runLog.distanceMiles;
  // Faster than your own median earns the taller block.
  if (pace <= median * 0.95) {
    return byType + 1;
  }
  if (pace >= median * 1.05) {
    return Math.max(1, byType - 1);
  }
  return byType;
}

interface Landing {
  x: number;
  y: number;
}

/**
 * Where a brick of this width comes to rest on the current skyline.
 *
 * Lowest landing first; then whichever of those opens least dead space beneath
 * the brick; then whichever sits most flush against a wall; then nearest the
 * centre, then leftmost.
 *
 * Height has to dominate, but on its own it packs badly. A wide brick rests on
 * the highest column it spans, so on uneven ground it opens a void every time,
 * and across a plan those compound: without the flatness tiebreak the same 71
 * bricks stack 58 courses with 161 voids instead of 34 with 24. Scoring
 * flatness *ahead* of height is worse still — it prefers a flat plateau high up
 * to an uneven notch near the ground, and the tower runs to 75 courses.
 *
 * Flushness fixes a failure the other two cannot see. The plan's bricks get
 * monotonically wider — the first third of the runs are mostly 1 and 2 columns,
 * the last third mostly 3 and 4 — so early narrow bricks strand narrow ledges
 * that no later brick can ever fit. Those columns stall while the rest of the
 * tower climbs, and it reads as two towers with a chasm between them rather
 * than one structure. Preferring landings walled in by the grid edge or by a
 * neighbour at least as tall stops the ledges forming, and takes the worst
 * measured spread from 29 courses down to 2.
 */
function landingFor(
  heights: number[],
  width: number,
  height: number,
): Landing {
  const centre = heights.length / 2;
  let best: Landing | null = null;
  let bestScore: number[] = [];

  for (let x = 0; x + width <= heights.length; x += 1) {
    let y = 0;
    for (let column = x; column < x + width; column += 1) {
      y = Math.max(y, heights[column]);
    }
    let opened = 0;
    for (let column = x; column < x + width; column += 1) {
      opened += y - heights[column];
    }

    const top = y + height;
    const leftFlush = x === 0 || heights[x - 1] >= top ? height : 0;
    const rightFlush =
      x + width === heights.length || heights[x + width] >= top ? height : 0;

    const score = [
      y,
      opened,
      -(leftFlush + rightFlush),
      Math.abs(centre - (x + width / 2)),
    ];

    let better = best === null;
    for (let rank = 0; !better && rank < score.length; rank += 1) {
      if (score[rank] < bestScore[rank]) {
        better = true;
      } else if (score[rank] > bestScore[rank]) {
        break;
      }
    }
    if (better) {
      best = { x, y };
      bestScore = score;
    }
  }

  return best ?? { x: 0, y: 0 };
}

export function buildPreviewTower(
  plan: TrainingPlan,
  runLogs: RunLog[],
  options: PreviewOptions,
): PreviewTower {
  const logsByWorkoutId = new Map(runLogs.map((log) => [log.workoutId, log]));
  const entries = scheduledRuns(plan)
    .map((workout) => ({
      workout,
      runLog: logsByWorkoutId.get(workout.id) ?? null,
    }))
    .filter((entry) => options.wholePlan || entry.runLog !== null);

  const medians = medianPaceByType(entries);
  const heights = new Array<number>(options.columns).fill(0);
  const bricks: PreviewBrick[] = [];

  for (const { workout, runLog } of entries) {
    const miles = runLog ? runLog.distanceMiles : targetMiles(workout);
    const width = Math.min(
      options.columns,
      widthForMiles(miles, options.widthRule, options.maxWidth),
    );
    const height = heightFor(workout, runLog, options.heightSource, medians);
    const { x, y } = landingFor(heights, width, height);

    for (let column = x; column < x + width; column += 1) {
      heights[column] = y + height;
    }
    bricks.push({
      workout,
      runLog,
      miles,
      x,
      y,
      width,
      height,
      showTopFace: true,
      showRightFace: true,
      depth: y + height,
    });
  }

  const filled = new Set<string>();
  for (const brick of bricks) {
    for (let x = brick.x; x < brick.x + brick.width; x += 1) {
      for (let y = brick.y; y < brick.y + brick.height; y += 1) {
        filled.add(`${x}:${y}`);
      }
    }
  }

  for (const brick of bricks) {
    const above = brick.y + brick.height;
    let covered = true;
    for (let x = brick.x; x < brick.x + brick.width; x += 1) {
      if (!filled.has(`${x}:${above}`)) {
        covered = false;
        break;
      }
    }
    let abutted = brick.x + brick.width < options.columns;
    for (let y = brick.y; abutted && y < brick.y + brick.height; y += 1) {
      if (!filled.has(`${brick.x + brick.width}:${y}`)) {
        abutted = false;
      }
    }
    brick.showTopFace = !covered;
    brick.showRightFace = !abutted;
  }

  const topOfWeek = new Map<number, number>();
  for (const brick of bricks) {
    const top = brick.y + brick.height;
    const current = topOfWeek.get(brick.workout.weekNumber) ?? 0;
    topOfWeek.set(brick.workout.weekNumber, Math.max(current, top));
  }
  // Two weeks can top out on the same course, and a line per week would then
  // draw twice with its labels overlapping. The higher week number wins: it is
  // the one whose blocks actually reach that course.
  const byCourse = new Map<number, number>();
  for (const [weekNumber, y] of topOfWeek) {
    byCourse.set(y, Math.max(byCourse.get(y) ?? 0, weekNumber));
  }
  const mortar = [...byCourse.entries()]
    .map(([y, weekNumber]) => ({ weekNumber, y }))
    .sort((a, b) => a.y - b.y);

  const courses = heights.reduce((max, value) => Math.max(max, value), 0);
  const counts = new Map<string, number>();
  for (const brick of bricks) {
    const label = `${brick.width}×${brick.height}`;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const histogram = [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  let voids = 0;
  for (let x = 0; x < options.columns; x += 1) {
    for (let y = 0; y < heights[x]; y += 1) {
      if (!filled.has(`${x}:${y}`)) {
        voids += 1;
      }
    }
  }

  return {
    bricks,
    mortar,
    stats: {
      bricks: bricks.length,
      courses,
      footprints: counts.size,
      commonestShare:
        bricks.length === 0 ? 0 : (histogram[0]?.count ?? 0) / bricks.length,
      voids,
      histogram,
    },
  };
}
