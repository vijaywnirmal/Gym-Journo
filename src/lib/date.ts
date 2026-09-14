import { format, addDays, parseISO } from "date-fns";

export const DATE_FMT = "yyyy-MM-dd";

export function today(): string {
  return format(new Date(), DATE_FMT);
}

export function formatDate(date: string): string {
  return format(parseISO(date), "EEE, MMM d");
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
