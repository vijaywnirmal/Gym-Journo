"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MuscleGroup, WorkoutPlan, WorkoutTemplate } from "@/lib/types";
import SegmentedControl from "@/components/ui/SegmentedControl";
import Select from "@/components/ui/Select";
import ToggleChip from "@/components/ui/ToggleChip";
import Icon from "@/components/Icon";
import { savePlan, deletePlan, type SavePlanInput } from "./actions";
import ExerciseTargetEditor, { type ExerciseTargets } from "./ExerciseTargetEditor";
import TemplateManager from "./TemplateManager";
import { toExerciseTargets } from "./exerciseTargets";
import { DAY_TYPE_LABEL, DAY_TYPE_TITLE_PLACEHOLDER, DAY_TYPES, dayTypeOf, type DayType } from "@/lib/dayType";

type PlanActionResult = { success?: boolean; error?: string };

type Props = {
  date: string;
  muscleGroups: MuscleGroup[];
  existingPlan: WorkoutPlan | null;
  templates: WorkoutTemplate[];
  // Where saving and removing go: the signed-in person's own plan by default, or, on a trainer's
  // screen, a client's, through actions bound to that client.
  saveAction?: (input: SavePlanInput) => Promise<PlanActionResult>;
  deleteAction?: (planId: string, date: string) => Promise<PlanActionResult>;
  // Creating and editing templates is for one's own plans.
  manageTemplates?: boolean;
};

export default function ScheduleForm({
  date,
  muscleGroups,
  existingPlan,
  templates,
  saveAction = savePlan,
  deleteAction = deletePlan,
  manageTemplates = true,
}: Props) {
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
  const [removed, setRemoved] = useState(false);
  // What was last saved (or loaded), to tell whether there are unsaved changes.
  const formKey = JSON.stringify([
    title.trim(),
    dayType,
    [...selectedMuscles].sort(),
    [...selectedExercises.entries()],
  ]);
  const [savedKey, setSavedKey] = useState(formKey);
  const dirty = formKey !== savedKey;

  // Closing or reloading the tab with unsaved changes asks first. (In-app links aren't covered:
  // the router has no hook for blocking a navigation.)
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
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
    setSelectedExercises(toExerciseTargets(template.template_exercises));
    if (!title.trim()) setTitle(template.name);
  }

  function handleSubmit() {
    setSaved(false);
    setRemoved(false);
    setError(null);
    startTransition(async () => {
      const result = await saveAction({
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
        setSavedKey(formKey);
        router.refresh();
        return;
      }
      setError(result.error ?? "Couldn't save your plan. Please try again.");
    });
  }

  return (
    <div className="flex flex-col gap-4 pb-6">
      <SegmentedControl
        value={dayType}
        onChange={setDayType}
        options={DAY_TYPES.map((type) => ({ value: type, label: DAY_TYPE_LABEL[type] }))}
        ariaLabel="Day type"
        className="w-full"
      />

      <section className="card flex flex-col gap-4 p-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">
            {isWorkout ? "Name" : dayType === "rest" ? "Note" : "Reason"}
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={DAY_TYPE_TITLE_PLACEHOLDER[dayType]}
            className="field h-11 w-full rounded-[10px] px-3.5 text-base"
          />
        </label>

        {isWorkout && (
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

      {isWorkout && (
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
          <ExerciseTargetEditor selected={selectedExercises} onChange={setSelectedExercises} />
        </section>
      )}

      {error && (
        <p role="alert" className="text-sm text-red">
          {error}
        </p>
      )}
      {removed && (
        <p role="status" className="text-sm text-label-2">
          Plan removed. This day is unplanned now.
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
                  const result = await deleteAction(existingPlan.id, date);
                  setConfirmingDelete(false);
                  if (result.error) {
                    setError(result.error);
                    return;
                  }
                  // The form was filled from the plan; clear it so it doesn't still show the removed plan.
                  setTitle("");
                  setDayType("workout");
                  setSelectedMuscles(new Set());
                  setSelectedExercises(new Map());
                  setTemplateId("");
                  setSaved(false);
                  setRemoved(true);
                  setSavedKey(JSON.stringify(["", "workout", [], []]));
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

      {isWorkout && manageTemplates && (
        <TemplateManager templates={templates} currentPlan={{ name: title, exercises: selectedExercises }} />
      )}
    </div>
  );
}
