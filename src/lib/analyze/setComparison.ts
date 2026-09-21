// Pure set-vs-set arithmetic shared by the logger's "vs. last time" comparison (Phase 11) and the
// exercise History's session-to-session comparison (R2-S2). Purely descriptive: it reports the
// difference between two recorded values and never judges it.
//
// Weight is only compared when both sets share a unit — kg and lb are never converted. A missing
// value on either side makes that one value unavailable without affecting the other.

export type ValueComparison =
  | { type: "delta"; delta: number; unit?: string }
  | { type: "same" }
  | { type: "unavailable" };

export type SetComparison = { weight: ValueComparison; reps: ValueComparison };

export type ComparableSet = { reps: number | null; weight: number | null; weightUnit: string };

export function compareWeight(
  currentWeight: number | null,
  currentUnit: string,
  previousWeight: number | null,
  previousUnit: string
): ValueComparison {
  if (currentWeight === null || previousWeight === null) return { type: "unavailable" };
  if (currentUnit !== previousUnit) return { type: "unavailable" };
  const delta = currentWeight - previousWeight;
  if (delta === 0) return { type: "same" };
  return { type: "delta", delta, unit: currentUnit };
}

export function compareReps(currentReps: number | null, previousReps: number | null): ValueComparison {
  if (currentReps === null || previousReps === null) return { type: "unavailable" };
  const delta = currentReps - previousReps;
  if (delta === 0) return { type: "same" };
  return { type: "delta", delta };
}

export function compareSet(current: ComparableSet, previous: ComparableSet): SetComparison {
  return {
    weight: compareWeight(current.weight, current.weightUnit, previous.weight, previous.weightUnit),
    reps: compareReps(current.reps, previous.reps),
  };
}
