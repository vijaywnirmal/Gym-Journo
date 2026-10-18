"use client";

import type { ExerciseListItem } from "@/lib/exerciseLibrary";
import ExerciseLibraryBrowser from "@/components/exercise-library/ExerciseLibraryBrowser";
import Icon from "@/components/Icon";

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
    <section className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Add exercise</h2>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close"
          className="grid size-8 place-items-center rounded-lg text-label-2 hover:bg-fill"
        >
          <Icon name="close" className="size-4" strokeWidth={2.25} />
        </button>
      </div>
      <ExerciseLibraryBrowser
        autoFocus
        resultsClassName="max-h-[22rem] overflow-y-auto overscroll-contain"
        renderExercise={(exercise) => {
          const added = alreadyAdded.has(exercise.id);
          return (
            <button
              type="button"
              disabled={added}
              onClick={() => onAdd(exercise)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left enabled:hover:bg-fill"
            >
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-sm font-medium ${added ? "text-label-3" : ""}`}>
                  {exercise.name}
                </span>
                {exercise.equipment && <span className="block truncate text-xs text-label-3">{exercise.equipment}</span>}
              </span>
              {added ? (
                <span className="flex items-center gap-1 text-xs font-medium text-label-3">
                  <Icon name="checkmark" className="size-3.5" strokeWidth={2.5} />
                  Added
                </span>
              ) : (
                <span className="grid size-7 place-items-center rounded-md bg-accent/10 text-link" aria-hidden>
                  <Icon name="plus" className="size-4" strokeWidth={2.5} />
                </span>
              )}
            </button>
          );
        }}
      />
    </section>
  );
}
