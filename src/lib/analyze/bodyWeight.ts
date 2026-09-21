import { today } from "@/lib/date";

// Dated body-weight facts over the full measurement history. Purely descriptive: it reports which
// recorded weights were earliest and latest, their raw difference, and (given a stated target) the
// signed distance from the latest weight to it. It never says whether a change is good, bad, or
// progress in either direction.
//
// Existing data semantics apply: body_measurements holds one row per user per date (an edit
// replaces that date's row), and a measurement can't legitimately be dated in the future — any
// that exist are ignored rather than treated as the current weight, judged against `todayStr` (the
// person's today — see getToday()).

export type BodyWeightPoint = { date: string; weightKg: number };

export type BodyWeightFacts = {
  measurementCount: number;
  earliest: BodyWeightPoint;
  latest: BodyWeightPoint;
  // latest − earliest; null when there is only one measurement (nothing to compare).
  changeKg: number | null;
};

type MeasurementLike = { date: string; weight_kg: number; updated_at?: string };

export function summarizeBodyWeight(
  measurements: MeasurementLike[],
  todayStr: string = today()
): BodyWeightFacts | null {
  // One entry per date. Should a date ever appear twice, the most recently updated row wins —
  // the same outcome as the upsert that normally keeps one row per date.
  const byDate = new Map<string, MeasurementLike>();
  for (const m of measurements) {
    if (m.date > todayStr) continue;
    const existing = byDate.get(m.date);
    if (!existing || (m.updated_at ?? "") >= (existing.updated_at ?? "")) byDate.set(m.date, m);
  }
  if (byDate.size === 0) return null;

  const sorted = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  return {
    measurementCount: sorted.length,
    earliest: { date: first.date, weightKg: first.weight_kg },
    latest: { date: last.date, weightKg: last.weight_kg },
    changeKg: sorted.length >= 2 ? last.weight_kg - first.weight_kg : null,
  };
}

// latest − target: positive when the latest recorded weight is above the target, negative when
// below, zero when equal. No direction is implied to be desirable.
export function distanceToTargetKg(latestKg: number, targetKg: number): number {
  return latestKg - targetKg;
}
