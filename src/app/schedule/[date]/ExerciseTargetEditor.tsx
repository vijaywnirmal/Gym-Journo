"use client";

import { useState } from "react";
import type { Exercise } from "@/lib/types";
import ExercisePicker from "./ExercisePicker";

export type ExerciseTargets = Map<
  string,
  { targetSets: string; targetReps: string; targetWeight: string; targetWeightUnit: string }
>;

const EMPTY_TARGETS = { targetSets: "", targetReps: "", targetWeight: "", targetWeightUnit: "kg" };

// Shared by the schedule form and the template manager: a compact list of already-selected
// exercises with optional target sets/reps/weight, plus an "+ Add exercise" button that opens the
// on-demand picker rather than showing the whole library inline.
export default function ExerciseTargetEditor({
  exercises,
  selected,
  onChange,
}: {
  exercises: Exercise[];
  selected: ExerciseTargets;
  onChange: (next: ExerciseTargets) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const exerciseById = new Map(exercises.map((ex) => [ex.id, ex]));

  function applyPicker(ids: string[]) {
    const next: ExerciseTargets = new Map();
    for (const id of ids) {
      next.set(id, selected.get(id) ?? { ...EMPTY_TARGETS });
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
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-neutral-100">Exercises</p>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-100"
        >
          + Add exercise
        </button>
      </div>

      {selected.size === 0 && !pickerOpen && (
        <p className="text-sm text-neutral-500">No exercises added yet.</p>
      )}

      {[...selected.entries()].map(([id, targets]) => (
        <div key={id} className="rounded-xl border border-neutral-800 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-medium text-neutral-100">
              {exerciseById.get(id)?.name ?? "Exercise"}
            </p>
            <button type="button" onClick={() => remove(id)} className="text-xs text-red-400">
              Remove
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-300">
            <label className="flex items-center gap-1.5">
              Sets
              <input
                type="number"
                min={1}
                placeholder="optional"
                value={targets.targetSets}
                onChange={(e) => updateTarget(id, "targetSets", e.target.value)}
                className="w-20 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-100 placeholder-neutral-600"
              />
            </label>
            <label className="flex items-center gap-1.5">
              Reps
              <input
                type="number"
                min={1}
                placeholder="optional"
                value={targets.targetReps}
                onChange={(e) => updateTarget(id, "targetReps", e.target.value)}
                className="w-20 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-100 placeholder-neutral-600"
              />
            </label>
            <label className="flex items-center gap-1.5">
              Weight
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.5"
                placeholder="optional"
                value={targets.targetWeight}
                onChange={(e) => updateTarget(id, "targetWeight", e.target.value)}
                className="w-20 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-100 placeholder-neutral-600"
              />
              <select
                value={targets.targetWeightUnit}
                onChange={(e) => updateTarget(id, "targetWeightUnit", e.target.value)}
                className="rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-100"
              >
                <option value="kg">kg</option>
                <option value="lb">lb</option>
              </select>
            </label>
          </div>
        </div>
      ))}

      {pickerOpen && (
        <ExercisePicker
          exercises={exercises}
          initiallySelected={new Set(selected.keys())}
          onConfirm={applyPicker}
          onCancel={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
