// How an exercise is measured (migration 0051), and the time and distance values a set can hold.
// Shared by the logger, saving, History and the trainer's view. Pure.

export const MEASURES = ["weight_reps", "time", "distance"] as const;
export type Measure = (typeof MEASURES)[number];
export const DEFAULT_MEASURE: Measure = "weight_reps";

export const MEASURE_LABEL: Record<Measure, string> = {
  weight_reps: "Weight and reps",
  time: "Time (a hold or timed set)",
  distance: "Distance and time",
};

// Unknown or missing values (old rows, old clients) read as weight and reps.
export function toMeasure(value: unknown): Measure {
  return typeof value === "string" && (MEASURES as readonly string[]).includes(value) ? (value as Measure) : DEFAULT_MEASURE;
}

export const DISTANCE_UNITS = ["km", "mi"] as const;
export type DistanceUnit = (typeof DISTANCE_UNITS)[number];

export function toDistanceUnit(value: unknown): DistanceUnit {
  return value === "mi" ? "mi" : "km";
}

// The longest a single set or entry may last, in the logger and when saving.
export const MAX_DURATION_SECONDS = 2 * 60 * 60;
export const MAX_DISTANCE = 1000;

// "90", "1:30", "1:02:30", "1.5" (minutes with a decimal is ambiguous, so not accepted) → seconds.
// Null for a blank entry; NaN for something that isn't a time.
export function parseDuration(text: string): number | null {
  const value = text.trim();
  if (!value) return null;
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  const parts = value.split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return NaN;
  const nums = parts.map((p) => parseInt(p, 10));
  // Minutes and seconds after the first part are 0–59.
  if (nums.slice(1).some((n) => n > 59)) return NaN;
  return nums.reduce((total, n) => total * 60 + n, 0);
}

// 45 → "0:45", 90 → "1:30", 3750 → "1:02:30".
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

// What's wrong with a typed time, in the logger's words, or null when it's fine (or blank).
export function durationProblem(text: string): string | null {
  const seconds = parseDuration(text);
  if (seconds === null) return null;
  if (Number.isNaN(seconds)) return "Enter a time like 45 (seconds), 1:30 or 1:02:30.";
  if (seconds > MAX_DURATION_SECONDS) return "Enter a time of 2 hours or less.";
  return null;
}

export function distanceProblem(text: string): string | null {
  if (!text.trim()) return null;
  const distance = parseFloat(text);
  if (!(distance >= 0 && distance <= MAX_DISTANCE)) return `Enter a distance between 0 and ${MAX_DISTANCE}.`;
  return null;
}

// "5 km", "3.1 mi". Up to two decimals, trailing zeros dropped.
export function formatDistance(distance: number, unit: string): string {
  return `${Number(distance.toFixed(2))} ${toDistanceUnit(unit)}`;
}

// Time per km or mile, e.g. "5:42 /km". Null without both a distance and a time.
export function formatPace(distance: number | null, seconds: number | null, unit: string): string | null {
  if (!distance || !seconds || distance <= 0 || seconds <= 0) return null;
  return `${formatDuration(seconds / distance)} /${toDistanceUnit(unit)}`;
}

// One performed set in words, whatever it measures: "60kg × 8" (as the app has always written
// weights), "1:30", "5 km in 28:30".
export function formatSetValue(set: {
  reps: number | null;
  weight: number | null;
  weight_unit?: string;
  weightUnit?: string;
  duration_seconds?: number | null;
  durationSeconds?: number | null;
  distance?: number | null;
  distance_unit?: string | null;
  distanceUnit?: string | null;
}): string {
  const duration = set.duration_seconds ?? set.durationSeconds ?? null;
  const distance = set.distance ?? null;
  const distanceUnit = set.distance_unit ?? set.distanceUnit ?? "km";
  if (distance !== null) {
    const d = formatDistance(Number(distance), distanceUnit);
    return duration !== null ? `${d} in ${formatDuration(duration)}` : d;
  }
  if (duration !== null) return formatDuration(duration);
  const unit = set.weight_unit ?? set.weightUnit ?? "kg";
  return `${set.weight ?? "?"}${unit} × ${set.reps ?? "?"}`;
}
