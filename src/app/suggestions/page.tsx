import Link from "next/link";
import { getAdaptSuggestions } from "@/lib/queries";
import { formatDate } from "@/lib/date";
import { explainSuggestion } from "@/lib/analyze/overload";
import SuggestionCard from "./SuggestionCard";

export default async function SuggestionsPage() {
  const suggestions = await getAdaptSuggestions();

  return (
    <main className="px-4 pt-6">
      <Link href="/" className="mb-1 inline-block text-sm text-neutral-500">
        ← Today
      </Link>
      <h1 className="mb-1 text-xl font-bold">Suggestions</h1>
      <p className="mb-4 text-sm text-neutral-400">
        Weight changes for your next planned sessions, worked out from what you logged. Nothing changes unless you
        accept.
      </p>

      {suggestions.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No suggestions right now. They appear when an exercise planned in the next two weeks has a target (sets ×
          reps) and your last session of it either hit every rep or has stalled.
        </p>
      ) : (
        <ul className="flex flex-col gap-3 pb-6">
          {suggestions.map((s) => (
            <li key={s.plannedExerciseId}>
              <SuggestionCard
                plannedExerciseId={s.plannedExerciseId}
                exerciseName={s.exerciseName}
                planLabel={`${formatDate(s.planDate)}${s.planTitle ? ` · ${s.planTitle}` : ""}`}
                planHref={`/schedule/${s.planDate}`}
                kind={s.suggestion.kind}
                change={`${s.suggestion.currentWeight} → ${s.suggestion.proposedWeight} ${s.suggestion.unit}`}
                reason={explainSuggestion(s.suggestion, formatDate)}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
