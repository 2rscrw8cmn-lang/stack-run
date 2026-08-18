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

/**
 * Public synthetic review credentials. They unlock no real runner data and are
 * deliberately useful only on localhost / Vercel branch previews.
 */
export const QA_RUNNER_EMAIL = "stack.qa.runner@example.com";
export const QA_RUNNER_PIN = "42424242";
export const QA_RUNNER_DISPLAY_NAME = "QA Runner";

/** The seed plan's second Sunday. We shift the whole plan so this day is today. */
const QA_PLAN_ANCHOR_DATE = "2026-08-16";
const METERS_PER_MILE = 1609.344;

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

function shiftedPlan(today: string): TrainingPlan {
  const source = loadSeedPlan();
  const delta = daysBetweenLocalDates(QA_PLAN_ANCHOR_DATE, today);
  return {
    ...source,
    id: "stack-qa-runner-plan",
    name: "QA Half Marathon Build",
    race: {
      ...source.race,
      name: "QA Half Marathon",
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

export function createQaRunnerAppState(today: string): AppState {
  const plan = shiftedPlan(today);
  const runLogs = planRunLogs(plan, today);
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

export function qaRunnerHistoricalActivities(today: string): HistoricalActivity[] {
  const state = createQaRunnerAppState(today);
  return [...backgroundActivities(today), ...planActivities(state.runLogs, today)].sort(
    (a, b) =>
      b.startDateLocal.localeCompare(a.startDateLocal) ||
      (b.startTimeLocal ?? "").localeCompare(a.startTimeLocal ?? "") ||
      b.sourceId.localeCompare(a.sourceId),
  );
}
