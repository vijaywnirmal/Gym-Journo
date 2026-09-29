"use client";

import type { ReactNode } from "react";
import type { ExerciseFilters, ExerciseListItem } from "@/lib/exerciseLibrary";
import { useExercisePages } from "./hooks";

type Props = ExerciseFilters & {
  muscleGroupId?: string | null;
  renderExercise: (exercise: ExerciseListItem) => ReactNode;
};

// A paged list of exercises: the first page on mount, then "Load more" for each next page. Key it
// by its parameters so a change starts again from the first page.
export default function ExercisePageList({ muscleGroupId, term, equipment, renderExercise }: Props) {
  const { items, hasMore, status, loadMore, retry } = useExercisePages({ muscleGroupId, term, equipment });
  const loadingFirstPage = status === "loading" && items.length === 0;

  return (
    <div className="flex flex-col gap-2" aria-busy={status === "loading"}>
      {items.length > 0 && (
        <ul className="flex flex-col gap-1">
          {items.map((exercise) => (
            <li key={exercise.id}>{renderExercise(exercise)}</li>
          ))}
        </ul>
      )}

      <div aria-live="polite" className="text-xs text-neutral-500">
        {loadingFirstPage && <p>Loading exercises…</p>}
        {status === "ready" && items.length === 0 && <p>No exercises match.</p>}
        {status === "error" && (
          <p className="text-red-400">
            Couldn&apos;t load exercises.{" "}
            <button type="button" onClick={retry} className="underline">
              Try again
            </button>
          </p>
        )}
      </div>

      {hasMore && status !== "error" && (
        <button
          type="button"
          onClick={loadMore}
          disabled={status === "loading"}
          className="self-start rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 disabled:opacity-50"
        >
          {status === "loading" ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
