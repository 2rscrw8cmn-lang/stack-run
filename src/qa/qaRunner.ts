import { addDaysToLocalDate, daysBetweenLocalDates } from "../domain/dates";
import { footprintFor } from "../domain/footprint";
import { autoPlaceOption, placementOptions } from "../domain/placement";
import type {
  AppState,
  BlockPlacement,
  RunActivityType,
  RunLog,
  TrainingPlan,
  Workout,
} from "../domain/types";
import type { HistoricalActivity } from "../history/historicalActivity";
import { loadSeedPlan } from "../seed/loadSeedPlan";
import { createInitialAppState } from "../storage/migrations";
import {
  QA_AGGREGATE_ONLY_ACTIVITY_ID,
  QA_HISTORICAL_AGGREGATE_ACTIVITY_ID,
  QA_HISTORICAL_RICH_ACTIVITY_ID,
  QA_RICH_PROFILE_ACTIVITY_ID,
} from "./qaSourceDetail";

/**
 * Public synthetic review credentials. They unlock no real runner data and are
 * deliberately useful only on localhost / Vercel branch previews.
 */
export const QA_RUNNER_EMAIL = "stack.qa.runner@example.com";
export const QA_RUNNER_PIN = "42424242";
export const QA_RUNNER_DISPLAY_NAME = "QA Runner";

/** The seed plan's second Sunday. We shift the whole plan so this day is today. */
const QA_PLAN_ANCHOR_DATE = "2026-08-16";
const QA_RACE_NAME = "QA Half Marathon";
const METERS_PER_MILE = 1609.344;

/**
 * Which side of the plan window the review runner stands on.
 *
 * NEXT-5 gave Plan three lifecycles, and two of them were unreachable in
 * review: the harness always placed an active plan around today, so
 * `Plan starts…` and `Plan complete` could only ever be read in a test. The
 * fixture is otherwise identical — same seed plan, same runs, same history
 * generator — so what a review compares is the lifecycle and nothing else.
 */
export type QaPlanLifecycle = "active" | "before-plan" | "after-race";

export const QA_PLAN_LIFECYCLES: QaPlanLifecycle[] = [
  "active",
  "before-plan",
  "after-race",
];

/**
 * How far today sits from the edge of the plan window. Both are deliberately
 * close in: a plan starting next week and a race a fortnight gone are the
 * states a runner actually opens Plan in, and a distant edge would hide
 * whether the screen still reads well beside recent running.
 */
const QA_LIFECYCLE_EDGE_DAYS = {
  /** Training starts in ten days, so week 1 is a genuine preview. */
  "before-plan": 10,
  /** Race day was twelve days ago, so the finished plan is still recent. */
  "after-race": -12,
} as const;

/** The QA lifecycle a review URL asks for, defaulting to the active plan. */
export function qaPlanLifecycleFrom(search: string | null | undefined): QaPlanLifecycle {
  const requested = new URLSearchParams(search ?? "").get("qa");
  return QA_PLAN_LIFECYCLES.find((lifecycle) => lifecycle === requested) ?? "active";
}

interface LocationLike {
  hostname: string;
}

export function isQaPreviewHost(location?: LocationLike | null): boolean {
  const current = location ?? (typeof window === "undefined" ? null : window.location);
  if (!current) return false;
  const hostname = current.hostname.toLowerCase();
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    (hostname.endsWith(".vercel.app") && hostname.includes("-git-"))
  );
}

export function isQaRunnerEmail(email: string | null | undefined): boolean {
  return email?.trim().toLowerCase() === QA_RUNNER_EMAIL;
}

export function isQaRunnerSession(
  email: string | null | undefined,
  location?: LocationLike | null,
): boolean {
  return isQaPreviewHost(location) && isQaRunnerEmail(email);
}

function shiftDate(date: string, days: number): string {
  return addDaysToLocalDate(date, days);
}

/**
 * How far the seed plan moves so that its window lands where the reviewed
 * lifecycle needs it: around today, entirely ahead of it, or entirely behind.
 */
function planDelta(today: string, lifecycle: QaPlanLifecycle): number {
  const source = loadSeedPlan();
  if (lifecycle === "before-plan") {
    return daysBetweenLocalDates(
      source.startDate,
      addDaysToLocalDate(today, QA_LIFECYCLE_EDGE_DAYS["before-plan"]),
    );
  }
  if (lifecycle === "after-race") {
    return daysBetweenLocalDates(
      source.race.date,
      addDaysToLocalDate(today, QA_LIFECYCLE_EDGE_DAYS["after-race"]),
    );
  }
  return daysBetweenLocalDates(QA_PLAN_ANCHOR_DATE, today);
}

