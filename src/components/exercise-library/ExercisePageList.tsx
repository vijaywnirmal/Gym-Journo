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
    <div aria-busy={status === "loading"}>
      {items.length > 0 && (
        <ul className="divide-y divide-separator">
          {items.map((exercise) => (
            <li key={exercise.id}>{renderExercise(exercise)}</li>
          ))}
        </ul>
      )}

      <div aria-live="polite">
        {loadingFirstPage && (
          <div className="flex flex-col gap-2 p-3" aria-label="Loading exercises">
            <div className="skeleton h-9" />
            <div className="skeleton h-9" />
            <div className="skeleton h-9" />
          </div>
        )}
        {status === "ready" && items.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-label-2">No exercises match.</p>
        )}
        {status === "error" && (
          <p className="px-4 py-4 text-sm text-red">
            Couldn&apos;t load exercises.{" "}
            <button type="button" onClick={retry} className="font-medium text-link">
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
          className="w-full border-t border-separator py-2.5 text-sm font-medium text-link hover:bg-fill disabled:opacity-50"
        >
          {status === "loading" ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
