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
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
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
        return;
      }
      setError(result.error ?? "Couldn't save your schedule. Please try again.");
    });
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      <div className="flex rounded-lg bg-fill p-0.5" role="group" aria-label="Day type">
        <button
          type="button"
          onClick={() => setIsRestDay(false)}
          aria-pressed={!isRestDay}
          className={`flex-1 rounded-[0.6rem] px-3 py-1.5 text-sm font-semibold ${
            !isRestDay ? "bg-surface-raised text-label shadow-raised" : "text-label-2"
          }`}
        >
          Workout
        </button>
        <button
          type="button"
          onClick={() => setIsRestDay(true)}
          aria-pressed={isRestDay}
          className={`flex-1 rounded-[0.6rem] px-3 py-1.5 text-sm font-semibold ${
            isRestDay ? "bg-surface-raised text-label shadow-raised" : "text-label-2"
          }`}
        >
          Rest / Absence
        </button>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={isRestDay ? "Reason (optional) — e.g. Sick, Travel" : "Day title (e.g. Push Day)"}
        className="rounded-lg bg-fill px-3 py-2 text-base text-label placeholder-label-3"
      />

      {!isRestDay && (
        <>
          <div>
            <p className="mb-2 text-sm font-semibold text-label">Muscle groups</p>
            <div className="flex flex-wrap gap-2">
              {muscleGroups.map((mg) => (
                <button
                  key={mg.id}
                  type="button"
                  onClick={() => toggleMuscle(mg.id)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                    selectedMuscles.has(mg.id)
                      ? "bg-tint text-white"
                      : "bg-fill text-label"
                  }`}
                >
                  {mg.name}
                </button>
              ))}
            </div>
          </div>

          {templates.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-label-2">
                Use a template
              </label>
              <select
                value={templateId}
                onChange={(e) => applyTemplate(e.target.value)}
                className="w-full rounded-lg bg-fill px-3 py-2 text-base text-label"
              >
                <option value="">Select a template...</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-label-2">
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

      {saved && <p className="text-sm text-green">Saved!</p>}
      {error && <p className="text-sm text-red">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={pending}
        className="rounded-xl bg-tint px-4 py-3 font-medium text-white disabled:opacity-50"
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
          className="text-sm text-red"
        >
          Delete this day&apos;s plan
        </button>
      )}
    </div>
  );
}
