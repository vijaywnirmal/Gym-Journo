import { format, addDays, parseISO, differenceInYears, differenceInCalendarDays } from "date-fns";

export const DATE_FMT = "yyyy-MM-dd";

export function today(): string {
  return format(new Date(), DATE_FMT);
}

export function calculateAge(dateOfBirth: string): number {
  return differenceInYears(new Date(), parseISO(dateOfBirth));
}

// Whole calendar days between the given date and today() — anchored to the same local "today"
// used everywhere else, not a UTC-derived diff.
export function daysSince(date: string): number {
  return differenceInCalendarDays(parseISO(today()), parseISO(date));
}

export function formatDate(date: string): string {
  return format(parseISO(date), "EEE, MMM d");
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
