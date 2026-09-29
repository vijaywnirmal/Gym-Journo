"use client";

import { useState } from "react";
import ExerciseLibraryBrowser from "@/components/exercise-library/ExerciseLibraryBrowser";

export type PickedExercise = { id: string; name: string };

// Browse or search the library and tick exercises for a plan or template; nothing changes until
// "Add" confirms the selection.
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
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
      <ExerciseLibraryBrowser
        resultsClassName="max-h-80 overflow-y-auto"
        renderExercise={(exercise) => (
          <label className="flex items-center gap-2 py-1 text-sm text-neutral-100">
            <input type="checkbox" checked={selected.has(exercise.id)} onChange={() => toggle(exercise)} />
            {exercise.name}
          </label>
        )}
      />

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => onConfirm([...selected].map(([id, name]) => ({ id, name })))}
          className="flex-1 rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-900"
        >
          Add{selected.size > 0 ? ` (${selected.size})` : ""}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
