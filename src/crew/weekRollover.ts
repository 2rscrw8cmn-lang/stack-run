/**
 * Crew weekly rollover clock.
 *
 * Weekly Crew results are intentionally anchored to Eastern Time so the recap
 * and Special Blocks cannot disagree just because Supabase evaluates
 * `current_date` in UTC. The product rollover is Monday at 06:00 ET.
 */
export const CREW_WEEK_TIME_ZONE = "America/New_York";
export const CREW_WEEK_ROLLOVER_HOUR = 6;

type CrewWeekClock = {
  localDate: string;
  isoWeekday: number;
  hour: number;
};

const WEEKDAY: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

const CREW_WEEK_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: CREW_WEEK_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
  hour: "2-digit",
  hourCycle: "h23",
});

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((item) => item.type === type)?.value ?? "";
}

export function crewWeekClock(now: Date): CrewWeekClock {
  if (Number.isNaN(now.getTime())) throw new Error("Invalid Crew week clock date.");

  const parts = CREW_WEEK_FORMATTER.formatToParts(now);
  const year = part(parts, "year");
  const month = part(parts, "month");
  const day = part(parts, "day");
  const weekday = WEEKDAY[part(parts, "weekday")];
  const hour = Number(part(parts, "hour"));

  if (!year || !month || !day || !weekday || !Number.isInteger(hour)) {
    throw new Error("Crew week clock could not be resolved.");
  }

  return {
    localDate: `${year}-${month}-${day}`,
    isoWeekday: weekday,
    hour,
  };
}

/** The recap for the just-closed week stays hidden until Monday 06:00 ET. */
export function isCrewRecapReleaseOpen(now: Date = new Date()): boolean {
  const clock = crewWeekClock(now);
  return clock.isoWeekday !== 1 || clock.hour >= CREW_WEEK_ROLLOVER_HOUR;
}

/**
 * Whether it is safe for the browser to call the current award finalizer.
 *
 * `finalize_crew_awards` still derives its latest week from the database's UTC
 * `current_date`. During the Sunday-evening UTC rollover, that date is already
 * Monday even though the Crew week has not closed in New York. We therefore
 * suppress only that unsafe Sunday window plus Monday before 06:00 ET. Older
 * awards remain readable because the caller still performs the normal SELECT.
 */
export function isCrewAwardFinalizationSafe(now: Date = new Date()): boolean {
  const clock = crewWeekClock(now);

  if (clock.isoWeekday === 1 && clock.hour < CREW_WEEK_ROLLOVER_HOUR) return false;

  const utcIsoWeekday = now.getUTCDay() === 0 ? 7 : now.getUTCDay();
  if (clock.isoWeekday === 7 && utcIsoWeekday === 1) return false;

  return true;
}
