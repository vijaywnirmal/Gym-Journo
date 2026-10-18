"use client";

import { useState } from "react";
import type { Exercise } from "@/lib/types";
import ExerciseSearchList from "@/components/ExerciseSearchList";
import Icon from "@/components/Icon";

// Builds up a selection of exercises to add to the plan, confirmed in one step.
export default function ExercisePicker({
  exercises,
  initiallySelected,
  onConfirm,
  onCancel,
}: {
  exercises: Exercise[];
  initiallySelected: Set<string>;
  onConfirm: (selectedIds: string[]) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initiallySelected));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <section className="card p-4">
      <h2 className="mb-3 text-base font-semibold">Choose exercises</h2>
      <ExerciseSearchList
        exercises={exercises}
        autoFocus
        isSelected={(ex) => selected.has(ex.id)}
        onRowClick={(ex) => toggle(ex.id)}
        renderAction={(ex) => {
          const on = selected.has(ex.id);
          return (
            <span
              role="checkbox"
              aria-checked={on}
              aria-label={ex.name}
              className={`grid size-5 shrink-0 place-items-center rounded-md border ${
                on ? "border-transparent bg-accent text-on-accent" : "border-label-3"
              }`}
            >
              {on && <Icon name="checkmark" className="size-3.5" strokeWidth={3} />}
            </span>
          );
        }}
      />
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => onConfirm([...selected])}
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
