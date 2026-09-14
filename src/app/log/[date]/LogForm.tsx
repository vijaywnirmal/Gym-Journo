"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Exercise, WorkoutLog, WorkoutPlan } from "@/lib/types";
import { saveLog } from "./actions";

type SetRow = { reps: string; weight: string; weightUnit: string };
type ExerciseEntry = { exerciseId: string; name: string; sets: SetRow[] };

type Props = {
  date: string;
  exercises: Exercise[];
  plan: WorkoutPlan | null;
  existingLog: WorkoutLog | null;
};

function emptySet(): SetRow {
  return { reps: "", weight: "", weightUnit: "kg" };
}

export default function LogForm({ date, exercises, plan, existingLog }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const initialEntries: ExerciseEntry[] = existingLog?.logged_exercises?.length
    ? existingLog.logged_exercises.map((le) => ({
        exerciseId: le.exercise_id,
        name: le.exercise?.name ?? "Exercise",
        sets: le.logged_sets?.length
          ? le.logged_sets.map((s) => ({
              reps: s.reps?.toString() ?? "",
              weight: s.weight?.toString() ?? "",
              weightUnit: s.weight_unit,
            }))
          : [emptySet()],
      }))
    : plan?.planned_exercises?.map((pe) => ({
        exerciseId: pe.exercise_id,
        name: pe.exercise?.name ?? "Exercise",
        sets: Array.from({ length: pe.target_sets ?? 3 }, () => ({
          reps: pe.target_reps?.toString() ?? "",
          weight: "",
          weightUnit: "kg",
        })),
      })) ?? [];

  const [entries, setEntries] = useState<ExerciseEntry[]>(initialEntries);
  const [notes, setNotes] = useState(existingLog?.notes ?? "");
  const [completed, setCompleted] = useState(!!existingLog?.completed_at);
  const [addingExerciseId, setAddingExerciseId] = useState("");
  const [saved, setSaved] = useState(false);

  function addExercise() {
    if (!addingExerciseId) return;
    const ex = exercises.find((e) => e.id === addingExerciseId);
    if (!ex) return;
    setEntries((prev) => [...prev, { exerciseId: ex.id, name: ex.name, sets: [emptySet()] }]);
    setAddingExerciseId("");
  }

  function removeExercise(exerciseId: string) {
    setEntries((prev) => prev.filter((e) => e.exerciseId !== exerciseId));
  }

  function addSet(exerciseId: string) {
    setEntries((prev) =>
      prev.map((e) =>
        e.exerciseId === exerciseId ? { ...e, sets: [...e.sets, emptySet()] } : e
      )
    );
  }

  function removeSet(exerciseId: string, index: number) {
    setEntries((prev) =>
      prev.map((e) =>
        e.exerciseId === exerciseId
          ? { ...e, sets: e.sets.filter((_, i) => i !== index) }
          : e
      )
    );
  }

  function updateSet(exerciseId: string, index: number, field: keyof SetRow, value: string) {
    setEntries((prev) =>
      prev.map((e) =>
        e.exerciseId === exerciseId
          ? {
              ...e,
              sets: e.sets.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
            }
          : e
      )
    );
  }

  function handleSubmit() {
    setSaved(false);
    startTransition(async () => {
      const result = await saveLog({
        date,
        planId: plan?.id ?? null,
        notes,
        completed,
        exercises: entries.map((e) => ({
          exerciseId: e.exerciseId,
          sets: e.sets.map((s) => ({
            reps: s.reps ? parseInt(s.reps, 10) : null,
            weight: s.weight ? parseFloat(s.weight) : null,
            weightUnit: s.weightUnit,
          })),
        })),
      });
      if (result.success) {
        setSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      {entries.length === 0 && (
        <p className="text-sm text-neutral-500">
          No exercises yet — add one below, or set up a schedule for this day first.
        </p>
      )}

      {entries.map((entry) => (
        <div key={entry.exerciseId} className="rounded-xl border border-neutral-800 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-semibold text-neutral-100">{entry.name}</p>
            <button
              type="button"
              onClick={() => removeExercise(entry.exerciseId)}
              className="text-xs text-red-400"
            >
              Remove
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {entry.sets.map((set, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-neutral-100">
                <span className="w-5 text-neutral-500">{i + 1}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="reps"
                  value={set.reps}
                  onChange={(e) => updateSet(entry.exerciseId, i, "reps", e.target.value)}
                  className="w-16 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-neutral-100"
                />
                <span className="text-neutral-500">×</span>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="weight"
                  value={set.weight}
                  onChange={(e) => updateSet(entry.exerciseId, i, "weight", e.target.value)}
                  className="w-20 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-neutral-100"
                />
                <select
                  value={set.weightUnit}
                  onChange={(e) => updateSet(entry.exerciseId, i, "weightUnit", e.target.value)}
                  className="rounded-lg border border-neutral-700 bg-neutral-900 px-1.5 py-1.5 text-neutral-100"
                >
                  <option value="kg">kg</option>
                  <option value="lb">lb</option>
                </select>
                <button
                  type="button"
                  onClick={() => removeSet(entry.exerciseId, i)}
                  className="ml-auto text-neutral-500"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addSet(entry.exerciseId)}
              className="self-start text-sm text-neutral-300 underline"
            >
              + Add set
            </button>
          </div>
        </div>
      ))}

      <div className="flex gap-2">
        <select
          value={addingExerciseId}
          onChange={(e) => setAddingExerciseId(e.target.value)}
          className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-base text-neutral-100"
        >
          <option value="">Add an exercise...</option>
          {exercises
            .filter((ex) => !entries.some((e) => e.exerciseId === ex.id))
            .map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
        </select>
        <button
          type="button"
          onClick={addExercise}
          className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-100"
        >
          Add
        </button>
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (how did it feel?)"
        rows={3}
        className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-base text-neutral-100 placeholder-neutral-500"
      />

      <label className="flex items-center gap-2 text-sm text-neutral-100">
        <input type="checkbox" checked={completed} onChange={(e) => setCompleted(e.target.checked)} />
        Mark workout complete
      </label>

      {saved && <p className="text-sm text-green-400">Saved!</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={pending}
        className="rounded-xl bg-white px-4 py-3 font-medium text-neutral-900 disabled:opacity-50"
      >
        {pending ? "Saving..." : "Save workout log"}
      </button>
    </div>
  );
}
