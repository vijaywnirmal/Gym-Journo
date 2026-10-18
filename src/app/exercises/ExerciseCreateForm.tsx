"use client";

import { useState, useTransition } from "react";
import type { MuscleGroup } from "@/lib/types";
import { EQUIPMENT_OPTIONS } from "@/lib/exerciseSearch";
import Icon from "@/components/Icon";
import Select from "@/components/ui/Select";
import ToggleChip from "@/components/ui/ToggleChip";
import { createExercise } from "./actions";

export default function ExerciseCreateForm({
  muscleGroups,
  onCreated,
  onDone,
}: {
  muscleGroups: MuscleGroup[];
  onCreated: () => void;
  onDone: () => void;
}) {
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
      onCreated();
      onDone();
    });
  }

  return (
    <section className="card p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold">New custom exercise</h2>
        <button
          type="button"
          onClick={onDone}
          aria-label="Close"
          className="grid size-8 place-items-center rounded-lg text-label-2 hover:bg-fill"
        >
          <Icon name="close" className="size-4" strokeWidth={2.25} />
        </button>
      </div>
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_11rem]">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Landmine press"
              autoFocus
              className="field h-11 w-full rounded-[10px] px-3.5 text-base"
            />
          </label>
          <div>
            <span className="mb-1.5 block text-sm font-medium">Equipment</span>
            <Select
              value={equipment}
              onChange={setEquipment}
              options={[{ value: "", label: "None" }, ...EQUIPMENT_OPTIONS.map((eq) => ({ value: eq, label: eq }))]}
              ariaLabel="Equipment"
              size="lg"
              className="w-full"
            />
          </div>
        </div>
        <div>
          <span className="mb-2 block text-sm font-medium">Muscle groups</span>
          <div className="flex flex-wrap gap-2">
            {muscleGroups.map((mg) => (
              <ToggleChip
                key={mg.id}
                pressed={selectedMuscleGroups.has(mg.id)}
                onChange={() => toggleMuscleGroup(mg.id)}
              >
                {mg.name}
              </ToggleChip>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">
            How to do it <span className="font-normal text-label-3">(optional)</span>
          </span>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Setup, cues, range of motion…"
            maxLength={1000}
            rows={2}
            className="field w-full resize-none rounded-[10px] px-3.5 py-2.5 text-sm field-sizing-content"
          />
        </label>

        {error && <p className="text-sm text-red">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending || !name.trim()}
            className="h-10 rounded-[10px] bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-50"
          >
            {pending ? "Adding…" : "Add exercise"}
          </button>
          <button
            type="button"
            onClick={onDone}
            className="h-10 rounded-[10px] border border-separator px-4 text-sm font-semibold hover:bg-fill"
          >
            Cancel
          </button>
        </div>
      </div>
    </section>
  );
}
