import { format, addDays, parseISO, differenceInYears, differenceInCalendarDays } from "date-fns";

export const DATE_FMT = "yyyy-MM-dd";

// The server's own local date. This is only the fallback for a person whose timezone isn't known
// yet — anything that means "the person's today" goes through `getToday()` (src/lib/userDate.ts),
// which reads their stored timezone and calls `todayIn`.
export function today(): string {
  return format(new Date(), DATE_FMT);
}

export function isValidTimeZone(timeZone: string): boolean {
  if (typeof timeZone !== "string" || timeZone.trim() === "") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

// The wall-clock parts of an instant in an IANA timezone.
function zonedParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

// The calendar date (yyyy-MM-dd) it is right now in the given IANA timezone. A missing or invalid
// timezone falls back to the server's local date rather than throwing.
export function todayIn(timeZone: string | null | undefined, now: Date = new Date()): string {
  if (!timeZone || !isValidTimeZone(timeZone)) return format(now, DATE_FMT);
  const { year, month, day } = zonedParts(now, timeZone);
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// The hour of the day (0–23) right now in the given timezone; the server's local hour as fallback.
export function hourIn(timeZone: string | null | undefined, now: Date = new Date()): number {
  if (!timeZone || !isValidTimeZone(timeZone)) return now.getHours();
  return zonedParts(now, timeZone).hour;
}

// The instant that local midnight of `date` (yyyy-MM-dd) begins in the given timezone — for
// "since the start of your day" queries against timestamps. Two passes so a DST change between the
// UTC guess and the real midnight is accounted for.
export function startOfDayIn(date: string, timeZone: string | null | undefined): Date {
  if (!timeZone || !isValidTimeZone(timeZone)) {
    const local = parseISO(date);
    local.setHours(0, 0, 0, 0);
    return local;
  }
  const [year, month, day] = date.split("-").map(Number);
  const wallClockAsUtc = Date.UTC(year, month - 1, day);
  const offsetAt = (instantMs: number) => {
    const p = zonedParts(new Date(instantMs), timeZone);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(instantMs / 1000) * 1000;
  };
  const firstGuess = wallClockAsUtc - offsetAt(wallClockAsUtc);
  return new Date(wallClockAsUtc - offsetAt(firstGuess));
}

export function calculateAge(dateOfBirth: string): number {
  return differenceInYears(new Date(), parseISO(dateOfBirth));
}

// Whole calendar days between the given date and `todayStr` — pass the person's today (see
// `getToday()`), never a UTC-derived date.
export function daysSince(date: string, todayStr: string): number {
  return differenceInCalendarDays(parseISO(todayStr), parseISO(date));
}

export function formatDate(date: string): string {
  return format(parseISO(date), "EEE, MMM d");
}

// Year included — for facts that can span years (first/last performed).
export function formatDateLong(date: string): string {
  return format(parseISO(date), "MMM d, yyyy");
}

// Whole calendar days from `earlier` to `later` (both yyyy-MM-dd) — pure, no dependence on today.
export function daysBetween(earlier: string, later: string): number {
  return differenceInCalendarDays(parseISO(later), parseISO(earlier));
}

// Deterministic date+time formatting (unlike toLocaleString, doesn't depend on server/client locale)
export function formatDateTime(isoString: string): string {
  return format(new Date(isoString), "MMM d, yyyy 'at' h:mm a");
}

export function shiftDate(date: string, days: number): string {
  return format(addDays(parseISO(date), days), DATE_FMT);
}

export function weekDates(centerDate: string): string[] {
  const d = parseISO(centerDate);
  const dayOfWeek = d.getDay(); // 0 = Sunday
  const start = addDays(d, -dayOfWeek);
  return Array.from({ length: 7 }, (_, i) => format(addDays(start, i), DATE_FMT));
}