function shiftedPlan(today: string, lifecycle: QaPlanLifecycle = "active"): TrainingPlan {
  const source = loadSeedPlan();
  const delta = planDelta(today, lifecycle);
  return {
    ...source,
    id: "stack-qa-runner-plan",
    name: "QA Half Marathon Build",
    race: {
      ...source.race,
      name: QA_RACE_NAME,
      date: shiftDate(source.race.date, delta),
      location: "Preview City",
    },
    startDate: shiftDate(source.startDate, delta),
    endDate: shiftDate(source.endDate, delta),
    weeks: source.weeks.map((week) => ({
      ...week,
      startDate: shiftDate(week.startDate, delta),
      endDate: shiftDate(week.endDate, delta),
      workouts: week.workouts.map((workout) => ({
        ...workout,
        date: shiftDate(workout.date, delta),
        // Race day carries the race's own name, so a review never sees the
        // synthetic race called one thing in the plan and another on the day.
        ...(workout.type === "race" ? { title: QA_RACE_NAME } : {}),
      })),
    })),
  };
}

function isRunWorkout(workout: Workout): workout is Workout & { type: RunActivityType } {
  return workout.type !== "rest";
}

function targetMiles(workout: Workout, index: number): number {
  const parsed = workout.targetDistanceMiles
    ? Number.parseFloat(workout.targetDistanceMiles)
    : Number.NaN;
  if (Number.isFinite(parsed) && parsed > 0) return parsed + (index % 2 ? 0.2 : 0);
  if (workout.type === "long") return 6 + index * 0.25;
  if (workout.type === "intervals" || workout.type === "simulation") return 4.5;
  if (workout.type === "race") return 13.1;
  return 3.25;
}

function zoneSeconds(duration: number, lowerShare: number): number[] {
  const z1 = Math.round(duration * 0.34);
  const z2 = Math.round(duration * Math.max(0.05, lowerShare - 0.34));
  const remaining = Math.max(0, duration - z1 - z2);
  const z3 = Math.round(remaining * 0.55);
  const z4 = Math.round(remaining * 0.3);
  const z5 = Math.max(0, remaining - z3 - z4);
  return [z1, z2, z3, z4, z5, 0, 0];
}

function activity({
  sourceId,
  date,
  miles,
  paceSecondsPerMile,
  averageHeartRate,
  maxHeartRate,
  cadence,
  trainingLoad,
  lowerZoneShare,
  hasElevationGain = true,
  seenAt,
  name,
}: {
  sourceId: string;
  date: string;
  miles: number;
  paceSecondsPerMile: number;
  averageHeartRate: number;
  maxHeartRate: number;
  cadence: number;
  trainingLoad: number | null;
  lowerZoneShare: number | null;
  hasElevationGain?: boolean;
  seenAt: string;
  name: string;
}): HistoricalActivity {
  const movingTimeSeconds = Math.max(60, Math.round(miles * paceSecondsPerMile));
  return {
    provider: "intervals",
    sourceId,
    startDateLocal: date,
    startTimeLocal: `${date}T06:30:00`,
    sourceType: "Run",
    name,
    distanceMeters: miles * METERS_PER_MILE,
    movingTimeSeconds,
    elapsedTimeSeconds: movingTimeSeconds + 75,
    averageHeartRate,
    maxHeartRate,
    hrZoneSeconds:
      lowerZoneShare === null ? null : zoneSeconds(movingTimeSeconds, lowerZoneShare),
    elevationGainMeters: hasElevationGain ? Math.round(miles * 18) : null,
    averageCadence: cadence,
    trainingLoad,
    sourceUpdatedAt: seenAt,
    firstSeenAt: seenAt,
    lastSeenAt: seenAt,
    reconciledAt: null,
  };
}

