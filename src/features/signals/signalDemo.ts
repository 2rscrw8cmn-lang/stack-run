import { addDaysToLocalDate } from "../../domain/dates.js";
import { compareRunnerRuns, type RunnerRun } from "../../history/runnerRun.js";

interface SignalDemoLocation {
  hostname: string;
  search: string;
}

/**
 * The signal demo is deliberately unavailable on a production/custom hostname.
 *
 * Vercel branch previews have isolated localStorage, so an owner opening a new
 * preview on a phone does not inherit the device-local Intervals credential or
 * historical mirror from another hostname. `?demo=signals` exists only to make
 * the NEXT-3 presentation reviewable in that environment; it is not a data
 * import path and it never writes anything.
 */
export function isSignalDemoEnabled(location?: SignalDemoLocation | null): boolean {
  const current =
    location ?? (typeof window === "undefined" ? null : window.location);
  if (!current) return false;

  const hostname = current.hostname.toLowerCase();
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
  const isVercelBranchPreview =
    hostname.endsWith(".vercel.app") && hostname.includes("-git-");

  return (
    (isLocal || isVercelBranchPreview) &&
    new URLSearchParams(current.search).get("demo") === "signals"
  );
}

interface DemoRunInput {
  id: string;
  date: string;
  miles: number;
  trainingLoad: number;
  hrZoneSeconds: number[];
}

function demoRun({
  id,
  date,
  miles,
  trainingLoad,
  hrZoneSeconds,
}: DemoRunInput): RunnerRun {
  const durationSeconds = Math.round(miles * 10 * 60);
  return {
    id: `demo:signals:${id}`,
    date,
    startTimeLocal: null,
    distanceMiles: miles,
    durationSeconds,
    paceSecondsPerMile: 10 * 60,
    averageHeartRate: 144,
    maxHeartRate: 166,
    hrZoneSeconds: [...hrZoneSeconds],
    elevationGainFeet: Math.round(miles * 55),
    averageCadence: 80,
    trainingLoad,
    sourceName: "Signal demo run",
    sourceType: "Run",
    externalActivityId: `demo-signals-${id}`,
    origin: "historical-activity",
    isReconciled: false,
    stack: null,
  };
}

/**
 * Fake review history that intentionally makes every historical NEXT-3 family
 * presentable through the real domain rules.
 *
 * It covers both 28-day comparison windows plus one older anchor, contains no
 * STACK overlay, and is returned only in memory. Current training is busier,
 * longer, higher-load and weighted more toward zones 1-2 so the owner can review
 * real card copy, ordering and detail sheets instead of mocked card objects.
 */
export function signalDemoRuns(today: string): RunnerRun[] {
  const baselineZones = [150, 350, 300, 150, 50, 0, 0];
  const currentZones = [300, 450, 150, 75, 25, 0, 0];

  const baseline = [
    { offset: -55, miles: 2.5 },
    { offset: -51, miles: 3 },
    { offset: -47, miles: 3.25 },
    { offset: -43, miles: 3.5 },
    { offset: -39, miles: 4 },
    { offset: -35, miles: 4.25 },
    { offset: -31, miles: 5 },
    { offset: -28, miles: 9 },
  ].map(({ offset, miles }, index) =>
    demoRun({
      id: `baseline-${index + 1}`,
      date: addDaysToLocalDate(today, offset),
      miles,
      trainingLoad: 38,
      hrZoneSeconds: baselineZones,
    }),
  );

  const current = [
    { offset: -27, miles: 3 },
    { offset: -24, miles: 3.25 },
    { offset: -21, miles: 3.5 },
    { offset: -18, miles: 3.75 },
    { offset: -15, miles: 4 },
    { offset: -12, miles: 4.25 },
    { offset: -9, miles: 4.5 },
    { offset: -6, miles: 5 },
    { offset: -3, miles: 6 },
    { offset: 0, miles: 12 },
  ].map(({ offset, miles }, index) =>
    demoRun({
      id: `current-${index + 1}`,
      date: addDaysToLocalDate(today, offset),
      miles,
      trainingLoad: 55,
      hrZoneSeconds: currentZones,
    }),
  );

  const anchor = demoRun({
    id: "history-anchor",
    date: addDaysToLocalDate(today, -56),
    miles: 3,
    trainingLoad: 35,
    hrZoneSeconds: baselineZones,
  });

  return [...current, ...baseline, anchor].sort(compareRunnerRuns);
}
