import type { BodyWeightFacts as Facts } from "@/lib/analyze/bodyWeight";
import { buildBodyWeightLines } from "./bodyWeightLines";

// Dated body-weight facts across the full measurement history. Factual only — a raw signed change
// and a raw signed distance to the stated target, never a verdict on either.
export default function BodyWeightFacts({
  facts,
  targetWeightKg,
}: {
  facts: Facts | null;
  targetWeightKg: number | null;
}) {
  const lines = facts ? buildBodyWeightLines(facts, targetWeightKg) : null;

  return (
    <div className="rounded-xl border border-neutral-800 p-4">
      <h2 className="mb-3 text-sm font-semibold text-neutral-200">Body weight</h2>
      {lines ? (
        <div className="flex flex-col gap-1 text-sm text-neutral-300">
          <p>{lines.latestLine}</p>
          {lines.earliestLine && <p>{lines.earliestLine}</p>}
          {lines.changeLine && <p>{lines.changeLine}</p>}
          {lines.targetLine && (
            <p className="mt-2">{lines.targetLine}</p>
          )}
          {lines.distanceLine && <p>{lines.distanceLine}</p>}
        </div>
      ) : (
        <p className="text-sm text-neutral-500">No weight measurements recorded yet.</p>
      )}
    </div>
  );
}
