"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Exercise, MuscleGroup, WorkoutPlan } from "@/lib/types";
import { savePlan, deletePlan } from "./actions";

type Props = {
  date: string;
  muscleGroups: MuscleGroup[];
  exercises: Exercise[];
  existingPlan: WorkoutPlan | null;
};

export default function ScheduleForm({ date, muscleGroups, exercises, existingPlan }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(existingPlan?.title ?? "");
  const [isRestDay, setIsRestDay] = useState(existingPlan?.is_rest_day ?? false);
  const [selectedMuscles, setSelectedMuscles] = useState<Set<string>>(
    new Set(existingPlan?.muscle_groups?.map((m) => m.id) ?? [])
  );
  const [selectedExercises, setSelectedExercises] = useState<
    Map<string, { targetSets: string; targetReps: string }>
  >(
    new Map(
      existingPlan?.planned_exercises?.map((pe) => [
        pe.exercise_id,
        { targetSets: pe.target_sets?.toString() ?? "3", targetReps: pe.target_reps?.toString() ?? "10" },
      ]) ?? []
    )
  );
  const [saved, setSaved] = useState(false);

  const filteredExercises = useMemo(() => {
    if (selectedMuscles.size === 0) return exercises;
    return exercises.filter((ex) =>
      ex.muscle_groups?.some((mg) => selectedMuscles.has(mg.id))
    );
  }, [exercises, selectedMuscles]);

  function toggleMuscle(id: string) {
    setSelectedMuscles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleExercise(id: string) {
    setSelectedExercises((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else next.set(id, { targetSets: "3", targetReps: "10" });
      return next;
    });
  }

  function updateTarget(id: string, field: "targetSets" | "targetReps", value: string) {
    setSelectedExercises((prev) => {
      const next = new Map(prev);
      const current = next.get(id);
      if (current) next.set(id, { ...current, [field]: value });
      return next;
    });
  }

  function handleSubmit() {
    setSaved(false);
    startTransition(async () => {
      const result = await savePlan({
        date,
        title,
        isRestDay,
        muscleGroupIds: [...selectedMuscles],
        exercises: [...selectedExercises.entries()].map(([exerciseId, t]) => ({
          exerciseId,
          targetSets: t.targetSets ? parseInt(t.targetSets, 10) : null,
          targetReps: t.targetReps ? parseInt(t.targetReps, 10) : null,
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
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setIsRestDay(false)}
          className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
            !isRestDay
              ? "border-white bg-white text-neutral-900"
              : "border-neutral-700 text-neutral-100"
          }`}
        >
          🏋️ Workout
        </button>
        <button
          type="button"
          onClick={() => setIsRestDay(true)}
          className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
            isRestDay
              ? "border-white bg-white text-neutral-900"
              : "border-neutral-700 text-neutral-100"
          }`}
        >
          😴 Rest / Absence
        </button>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={isRestDay ? "Reason (optional) — e.g. Sick, Travel" : "Day title (e.g. Push Day)"}
        className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-base text-neutral-100 placeholder-neutral-500"
      />

      {!isRestDay && (
        <>
          <div>
            <p className="mb-2 text-sm font-semibold text-neutral-100">Muscle groups</p>
            <div className="flex flex-wrap gap-2">
              {muscleGroups.map((mg) => (
                <button
                  key={mg.id}
                  type="button"
                  onClick={() => toggleMuscle(mg.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    selectedMuscles.has(mg.id)
                      ? "border-white bg-white text-neutral-900"
                      : "border-neutral-700 text-neutral-100"
                  }`}
                >
                  {mg.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-neutral-100">Exercises</p>
            <div className="flex flex-col gap-2">
              {filteredExercises.map((ex) => {
                const selected = selectedExercises.get(ex.id);
                return (
                  <div key={ex.id} className="rounded-xl border border-neutral-800 p-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!selected}
                        onChange={() => toggleExercise(ex.id)}
                      />
                      <span className="font-medium text-neutral-100">{ex.name}</span>
                    </label>
                    {selected && (
                      <div className="mt-2 flex items-center gap-3 pl-6 text-sm text-neutral-300">
                        <label className="flex items-center gap-1.5">
                          Sets
                          <input
                            type="number"
                            min={1}
                            value={selected.targetSets}
                            onChange={(e) => updateTarget(ex.id, "targetSets", e.target.value)}
                            className="w-14 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-100"
                          />
                        </label>
                        <label className="flex items-center gap-1.5">
                          Reps
                          <input
                            type="number"
                            min={1}
                            value={selected.targetReps}
                            onChange={(e) => updateTarget(ex.id, "targetReps", e.target.value)}
                            className="w-14 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-100"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredExercises.length === 0 && (
                <p className="text-sm text-neutral-400">No exercises match those muscle groups.</p>
              )}
            </div>
          </div>
        </>
      )}

      {saved && <p className="text-sm text-green-400">Saved!</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={pending}
        className="rounded-xl bg-white px-4 py-3 font-medium text-neutral-900 disabled:opacity-50"
      >
        {pending ? "Saving..." : "Save schedule"}
      </button>

      {existingPlan && (
        <button
          type="button"
          onClick={() =>
            startTransition(async () => {
              await deletePlan(existingPlan.id, date);
              router.refresh();
            })
          }
          className="text-sm text-red-400"
        >
          Delete this day&apos;s plan
        </button>
      )}
    </div>
  );
}
