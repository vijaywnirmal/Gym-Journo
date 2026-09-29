"use client";

import type { ExerciseListItem } from "@/lib/exerciseLibrary";
import ExerciseLibraryBrowser from "@/components/exercise-library/ExerciseLibraryBrowser";

// Browse or search the library and add an exercise to this session's log. Adding takes effect
// immediately (there's no separate "apply" step during a workout), unlike the schedule picker.
export default function LogExercisePicker({
  alreadyAdded,
  onAdd,
  onCancel,
}: {
  alreadyAdded: Set<string>;
  onAdd: (exercise: ExerciseListItem) => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
      <ExerciseLibraryBrowser
        autoFocus
        resultsClassName="max-h-80 overflow-y-auto"
        renderExercise={(exercise) => {
          const added = alreadyAdded.has(exercise.id);
          return (
            <button
              type="button"
              disabled={added}
              onClick={() => onAdd(exercise)}
              className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm text-neutral-100 disabled:opacity-40"
            >
              {exercise.name}
              <span className="text-xs text-neutral-500">{added ? "Added" : "+ Add"}</span>
            </button>
          );
        }}
      />

      <button
        type="button"
        onClick={onCancel}
        className="mt-3 w-full rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300"
      >
        Cancel
      </button>
    </div>
  );
}
