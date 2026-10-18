"use client";

import { useState } from "react";
import ExerciseLibraryBrowser from "@/components/exercise-library/ExerciseLibraryBrowser";
import Icon from "@/components/Icon";

export type PickedExercise = { id: string; name: string };

// Browse or search the library and tick exercises for a plan or template; nothing changes until
// the selection is confirmed.
export default function ExercisePicker({
  initiallySelected,
  onConfirm,
  onCancel,
}: {
  initiallySelected: PickedExercise[];
  onConfirm: (selected: PickedExercise[]) => void;
  onCancel: () => void;
}) {
  // Insertion-ordered, so exercises keep the order they were picked in.
  const [selected, setSelected] = useState<Map<string, string>>(
    () => new Map(initiallySelected.map((ex) => [ex.id, ex.name]))
  );

  function toggle(exercise: PickedExercise) {
    setSelected((previous) => {
      const next = new Map(previous);
      if (next.has(exercise.id)) next.delete(exercise.id);
      else next.set(exercise.id, exercise.name);
      return next;
    });
  }

  return (
    <section className="card p-4">
      <h2 className="mb-3 text-base font-semibold">Choose exercises</h2>
      <ExerciseLibraryBrowser
        autoFocus
        resultsClassName="max-h-[22rem] overflow-y-auto overscroll-contain"
        renderExercise={(exercise) => {
          const on = selected.has(exercise.id);
          return (
            <button
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => toggle(exercise)}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-fill ${on ? "bg-accent/5" : ""}`}
            >
              <span
                className={`grid size-5 shrink-0 place-items-center rounded-md border ${
                  on ? "border-transparent bg-accent text-on-accent" : "border-label-3"
                }`}
              >
                {on && <Icon name="checkmark" className="size-3.5" strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{exercise.name}</span>
                {exercise.equipment && <span className="block truncate text-xs text-label-3">{exercise.equipment}</span>}
              </span>
            </button>
          );
        }}
      />
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => onConfirm([...selected].map(([id, name]) => ({ id, name })))}
          className="h-10 flex-1 rounded-[10px] bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover"
        >
          {selected.size > 0 ? `Use ${selected.size} exercise${selected.size === 1 ? "" : "s"}` : "Done"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-10 rounded-[10px] border border-separator px-4 text-sm font-semibold hover:bg-fill"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
