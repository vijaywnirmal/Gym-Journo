"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MuscleGroup, WorkoutPlan, WorkoutTemplate } from "@/lib/types";
import { savePlan, deletePlan } from "./actions";
import ExerciseTargetEditor, { type ExerciseTargets } from "./ExerciseTargetEditor";
import TemplateManager from "./TemplateManager";
import { toExerciseTargets } from "./exerciseTargets";
import { DAY_TYPE_LABEL, DAY_TYPE_TITLE_PLACEHOLDER, DAY_TYPES, dayTypeOf, type DayType } from "@/lib/dayType";

type Props = {
  date: string;
  muscleGroups: MuscleGroup[];
  existingPlan: WorkoutPlan | null;
  templates: WorkoutTemplate[];
};

export default function ScheduleForm({ date, muscleGroups, existingPlan, templates }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(existingPlan?.title ?? "");
  const [dayType, setDayType] = useState<DayType>(existingPlan ? dayTypeOf(existingPlan) : "workout");
  const isWorkout = dayType === "workout";
  const [selectedMuscles, setSelectedMuscles] = useState<Set<string>>(
    new Set(existingPlan?.muscle_groups?.map((m) => m.id) ?? [])
  );
  const [selectedExercises, setSelectedExercises] = useState<ExerciseTargets>(() =>
    toExerciseTargets(existingPlan?.planned_exercises)
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
    setSelectedExercises(toExerciseTargets(template.template_exercises));
  }

  function handleSubmit() {
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const result = await savePlan({
        date,
        title,
        dayType,
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
      <div className="flex gap-2">
        {DAY_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setDayType(type)}
            aria-pressed={dayType === type}
            className={`flex-1 rounded-lg border px-2 py-2 text-sm font-medium ${
              dayType === type ? "border-white bg-white text-neutral-900" : "border-neutral-700 text-neutral-100"
            }`}
          >
            {DAY_TYPE_LABEL[type]}
          </button>
        ))}
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={DAY_TYPE_TITLE_PLACEHOLDER[dayType]}
        className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-base text-neutral-100 placeholder-neutral-500"
      />

      {isWorkout && (
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

          <ExerciseTargetEditor selected={selectedExercises} onChange={setSelectedExercises} />

          <TemplateManager templates={templates} />
        </>
      )}

      {saved && <p className="text-sm text-green-400">Saved!</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

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
