import { formatDateLong } from "@/lib/date";
import { distanceToTargetKg, type BodyWeightFacts } from "@/lib/analyze/bodyWeight";
import { formatDeltaKg, formatWeightKg } from "./BodyProgressSummary";

// Factual, dated wording for the body-weight facts. Values use the existing one-decimal kg
// formatting; signed numbers are raw arithmetic (latest − earliest, latest − target) with no
// suggestion that either direction is desirable.

export type BodyWeightLines = {
  latestLine: string;
  earliestLine: string | null;
  changeLine: string | null;
  targetLine: string | null;
  distanceLine: string | null;
};

export function buildBodyWeightLines(
  facts: BodyWeightFacts,
  targetWeightKg: number | null
): BodyWeightLines {
  const hasComparison = facts.changeKg !== null;
  return {
    latestLine: `Latest: ${formatWeightKg(facts.latest.weightKg)} · ${formatDateLong(facts.latest.date)}`,
    // With a single measurement the earliest and latest are the same record — say it once.
    earliestLine: hasComparison
      ? `Earliest: ${formatWeightKg(facts.earliest.weightKg)} · ${formatDateLong(facts.earliest.date)}`
      : null,
    changeLine: facts.changeKg !== null ? `Change: ${formatDeltaKg(facts.changeKg)}` : null,
    targetLine: targetWeightKg !== null ? `Target: ${formatWeightKg(targetWeightKg)}` : null,
    distanceLine:
      targetWeightKg !== null
        ? `Distance to target: ${formatDeltaKg(distanceToTargetKg(facts.latest.weightKg, targetWeightKg))}`
        : null,
  };
}