function planRunLogs(plan: TrainingPlan, today: string): RunLog[] {
  const completed = plan.weeks
    .flatMap((week) => week.workouts)
    .filter(isRunWorkout)
    .filter((workout) => workout.date < today)
    .slice(-8)
    // Leave one recent scheduled run genuinely missed so Plan has a missed state.
    .filter((_, index) => index !== 5);

  return completed.map((workout, index) => {
    const distanceMiles = targetMiles(workout, index);
    const durationSeconds = Math.round(distanceMiles * (9.65 + (index % 3) * 0.12) * 60);
    const timestamp = `${workout.date}T12:00:00.000Z`;
    const externalId = `qa-plan-${workout.id}`;
    return {
      id: `qa-run-${workout.id}`,
      workoutId: workout.id,
      completedDate: workout.date,
      activityType: workout.type,
      distanceMiles,
      durationSeconds,
      effort: index % 4 === 0 ? "great" : "solid",
      notes: index === 2 ? "Comfortable finish." : "",
      createdAt: timestamp,
      updatedAt: timestamp,
      source: "intervals",
      externalSource: {
        provider: "intervals",
        activityId: externalId,
        sourceUpdatedAt: timestamp,
        importedAt: timestamp,
      },
      importedMetrics: {
        averageHeartRate: 143 + (index % 5),
        maxHeartRate: 164 + (index % 5),
        averageCadence: 80,
        elevationGainFeet: Math.round(distanceMiles * 58),
        elapsedTimeSeconds: durationSeconds + 75,
        trainingLoad: 42 + index * 3,
        hrZoneSeconds: zoneSeconds(durationSeconds, 0.72),
      },
    };
  });
}


/**
 * The four runs R3 exists to make reviewable, and the reason they are named
 * rather than picked out of the crowd.
 *
 * Run Detail has two axes that have never been reviewable together: whether a
 * run is STACK-owned or historical-only, and whether its source supplied a
 * profile or only summary aggregates. These are one run for each corner, so an
 * owner can open all four in a row and see that the rich state is rich, the
 * poor state is honest, and neither one invents anything it does not have.
 *
 * Their activity ids are the same ones `qaSourceDetail.ts` answers profile
 * reads for. Nothing else in the fixture has a profile, which is deliberate:
 * the ordinary case is a run with aggregates only, and it should look ordinary.
 */
const QA_REVIEW_DAYS_AGO = {
  richAccepted: 2,
  aggregateAccepted: 4,
  richHistorical: 9,
  aggregateHistorical: 11,
} as const;

/**
 * Two accepted runs: one whose source has a full profile and structured
 * groups, one whose source has neither.
 *
 * Both are extra runs. Attaching them to scheduled workouts would change which
 * plan days read as completed, and R3 is not a plan phase.
 */
function reviewRunLogs(today: string): RunLog[] {
  const richDate = addDaysToLocalDate(today, -QA_REVIEW_DAYS_AGO.richAccepted);
  const aggregateDate = addDaysToLocalDate(today, -QA_REVIEW_DAYS_AGO.aggregateAccepted);
  const stamp = (date: string) => `${date}T13:00:00.000Z`;

  return [
    {
      id: "qa-run-detail-rich",
      workoutId: null,
      completedDate: richDate,
      activityType: "intervals",
      distanceMiles: 5.2,
      durationSeconds: 2980,
      effort: "great",
      notes: "Reps held together to the end.",
      createdAt: stamp(richDate),
      updatedAt: stamp(richDate),
      source: "intervals",
      externalSource: {
        provider: "intervals",
        activityId: QA_RICH_PROFILE_ACTIVITY_ID,
        sourceUpdatedAt: stamp(richDate),
        importedAt: stamp(richDate),
      },
      importedMetrics: {
        averageHeartRate: 147,
        maxHeartRate: 171,
        // Present, and expected to move into the profile rather than the grid.
        averageCadence: 79,
        elevationGainFeet: 214,
        elapsedTimeSeconds: 3110,
        trainingLoad: 74,
        hrZoneSeconds: zoneSeconds(2980, 0.61),
      },
    },
    {
      id: "qa-run-detail-aggregate",
      workoutId: null,
      completedDate: aggregateDate,
      activityType: "easy",
      distanceMiles: 4.1,
      durationSeconds: 2440,
      effort: "solid",
      notes: "",
      createdAt: stamp(aggregateDate),
      updatedAt: stamp(aggregateDate),
      source: "intervals",
      externalSource: {
        provider: "intervals",
        activityId: QA_AGGREGATE_ONLY_ACTIVITY_ID,
        sourceUpdatedAt: stamp(aggregateDate),
        importedAt: stamp(aggregateDate),
      },
      importedMetrics: {
        averageHeartRate: 141,
        maxHeartRate: 158,
        // No stream to move it into, so this one stays in the summary grid.
        averageCadence: 80,
        elevationGainFeet: 96,
        trainingLoad: 48,
        hrZoneSeconds: zoneSeconds(2440, 0.78),
      },
    },
  ];
}

