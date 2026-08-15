const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseLocalDate(dateString: string): Date {
  const match = LOCAL_DATE_PATTERN.exec(dateString);
  if (!match) {
    throw new Error(`Invalid local date string: ${dateString}`);
  }
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayLocalDate(): string {
  return formatLocalDate(new Date());
}

export function compareLocalDates(a: string, b: string): number {
  return parseLocalDate(a).getTime() - parseLocalDate(b).getTime();
}

export function isBeforeLocalDate(a: string, b: string): boolean {
  return compareLocalDates(a, b) < 0;
}

export function isAfterLocalDate(a: string, b: string): boolean {
  return compareLocalDates(a, b) > 0;
}

export function isSameLocalDate(a: string, b: string): boolean {
  return compareLocalDates(a, b) === 0;
}

export function addDaysToLocalDate(dateString: string, days: number): string {
  const date = parseLocalDate(dateString);
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}

/**
 * The Monday of the calendar week containing this date.
 *
 * One definition of "a week" for the whole product. Training Signals has used
 * Monday-start weeks since Trends 2.0, so the runner history built on top of the
 * same runs has to agree with it or the two would report different weekly
 * mileage for the same seven days.
 */
export function mondayOfLocalDate(dateString: string): string {
  const date = parseLocalDate(dateString);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return formatLocalDate(date);
}

export function daysBetweenLocalDates(from: string, to: string): number {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.round(
    (parseLocalDate(to).getTime() - parseLocalDate(from).getTime()) /
      millisecondsPerDay,
  );
}

export function formatDateLabel(
  dateString: string,
  options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
  },
  locale = "en-US",
): string {
  return new Intl.DateTimeFormat(locale, options).format(
    parseLocalDate(dateString),
  );
}

/** Compact product status for meaningfully stale data. */
export function formatUpdatedAgo(timestamp: string, now = Date.now()): string | null {
  const updated = new Date(timestamp).getTime();
  if (!Number.isFinite(updated)) return null;
  const minutes = Math.max(1, Math.floor(Math.max(0, now - updated) / 60_000));
  if (minutes < 60) return `Updated ${minutes}m ago`;
  if (minutes < 24 * 60) return `Updated ${Math.floor(minutes / 60)}h ago`;
  return `Updated ${Math.floor(minutes / (24 * 60))}d ago`;
}
