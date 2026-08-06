import { describe, expect, it } from "vitest";
import { loadSeedPlan } from "../seed/loadSeedPlan";
import type { RunLog, TrainingPlan, Workout } from "../domain/types";
import {
  buildPreviewTower,
  targetMiles,
  widthForMiles,
  type PreviewOptions,
} from "./footprintPreview";

const baseOptions: PreviewOptions = {
  columns: 10,
  widthRule: "bands",
  heightSource: "type",
  wholePlan: true,
  maxWidth: 4,
};

function workout(
  id: string,
  type: Workout["type"],
  targetDistanceMiles: string | null,
  weekNumber = 1,
): Workout {
  return {
    id,
    date: `2026-08-${String(weekNumber + 2).padStart(2, "0")}`,
    weekNumber,
    phase: "Foundation",
    type,
    title: id,
    targetDistanceMiles,
    details: "",
    build: {
      renders: type !== "rest",
      weekRow: weekNumber,
      orderInWeek: 1,
      span: 1,
      colorKey: type === "rest" ? "neutral" : type,
    },
  };
}

function planOf(workouts: Workout[]): TrainingPlan {
  const weekNumbers = [...new Set(workouts.map((item) => item.weekNumber))];
  return {
    schemaVersion: 1,
    weeks: weekNumbers.map((weekNumber) => ({
      weekNumber,
      startDate: "2026-08-03",
      endDate: "2026-08-09",
      phase: "Foundation",
      workouts: workouts.filter((item) => item.weekNumber === weekNumber),
    })),
  } as TrainingPlan;
}

function log(workoutId: string, distanceMiles: number, minutesPerMile: number): RunLog {
  return {
    id: `log-${workoutId}`,
    workoutId,
    completedDate: "2026-08-04",
    distanceMiles,
    durationSeconds: Math.round(distanceMiles * minutesPerMile * 60),
    effort: "solid",
    notes: "",
    createdAt: "2026-08-04T12:00:00.000Z",
    updatedAt: "2026-08-04T12:00:00.000Z",
  };
}

describe("targetMiles", () => {
  it("takes the midpoint of a range", () => {
    expect(targetMiles(workout("w", "long", "4-5"))).toBe(4.5);
    expect(targetMiles(workout("w", "easy", "3"))).toBe(3);
    expect(targetMiles(workout("w", "race", "13.1"))).toBe(13.1);
  });

  it("falls back for a workout with no target", () => {
    expect(targetMiles(workout("w", "easy", null))).toBe(3);
  });
});

describe("widthForMiles", () => {
  it("clamps every rule to between one and six columns", () => {
    for (const rule of ["fine", "coarse", "bands"] as const) {
      expect(widthForMiles(0.1, rule)).toBe(1);
      expect(widthForMiles(50, rule)).toBeLessThanOrEqual(6);
      expect(widthForMiles(50, rule)).toBeGreaterThanOrEqual(1);
    }
  });

  it("never shrinks as the run gets longer", () => {
    for (const rule of ["fine", "coarse", "bands"] as const) {
      let previous = 0;
      for (let miles = 1; miles <= 14; miles += 0.5) {
        const width = widthForMiles(miles, rule);
        expect(width).toBeGreaterThanOrEqual(previous);
        previous = width;
      }
    }
  });
});

