import { formatSetDetail } from "@/lib/setData";
import type { PerformedSet } from "@/lib/analyze/exerciseSessions";
import type { SetComparison, ValueComparison } from "@/lib/analyze/setComparison";

// Purely descriptive wording for the exercise History. It states recorded values and arithmetic
// differences — never whether a change is good, bad, progress or decline.

// Same "weight × reps" rendering History has always used; a missing value stays "?" rather than
// being invented.
export function formatPerformedSet(set: PerformedSet): string {
  const detail = formatSetDetail(set.setType, null);
  return `${set.weight ?? "?"}${set.weightUnit} × ${set.reps ?? "?"}${detail ? ` (${detail})` : ""}`;
}

// Rounded so binary floating point (e.g. 0.1 + 0.2) never leaks into the display.
function magnitude(delta: number): number {
  return Number(Math.abs(delta).toFixed(2));
}

function weightChange(c: ValueComparison): string | null {
  if (c.type === "unavailable") return null;
  if (c.type === "same") return "same weight";
  return `${c.delta > 0 ? "+" : "−"}${magnitude(c.delta)} ${c.unit}`;
}

function repsChange(c: ValueComparison): string | null {
  if (c.type === "unavailable") return null;
  if (c.type === "same") return "same reps";
  const n = magnitude(c.delta);
  return `${c.delta > 0 ? "+" : "−"}${n} rep${n === 1 ? "" : "s"}`;
}

// The change against the same-numbered set in the previous performed session. Null when there is
// no matching set, or when neither value is comparable (missing values, or a different unit —
// weights in kg and lb are never converted).
export function formatSetChange(comparison: SetComparison | null): string | null {
  if (comparison === null) return null;
  const parts = [weightChange(comparison.weight), repsChange(comparison.reps)].filter(
    (p): p is string => p !== null
  );
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function formatDaysSincePrevious(days: number | null): string | null {
  if (days === null) return null;
  return `${days} day${days === 1 ? "" : "s"} since previous performed session`;
}
