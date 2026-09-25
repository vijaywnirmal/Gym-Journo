"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MuscleGroup } from "@/lib/types";
import { EQUIPMENT_OPTIONS } from "@/lib/exerciseSearch";
import { createExercise } from "./actions";

export default function ExerciseCreateForm({ muscleGroups }: { muscleGroups: MuscleGroup[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [equipment, setEquipment] = useState("");
  const [instructions, setInstructions] = useState("");
  const [selectedMuscleGroups, setSelectedMuscleGroups] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  function toggleMuscleGroup(id: string) {
    setSelectedMuscleGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await createExercise({
        name,
        equipment,
        instructions,
        muscleGroupIds: [...selectedMuscleGroups],
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setName("");
      setEquipment("");
      setInstructions("");
      setSelectedMuscleGroups(new Set());
      router.refresh();
    });
  }

  return (
    <details className="mb-6 rounded-xl border border-neutral-800 p-4">
      <summary className="cursor-pointer text-sm font-medium text-neutral-100">
        + Add custom exercise
      </summary>
      <div className="mt-4 flex flex-col gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Exercise name"
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-base text-neutral-100 placeholder-neutral-500"
        />
        <select
          value={equipment}
          onChange={(e) => setEquipment(e.target.value)}
          aria-label="Equipment"
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-base text-neutral-100"
        >
          <option value="">Equipment (optional)</option>
          {EQUIPMENT_OPTIONS.map((eq) => (
            <option key={eq} value={eq}>
              {eq}
            </option>
          ))}
        </select>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="How to do it (optional)"
          maxLength={1000}
          rows={2}
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-base text-neutral-100 placeholder-neutral-500"
        />
        <div>
          <p className="mb-2 text-xs font-medium text-neutral-400">Muscle groups</p>
          <div className="flex flex-wrap gap-2">
            {muscleGroups.map((mg) => (
              <label
                key={mg.id}
                className="flex items-center gap-1.5 rounded-full border border-neutral-700 px-3 py-1.5 text-sm text-neutral-100 has-checked:border-white has-checked:bg-white has-checked:text-neutral-900"
              >
                <input
                  type="checkbox"
                  checked={selectedMuscleGroups.has(mg.id)}
                  onChange={() => toggleMuscleGroup(mg.id)}
                  className="sr-only"
                />
                {mg.name}
              </label>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending}
          className="rounded-lg bg-white px-4 py-2.5 font-medium text-neutral-900 disabled:opacity-50"
        >
          {pending ? "Adding..." : "Add exercise"}
        </button>
      </div>
    </details>
  );
}