/**
 * The source mirrors for the two accepted review runs, plus two historical-only
 * runs nobody has ever accepted.
 *
 * The historical aggregate-only run is deliberately the poorest row in the
 * fixture: distance and duration and nothing else. It is the one that proves a
 * detail sheet can be honest about having very little and still not look
 * broken.
 */
function reviewActivities(today: string): HistoricalActivity[] {
  const seenAt = `${today}T12:00:00.000Z`;
  const richDate = addDaysToLocalDate(today, -QA_REVIEW_DAYS_AGO.richAccepted);
  const aggregateDate = addDaysToLocalDate(today, -QA_REVIEW_DAYS_AGO.aggregateAccepted);
  const historicalRichDate = addDaysToLocalDate(today, -QA_REVIEW_DAYS_AGO.richHistorical);
  const historicalAggregateDate = addDaysToLocalDate(
    today,
    -QA_REVIEW_DAYS_AGO.aggregateHistorical,
  );
  const historicalRichSeconds = 4803;

  return [
    activity({
      sourceId: QA_RICH_PROFILE_ACTIVITY_ID,
      date: richDate,
      miles: 5.2,
      paceSecondsPerMile: 2980 / 5.2,
      averageHeartRate: 147,
      maxHeartRate: 171,
      cadence: 79,
      trainingLoad: 74,
      lowerZoneShare: 0.61,
      seenAt,
      name: "Interval Session",
    }),
    activity({
      sourceId: QA_AGGREGATE_ONLY_ACTIVITY_ID,
      date: aggregateDate,
      miles: 4.1,
      paceSecondsPerMile: 2440 / 4.1,
      averageHeartRate: 141,
      maxHeartRate: 158,
      cadence: 80,
      trainingLoad: 48,
      lowerZoneShare: 0.78,
      seenAt,
      name: "Easy Run",
    }),
    {
      provider: "intervals",
      sourceId: QA_HISTORICAL_RICH_ACTIVITY_ID,
      startDateLocal: historicalRichDate,
      startTimeLocal: `${historicalRichDate}T07:15:00`,
      sourceType: "Run",
      name: "History Long Run",
      distanceMeters: 7.4 * METERS_PER_MILE,
      movingTimeSeconds: historicalRichSeconds,
      elapsedTimeSeconds: historicalRichSeconds + 140,
      averageHeartRate: 138,
      maxHeartRate: 159,
      hrZoneSeconds: zoneSeconds(historicalRichSeconds, 0.82),
      elevationGainMeters: 96,
      averageCadence: 78,
      trainingLoad: 96,
      sourceUpdatedAt: seenAt,
      firstSeenAt: seenAt,
      lastSeenAt: seenAt,
      reconciledAt: null,
    },
    {
      provider: "intervals",
      sourceId: QA_HISTORICAL_AGGREGATE_ACTIVITY_ID,
      startDateLocal: historicalAggregateDate,
      startTimeLocal: `${historicalAggregateDate}T18:40:00`,
      sourceType: "Run",
      name: "History Shakeout",
      distanceMeters: 3.4 * METERS_PER_MILE,
      movingTimeSeconds: 2077,
      elapsedTimeSeconds: null,
      // Nothing else was measured. Every one of these has to disappear from
      // the sheet rather than arrive as a zero.
      averageHeartRate: null,
      maxHeartRate: null,
      hrZoneSeconds: null,
      elevationGainMeters: null,
      averageCadence: null,
      trainingLoad: null,
      sourceUpdatedAt: seenAt,
      firstSeenAt: seenAt,
      lastSeenAt: seenAt,
      reconciledAt: null,
    },
  ];
}

function placementsFor(runLogs: readonly RunLog[]): BlockPlacement[] {
  const placements: BlockPlacement[] = [];
  const ordered = [...runLogs].sort(
    (a, b) => a.completedDate.localeCompare(b.completedDate) || a.id.localeCompare(b.id),
  );

  // Keep the newest earned block pending so the Build review always has an action.
  for (const run of ordered.slice(0, -1)) {
    const footprint = footprintFor(run);
    const option = autoPlaceOption(
      placementOptions(footprint.width, footprint.height, placements),
    );
    if (!option) continue;
    placements.push({
      runLogId: run.id,
      row: option.row,
      columnStart: option.columnStart,
      width: footprint.width,
      height: footprint.height,
      placedAt: `${run.completedDate}T18:00:00.000Z`,
    });
  }
  return placements;
}