describe("buildPreviewTower", () => {
  it("drops each brick to the lowest landing it fits", () => {
    const tower = buildPreviewTower(
      planOf([
        workout("a", "easy", "2"),
        workout("b", "easy", "2"),
        workout("c", "easy", "2"),
      ]),
      [],
      { ...baseOptions, columns: 4 },
    );

    // Three 1-wide bricks all land on the ground rather than stacking.
    expect(tower.bricks.map((brick) => brick.y)).toEqual([0, 0, 0]);
    expect(tower.stats.courses).toBe(1);
  });

  it("stacks once the ground row cannot take the brick", () => {
    const tower = buildPreviewTower(
      planOf([
        workout("a", "long", "9-10"),
        workout("b", "long", "9-10"),
      ]),
      [],
      { ...baseOptions, columns: 6 },
    );

    expect(tower.bricks[0].y).toBe(0);
    expect(tower.bricks[1].y).toBe(1);
  });

  it("still leaves voids where wide bricks arch over uneven ground", () => {
    // Overhangs are the gaps worth having (docs/BUILD_CONCEPT.md §3), so the
    // levelling rule must not flatten them out of existence in pursuit of an
    // even skyline. A perfectly solid tower would mean it had.
    const tower = buildPreviewTower(loadSeedPlan(), [], baseOptions);

    expect(tower.stats.voids).toBeGreaterThan(5);
  });

  it("never overlaps two bricks", () => {
    const tower = buildPreviewTower(loadSeedPlan(), [], baseOptions);
    const seen = new Set<string>();
    for (const brick of tower.bricks) {
      for (let x = brick.x; x < brick.x + brick.width; x += 1) {
        for (let y = brick.y; y < brick.y + brick.height; y += 1) {
          expect(seen.has(`${x}:${y}`)).toBe(false);
          seen.add(`${x}:${y}`);
        }
      }
    }
  });

  it("keeps every brick inside the grid", () => {
    for (const columns of [6, 7, 8, 10]) {
      const tower = buildPreviewTower(loadSeedPlan(), [], {
        ...baseOptions,
        columns,
      });
      for (const brick of tower.bricks) {
        expect(brick.x).toBeGreaterThanOrEqual(0);
        expect(brick.x + brick.width).toBeLessThanOrEqual(columns);
      }
    }
  });

  it("gives the real plan far more footprint variety than the shipped span map", () => {
    const tower = buildPreviewTower(loadSeedPlan(), [], baseOptions);

    expect(tower.stats.bricks).toBe(71);
    // The shipped span map yields four sizes, 54% of them the identical 1x1.
    expect(tower.stats.footprints).toBeGreaterThan(4);
    expect(tower.stats.commonestShare).toBeLessThan(0.54);
  });

  it("only counts logged runs when the whole plan is off", () => {
    const plan = loadSeedPlan();
    const first = plan.weeks[0].workouts.find((item) => item.type !== "rest");
    const tower = buildPreviewTower(plan, [log(first!.id, 2, 9)], {
      ...baseOptions,
      wholePlan: false,
    });

    expect(tower.stats.bricks).toBe(1);
  });

  it("sizes a brick from the logged distance, not the target", () => {
    const plan = planOf([workout("a", "easy", "2")]);
    const short = buildPreviewTower(plan, [log("a", 2, 9)], {
      ...baseOptions,
      wholePlan: false,
    });
    const long = buildPreviewTower(plan, [log("a", 9, 9)], {
      ...baseOptions,
      wholePlan: false,
    });

    expect(long.bricks[0].width).toBeGreaterThan(short.bricks[0].width);
  });

  it("raises a brick when the run beat this runner's median pace for that type", () => {
    const plan = planOf([
      workout("a", "easy", "3"),
      workout("b", "easy", "3"),
      workout("c", "easy", "3"),
    ]);
    const logs = [log("a", 3, 10), log("b", 3, 10), log("c", 3, 8)];
    const tower = buildPreviewTower(plan, logs, {
      ...baseOptions,
      heightSource: "pace",
      wholePlan: false,
    });

    const fastest = tower.bricks.find((brick) => brick.workout.id === "c");
    const median = tower.bricks.find((brick) => brick.workout.id === "a");
    expect(fastest?.height).toBeGreaterThan(median?.height ?? 0);
  });

  it("keeps the tower from splitting into stacks of wildly different height", () => {
    // The plan's bricks get monotonically wider, so early narrow ones can
    // strand ledges no later brick fits. Left unchecked those columns stall
    // while the rest climbs, and the tower reads as two towers with a chasm.
    for (const [columns, maxWidth] of [
      [9, 3],
      [9, 4],
      [9, 5],
      [10, 4],
      [12, 5],
    ]) {
      const tower = buildPreviewTower(loadSeedPlan(), [], {
        ...baseOptions,
        widthRule: "fine",
        columns,
        maxWidth,
      });

      const skyline = new Array<number>(columns).fill(0);
      for (const brick of tower.bricks) {
        for (let x = brick.x; x < brick.x + brick.width; x += 1) {
          skyline[x] = Math.max(skyline[x], brick.y + brick.height);
        }
      }
      const spread = Math.max(...skyline) - Math.min(...skyline);
      expect(spread).toBeLessThanOrEqual(13);
    }
  });

  it("paints every brick over the ones it rests on", () => {
    // The oblique has no depth buffer: a brick's top and right faces project
    // into the space above it, so any brick lower in the tower must paint
    // first. Getting this backwards makes low bricks bleed over high ones.
    const tower = buildPreviewTower(loadSeedPlan(), [], baseOptions);

    for (const brick of tower.bricks) {
      for (const other of tower.bricks) {
        const overlapsColumns =
          brick.x < other.x + other.width && other.x < brick.x + brick.width;
        const restsOn = overlapsColumns && other.y + other.height <= brick.y;
        if (restsOn) {
          expect(brick.depth).toBeGreaterThan(other.depth);
        }
      }
    }
  });

  it("draws a top face only where nothing rests on the brick", () => {
    const tower = buildPreviewTower(
      planOf([
        workout("a", "long", "9-10"),
        workout("b", "long", "9-10"),
      ]),
      [],
      { ...baseOptions, columns: 6 },
    );

    expect(tower.bricks[0].showTopFace).toBe(false);
    expect(tower.bricks[1].showTopFace).toBe(true);
  });

  it("marks a mortar line per week, rising through the tower", () => {
    const tower = buildPreviewTower(loadSeedPlan(), [], baseOptions);

    expect(tower.mortar.length).toBeGreaterThan(10);
    expect(tower.mortar.length).toBeLessThanOrEqual(18);
    // Strictly rising: weeks topping out on the same course collapse to one
    // line, so no two mortar lines share a course.
    for (let index = 1; index < tower.mortar.length; index += 1) {
      expect(tower.mortar[index].y).toBeGreaterThan(tower.mortar[index - 1].y);
    }
  });

  it("wastes far fewer cells than the per-week bands it would replace", () => {
    const tower = buildPreviewTower(loadSeedPlan(), [], baseOptions);
    const cells = tower.bricks.reduce(
      (total, brick) => total + brick.width * brick.height,
      0,
    );
    const boundingBox = tower.stats.courses * baseOptions.columns;

    // Per-week bands waste 34% of the tower. Continuous stacking should be
    // well under that, counting both enclosed voids and the ragged top.
    expect((boundingBox - cells) / boundingBox).toBeLessThan(0.2);
  });
});
