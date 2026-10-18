"use client";

import { useState } from "react";
import Icon from "@/components/Icon";
import ExercisePicker, { type PickedExercise } from "./ExercisePicker";

// Selected exercises by id, each with its name (for display) and optional targets.
export type ExerciseTargets = Map<
  string,
  { name: string; targetSets: string; targetReps: string; targetWeight: string; targetWeightUnit: string }
>;

const EMPTY_TARGETS = { targetSets: "", targetReps: "", targetWeight: "", targetWeightUnit: "kg" };

const inputClass = "field h-9 w-full min-w-0 rounded-lg px-2.5 text-sm tabular-nums";

// Shared by the schedule form and the template manager: the selected exercises in order, each
// with optional target sets × reps @ weight, plus an "Add exercises" button that opens the picker.
export default function ExerciseTargetEditor({
  selected,
  onChange,
}: {
  selected: ExerciseTargets;
  onChange: (next: ExerciseTargets) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  function applyPicker(picked: PickedExercise[]) {
    const next: ExerciseTargets = new Map();
    for (const { id, name } of picked) {
      next.set(id, selected.get(id) ?? { name, ...EMPTY_TARGETS });
    }
    onChange(next);
    setPickerOpen(false);
  }

  function updateTarget(
    id: string,
    field: "targetSets" | "targetReps" | "targetWeight" | "targetWeightUnit",
    value: string
  ) {
    const next = new Map(selected);
    const current = next.get(id);
    if (current) next.set(id, { ...current, [field]: value });
    onChange(next);
  }

  function remove(id: string) {
    const next = new Map(selected);
    next.delete(id);
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          Exercises {selected.size > 0 && <span className="text-label-3">· {selected.size}</span>}
        </span>
        {!pickerOpen && (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex h-8 items-center gap-1 rounded-lg px-2.5 text-sm font-semibold text-link hover:bg-fill"
          >
            <Icon name="plus" className="size-4" strokeWidth={2.5} />
            {selected.size > 0 ? "Add or remove" : "Add exercises"}
          </button>
        )}
      </div>

      {selected.size === 0 && !pickerOpen && (
        <p className="rounded-[10px] border border-dashed border-separator px-4 py-6 text-center text-sm text-label-2">
          No exercises yet. Targets are optional — set them to see them while you log.
        </p>
      )}

      {selected.size > 0 && (
        <ol className="flex flex-col divide-y divide-separator rounded-[10px] border border-separator">
          {[...selected.entries()].map(([id, targets], i) => {
            const name = targets.name;
            return (
              <li key={id} className="p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="w-5 text-xs font-medium tabular-nums text-label-3">{i + 1}</span>
                  <p className="min-w-0 flex-1 truncate text-sm font-medium">{name}</p>
                  <button
                    type="button"
                    onClick={() => remove(id)}
                    aria-label={`Remove ${name}`}
                    className="grid size-7 place-items-center rounded-md text-label-3 hover:bg-fill hover:text-red"
                  >
                    <Icon name="close" className="size-4" strokeWidth={2} />
                  </button>
                </div>
                <div className="grid grid-cols-[1fr_1fr_1.4fr] gap-2 pl-7">
                  <label>
                    <span className="mb-1 block text-[11px] font-medium text-label-3">Sets</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      placeholder="–"
                      value={targets.targetSets}
                      onChange={(e) => updateTarget(id, "targetSets", e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label>
                    <span className="mb-1 block text-[11px] font-medium text-label-3">Reps</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      placeholder="–"
                      value={targets.targetReps}
                      onChange={(e) => updateTarget(id, "targetReps", e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <div>
                    <span className="mb-1 block text-[11px] font-medium text-label-3">Weight</span>
                    <div className="field flex h-9 items-center rounded-lg focus-within:border-accent">
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.5"
                        placeholder="–"
                        value={targets.targetWeight}
                        onChange={(e) => updateTarget(id, "targetWeight", e.target.value)}
                        aria-label={`${name} target weight`}
                        className="h-full w-full min-w-0 bg-transparent pl-2.5 text-sm tabular-nums outline-none placeholder:text-label-3"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateTarget(id, "targetWeightUnit", targets.targetWeightUnit === "kg" ? "lb" : "kg")
                        }
                        aria-label={`Unit: ${targets.targetWeightUnit}. Switch unit`}
                        className="mr-1 h-7 shrink-0 rounded-md px-1.5 text-xs font-semibold text-label-2 hover:bg-fill"
                      >
                        {targets.targetWeightUnit}
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {pickerOpen && (
        <ExercisePicker
          initiallySelected={[...selected].map(([id, targets]) => ({ id, name: targets.name }))}
          onConfirm={applyPicker}
          onCancel={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
