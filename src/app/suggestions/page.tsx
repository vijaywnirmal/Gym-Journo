import type { Metadata } from "next";
import { getAdaptSuggestions } from "@/lib/queries";
import { formatDate } from "@/lib/date";
import { explainSuggestion } from "@/lib/analyze/overload";
import SuggestionCard from "./SuggestionCard";
import PageHeader from "@/components/PageHeader";

export const metadata: Metadata = { title: "Weight suggestions" };

export default async function SuggestionsPage() {
  const suggestions = await getAdaptSuggestions();

  return (
    <main className="px-4 pt-6 md:px-8 md:pt-10">
      <PageHeader
        title="Weight suggestions"
        subtitle="Changes for your next planned sessions, worked out from what you logged. Nothing changes unless you accept."
        back={{ href: "/", label: "Today" }}
      />

      {suggestions.length === 0 ? (
        <p className="card px-5 py-6 text-sm text-label-2">
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
