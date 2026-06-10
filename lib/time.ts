// Single source of truth for ALL date/time logic.
// Morocco runs UTC+1 year-round and UTC+0 during Ramadan; the IANA tz database
// encodes those transitions, so everything goes through Intl with this zone —
// never numeric offsets, never SQL current_date (servers run UTC).
export const TZ = "Africa/Casablanca";

export type IsoDate = string; // 'YYYY-MM-DD'

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** Local calendar date in Casablanca, as YYYY-MM-DD. */
export function localToday(now: Date = new Date()): IsoDate {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Local weekday in Casablanca ('Mon'..'Sun'). */
export function localWeekday(now: Date = new Date()): Weekday {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
  }).format(now) as Weekday;
}

/** Local time HH:mm in Casablanca (for display). */
export function localTime(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
}

// --- Pure ISO-date arithmetic (no timezone involved once we have a local date) ---

/** Parse an ISO date as UTC noon — immune to DST edges for day arithmetic. */
function toUtcNoon(date: IsoDate): Date {
  return new Date(`${date}T12:00:00Z`);
}

export function addDays(date: IsoDate, n: number): IsoDate {
  const d = toUtcNoon(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Weekday of an ISO date ('Mon'..'Sun'). */
export function weekdayOf(date: IsoDate): Weekday {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
  }).format(toUtcNoon(date)) as Weekday;
}

export interface WeekBounds {
  /** Monday */
  start: IsoDate;
  /** Sunday */
  end: IsoDate;
}

/** The Monday-to-Sunday week containing the given local date. */
export function weekBounds(date: IsoDate): WeekBounds {
  const dayIndex = WEEKDAYS.indexOf(weekdayOf(date)); // Mon=0..Sun=6
  const start = addDays(date, -dayIndex);
  return { start, end: addDays(start, 6) };
}

/** Monday of the week before the given week start. */
export function previousWeekStart(weekStart: IsoDate): IsoDate {
  return addDays(weekStart, -7);
}

export function isSameOrBefore(a: IsoDate, b: IsoDate): boolean {
  return a <= b; // ISO dates compare lexicographically
}

/** Human-readable label, e.g. 'Mon 10 Jun'. */
export function formatDateLabel(date: IsoDate): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(toUtcNoon(date));
}
