"use client";

import type { Exercise } from "@/lib/types";
import ExerciseSearchList from "@/components/ExerciseSearchList";
import Icon from "@/components/Icon";

// Adding an exercise here takes effect immediately (this session's log), rather than building up
// a selection to confirm, since there's no separate "apply" step during execution.
export default function LogExercisePicker({
  exercises,
  alreadyAdded,
  onAdd,
  onCancel,
}: {
  exercises: Exercise[];
  alreadyAdded: Set<string>;
  onAdd: (exerciseId: string) => void;
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
      <ExerciseSearchList
        exercises={exercises}
        autoFocus
        isSelected={(ex) => alreadyAdded.has(ex.id)}
        onRowClick={(ex) => !alreadyAdded.has(ex.id) && onAdd(ex.id)}
        renderAction={(ex) =>
          alreadyAdded.has(ex.id) ? (
            <span className="flex items-center gap-1 text-xs font-medium text-label-3">
              <Icon name="checkmark" className="size-3.5" strokeWidth={2.5} />
              Added
            </span>
          ) : (
            <span className="grid size-7 place-items-center rounded-md bg-accent/10 text-link" aria-hidden>
              <Icon name="plus" className="size-4" strokeWidth={2.5} />
            </span>
          )
        }
      />
    </section>
  );
}
