"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Exercise, MuscleGroup, WorkoutPlan, WorkoutTemplate } from "@/lib/types";
import { savePlan, deletePlan } from "./actions";
import ExerciseTargetEditor, { type ExerciseTargets } from "./ExerciseTargetEditor";
import TemplateManager from "./TemplateManager";

type Props = {
  date: string;
  muscleGroups: MuscleGroup[];
  exercises: Exercise[];
  existingPlan: WorkoutPlan | null;
  templates: WorkoutTemplate[];
};

export default function ScheduleForm({
  date,
  muscleGroups,
  exercises,
  existingPlan,
  templates,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(existingPlan?.title ?? "");
  const [isRestDay, setIsRestDay] = useState(existingPlan?.is_rest_day ?? false);
  const [selectedMuscles, setSelectedMuscles] = useState<Set<string>>(
    new Set(existingPlan?.muscle_groups?.map((m) => m.id) ?? [])
  );
  const [selectedExercises, setSelectedExercises] = useState<ExerciseTargets>(
    new Map(
      existingPlan?.planned_exercises?.map((pe) => [
        pe.exercise_id,
        {
          targetSets: pe.target_sets?.toString() ?? "",
          targetReps: pe.target_reps?.toString() ?? "",
          targetWeight: pe.target_weight?.toString() ?? "",
          targetWeightUnit: pe.target_weight_unit || "kg",
        },
      ]) ?? []
    )
  );
  const [templateId, setTemplateId] = useState("");
  const [saved, setSaved] = useState(false);

  function toggleMuscle(id: string) {
    setSelectedMuscles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function applyTemplate(id: string) {
    setTemplateId(id);
    if (!id) return;
    const template = templates.find((t) => t.id === id);
    if (!template) return;
    const next: ExerciseTargets = new Map();
    for (const te of template.template_exercises ?? []) {
      next.set(te.exercise_id, {
        targetSets: te.target_sets?.toString() ?? "",
        targetReps: te.target_reps?.toString() ?? "",
        targetWeight: te.target_weight?.toString() ?? "",
        targetWeightUnit: te.target_weight_unit || "kg",
      });
    }
    setSelectedExercises(next);
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
          targetWeight: t.targetWeight ? parseFloat(t.targetWeight) : null,
          targetWeightUnit: t.targetWeightUnit,
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

          {templates.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-400">
                Use a template
              </label>
              <select
                value={templateId}
                onChange={(e) => applyTemplate(e.target.value)}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-base text-neutral-100"
              >
                <option value="">Select a template...</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-neutral-500">
                Applying a template replaces the exercises below until you save.
              </p>
            </div>
          )}

          <ExerciseTargetEditor
            exercises={exercises}
            selected={selectedExercises}
            onChange={setSelectedExercises}
          />

          <TemplateManager templates={templates} exercises={exercises} />
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