function planActivities(runLogs: readonly RunLog[], today: string): HistoricalActivity[] {
  const seenAt = `${today}T12:00:00.000Z`;
  return runLogs.flatMap((run, index) => {
    const sourceId = run.externalSource?.activityId;
    if (!sourceId) return [];
    return [
      activity({
        sourceId,
        date: run.completedDate,
        miles: run.distanceMiles,
        paceSecondsPerMile: run.durationSeconds / run.distanceMiles,
        averageHeartRate: run.importedMetrics?.averageHeartRate ?? 145,
        maxHeartRate: run.importedMetrics?.maxHeartRate ?? 166,
        cadence: run.importedMetrics?.averageCadence ?? 80,
        trainingLoad: run.importedMetrics?.trainingLoad ?? 45,
        lowerZoneShare: 0.72,
        seenAt,
        name: index % 3 === 0 ? "Morning Run" : "Training Run",
      }),
    ];
  });
}

function backgroundActivities(today: string): HistoricalActivity[] {
  const seenAt = `${today}T12:00:00.000Z`;
  const result: HistoricalActivity[] = [];

  for (let weeksAgo = 0; weeksAgo < 52; weeksAgo += 1) {
    const current = weeksAgo < 4;
    const baseline = weeksAgo >= 4 && weeksAgo < 8;
    const offsets = current ? [1, 3, 5, 6] : [1, 3, 6];

    offsets.forEach((dayOffset, runIndex) => {
      const date = addDaysToLocalDate(today, -(weeksAgo * 7 + dayOffset));
      const longSlot = runIndex === offsets.length - 1;
      const miles = current
        ? longSlot
          ? 9.5 - weeksAgo * 0.25
          : 3.5 + runIndex * 0.9
        : baseline
          ? longSlot
            ? 6.5 + (7 - weeksAgo) * 0.15
            : 3 + runIndex * 0.7
          : longSlot
            ? 5.5 + (weeksAgo % 6) * 0.35
            : 3 + ((weeksAgo + runIndex) % 4) * 0.45;
      const lowerZoneShare =
        (weeksAgo + runIndex) % 5 === 0
          ? null
          : current
            ? 0.76
            : baseline
              ? 0.54
              : 0.66;
      const calculatedTrainingLoad = current
        ? 46 + runIndex * 9
        : baseline
          ? 34 + runIndex * 7
          : 36 + (weeksAgo % 8) * 2 + runIndex * 4;
      const trainingLoad =
        (weeksAgo + runIndex) % 4 === 0 ? null : calculatedTrainingLoad;

      result.push(
        activity({
          sourceId: `qa-history-${weeksAgo}-${runIndex}`,
          date,
          miles,
          paceSecondsPerMile: current ? 575 + runIndex * 8 : baseline ? 615 + runIndex * 8 : 600,
          averageHeartRate: current ? 143 + runIndex : baseline ? 148 + runIndex : 146,
          maxHeartRate: current ? 164 + runIndex * 2 : baseline ? 169 + runIndex * 2 : 168,
          cadence: 79 + (runIndex % 3),
          trainingLoad,
          lowerZoneShare,
          hasElevationGain: (weeksAgo + runIndex) % 3 !== 0,
          seenAt,
          name: longSlot ? "Long Run" : runIndex === 1 ? "Steady Run" : "Easy Run",
        }),
      );
    });
  }

  return result;
}

export function createQaRunnerAppState(
  today: string,
  lifecycle: QaPlanLifecycle = "active",
): AppState {
  const plan = shiftedPlan(today, lifecycle);
  const runLogs = [...planRunLogs(plan, today), ...reviewRunLogs(today)];
  const initial = createInitialAppState();
  return {
    ...initial,
    plan,
    runLogs,
    blockPlacements: placementsFor(runLogs),
    intervalsSync: {
      lastSuccessfulActivitySyncAt: `${today}T12:00:00.000Z`,
      ignoredActivityIds: [],
    },
  };
}

export function qaRunnerHistoricalActivities(
  today: string,
  lifecycle: QaPlanLifecycle = "active",
): HistoricalActivity[] {
  // The plan runs' mirrors are generated from the plan runs alone: the review
  // runs below bring their own, with the metrics their detail state needs.
  const planRuns = planRunLogs(shiftedPlan(today, lifecycle), today);
  return [
    ...backgroundActivities(today),
    ...planActivities(planRuns, today),
    ...reviewActivities(today),
  ].sort(
    (a, b) =>
      b.startDateLocal.localeCompare(a.startDateLocal) ||
      (b.startTimeLocal ?? "").localeCompare(a.startTimeLocal ?? "") ||
      b.sourceId.localeCompare(a.sourceId),
  );
}
