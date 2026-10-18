import { differenceInCalendarDays, parseISO } from "date-fns";
import { DELOAD_FACTOR, roundToStep, WEIGHT_STEP } from "./overload";

// Coming back after a break. Pure.
//
// After COMEBACK_GAP_DAYS or more without a workout, Today offers a lighter version of the day's
// plan: about two thirds of the planned sets, and "Same as last time" filled at the Adapt deload
// weight (~90%, rounded to a 2.5 kg / 5 lb step). It's a starting point — every value stays
// editable, and nothing about the plan itself changes.

export const COMEBACK_GAP_DAYS = 7;
const LIGHTER_SET_FRACTION = 2 / 3;

// Days since the last workout when that's a comeback, else null (no workout yet, or a short gap).
export function comebackGapDays(lastWorkoutDate: string | null, todayStr: string): number | null {
  if (!lastWorkoutDate) return null;
  const days = differenceInCalendarDays(parseISO(todayStr), parseISO(lastWorkoutDate));
  return days >= COMEBACK_GAP_DAYS ? days : null;
}

// Planned sets for a lighter session: about two thirds, never below one.
export function lighterSetCount(plannedSets: number): number {
  return Math.max(1, Math.round(plannedSets * LIGHTER_SET_FRACTION));
}

// A lighter working weight, rounded to the unit's plate step and never heavier than the original.
// Unknown units are scaled and rounded to 0.5.
export function lighterWeight(weight: number, unit: string): number {
  const step = unit === "kg" || unit === "lb" ? WEIGHT_STEP[unit] : 0.5;
  const rounded = roundToStep(weight * DELOAD_FACTOR, step);
  return Math.max(0, Math.min(weight, rounded));
}

// Sets copied from last time, cut to a lighter session: fewer sets, lighter weights. Blank
// weights stay blank.
export function lighterSets<T extends { weight: string; weightUnit: string }>(sets: T[]): T[] {
  return sets.slice(0, lighterSetCount(sets.length)).map((set) => {
    const weight = parseFloat(set.weight);
    return Number.isFinite(weight) ? { ...set, weight: String(lighterWeight(weight, set.weightUnit)) } : set;
  });
}
