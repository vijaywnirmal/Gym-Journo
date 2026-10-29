// "Swap" in the logger: other exercises that do the same job as the current one, for when the
// equipment is taken. Candidates come from similar_exercises (migration 0042: muscle groups that
// overlap by at least two thirds). Pure.

import { usable, type UsualExercise } from "@/lib/quickWorkouts";

export type SwapCandidate = { id: string; name: string; equipment: string | null; muscles: string[]; exact: boolean };
export type SwapOption = { id: string; name: string; equipment: string | null };

export const MAX_SWAP_OPTIONS = 6;
// With at least this many exact matches (the same muscle groups), partial ones aren't offered: a
// shoulder press overlaps a bench press, but isn't what someone swapping a bench press wants.
const ENOUGH_EXACT = 3;

// The person's usual exercises first (most done first), then exact matches, then by name. Leaves out
// what's already in the workout and equipment that isn't available where they train.
export function rankSwapOptions(
  candidates: SwapCandidate[],
  usual: UsualExercise[],
  available: ReadonlySet<string> | null,
  excludeIds: ReadonlySet<string>
): SwapOption[] {
  const usualRank = new Map(usual.map((u, i) => [u.id, i]));
  const eligible = candidates.filter((c) => !excludeIds.has(c.id) && usable(c.equipment, available));
  const exactCount = eligible.filter((c) => c.exact).length;
  const offered = exactCount >= ENOUGH_EXACT ? eligible.filter((c) => c.exact) : eligible;

  const rank = (c: SwapCandidate) => usualRank.get(c.id) ?? Infinity;
  return offered
    .sort((a, b) => rank(a) - rank(b) || Number(b.exact) - Number(a.exact) || a.name.localeCompare(b.name))
    .slice(0, MAX_SWAP_OPTIONS)
    .map((c) => ({ id: c.id, name: c.name, equipment: c.equipment }));
}
