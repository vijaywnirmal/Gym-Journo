"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Exercise, MuscleGroup, WorkoutPlan, WorkoutTemplate } from "@/lib/types";
import SegmentedControl from "@/components/ui/SegmentedControl";
import Select from "@/components/ui/Select";
import ToggleChip from "@/components/ui/ToggleChip";
import Icon from "@/components/Icon";
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
  const [confirmingDelete, setConfirmingDelete] = useState(false);
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
    if (!title.trim()) setTitle(template.name);
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
      setError(result.error ?? "Couldn't save your plan. Please try again.");
    });
  }

  return (
    <div className="flex flex-col gap-4 pb-6">
      <SegmentedControl
        value={isRestDay ? "rest" : "workout"}
        onChange={(v) => setIsRestDay(v === "rest")}
        options={[
          { value: "workout", label: "Workout" },
          { value: "rest", label: "Rest or time off" },
        ]}
        ariaLabel="Day type"
        className="w-full"
      />

      <section className="card flex flex-col gap-4 p-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">{isRestDay ? "Reason" : "Name"}</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={isRestDay ? "Optional — e.g. Sick, Travel" : "e.g. Push day"}
            className="field h-11 w-full rounded-[10px] px-3.5 text-base"
          />
        </label>

        {!isRestDay && (
          <div>
            <span className="mb-2 block text-sm font-medium">Muscle groups</span>
            <div className="flex flex-wrap gap-2">
              {muscleGroups.map((mg) => (
                <ToggleChip key={mg.id} pressed={selectedMuscles.has(mg.id)} onChange={() => toggleMuscle(mg.id)}>
                  {mg.name}
                </ToggleChip>
              ))}
            </div>
          </div>
        )}
      </section>

      {!isRestDay && (
        <section className="card flex flex-col gap-4 p-4">
          {templates.length > 0 && (
            <div>
              <span className="mb-1.5 block text-sm font-medium">Start from a template</span>
              <Select
                value={templateId}
                onChange={applyTemplate}
                options={templates.map((t) => ({
                  value: t.id,
                  label: t.name,
                  hint: `${t.template_exercises?.length ?? 0} exercises`,
                }))}
                placeholder="Choose a template"
                ariaLabel="Template"
                size="lg"
                className="w-full"
              />
              {templateId && (
                <p className="mt-1.5 text-xs text-label-2">Template applied — nothing is saved until you save the plan.</p>
              )}
            </div>
          )}
          <ExerciseTargetEditor exercises={exercises} selected={selectedExercises} onChange={setSelectedExercises} />
        </section>
      )}

      {error && (
        <p role="alert" className="text-sm text-red">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending}
          className="h-11 flex-1 rounded-[10px] bg-accent px-4 text-[15px] font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save plan"}
        </button>
        {saved && !pending && (
          <span className="flex items-center gap-1 text-sm font-medium text-green" role="status">
            <Icon name="checkmark" className="size-4" strokeWidth={2.5} />
            Saved
          </span>
        )}
      </div>

      {existingPlan &&
        (confirmingDelete ? (
          <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-red/30 bg-red/5 p-3">
            <p className="mr-auto text-sm">Remove the plan for this day?</p>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="h-8 rounded-lg border border-separator px-3 text-sm font-medium hover:bg-fill"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await deletePlan(existingPlan.id, date);
                  setConfirmingDelete(false);
                  router.refresh();
                })
              }
              className="h-8 rounded-lg bg-red px-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              Remove plan
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="h-9 self-center rounded-lg px-3 text-sm font-medium text-red hover:bg-red/10"
          >
            Remove this day&apos;s plan
          </button>
        ))}

      {!isRestDay && <TemplateManager templates={templates} exercises={exercises} />}
    </div>
  );
}
