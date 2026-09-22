// Differences said in words, so Coach never has to turn a signed number ("-5") into language itself.
// A signed figure reads as arithmetic ("-5 days relative to your target"), and a model can get its
// direction wrong; a ready-made phrase is unambiguous and the direction is decided here, in code.
// Purely descriptive — no direction is presented as good or bad.

// Up to two decimals, without trailing zeros, and never a sign.
const magnitude = (n: number) => String(Number(Math.abs(n).toFixed(2)));
const isZero = (n: number) => Number(Math.abs(n).toFixed(2)) === 0;

// performed − target, for a completed week.
export function workoutDaysVersusTarget(difference: number): string {
  if (isZero(difference)) return "the same number of workout days as the target";
  const days = magnitude(difference);
  const more = difference > 0;
  return `${days} ${more ? "more" : "fewer"} workout ${days === "1" ? "day" : "days"} than the target`;
}

// latest − target weight.
export function weightVersusTarget(distanceKg: number): string {
  if (isZero(distanceKg)) return "at the target weight";
  return `${magnitude(distanceKg)} kg ${distanceKg > 0 ? "above" : "below"} the target weight`;
}

// latest − earliest weight.
export function weightVersusEarliest(changeKg: number): string {
  if (isZero(changeKg)) return "the same as the earliest recorded weight";
  return `${magnitude(changeKg)} kg ${changeKg > 0 ? "higher" : "lower"} than the earliest recorded weight`;
}
