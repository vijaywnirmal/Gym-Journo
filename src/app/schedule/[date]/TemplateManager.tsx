"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Exercise, WorkoutTemplate } from "@/lib/types";
import ExerciseTargetEditor, { type ExerciseTargets } from "./ExerciseTargetEditor";
import { deleteTemplate, saveTemplate } from "./template-actions";

function templateToTargets(template: WorkoutTemplate): ExerciseTargets {
  const map: ExerciseTargets = new Map();
  for (const te of template.template_exercises ?? []) {
    map.set(te.exercise_id, {
      targetSets: te.target_sets?.toString() ?? "",
      targetReps: te.target_reps?.toString() ?? "",
      targetWeight: te.target_weight?.toString() ?? "",
      targetWeightUnit: te.target_weight_unit || "kg",
    });
  }
  return map;
}

// Lightweight template management (create/rename+re-select exercises/delete), folded into the
// scheduling flow rather than a new page or nav item.
export default function TemplateManager({
  templates,
  exercises,
}: {
  templates: WorkoutTemplate[];
  exercises: Exercise[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<ExerciseTargets>(new Map());
  const [error, setError] = useState<string | null>(null);

  function startCreate() {
    setEditingId("new");
    setName("");
    setSelected(new Map());
    setError(null);
  }

  function startEdit(template: WorkoutTemplate) {
    setEditingId(template.id);
    setName(template.name);
    setSelected(templateToTargets(template));
    setError(null);
  }

  function cancel() {
    setEditingId(null);
    setError(null);
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await saveTemplate({
        templateId: editingId && editingId !== "new" ? editingId : undefined,
        name,
        exercises: [...selected.entries()].map(([exerciseId, t]) => ({
          exerciseId,
          targetSets: t.targetSets ? parseInt(t.targetSets, 10) : null,
          targetReps: t.targetReps ? parseInt(t.targetReps, 10) : null,
          targetWeight: t.targetWeight ? parseFloat(t.targetWeight) : null,
          targetWeightUnit: t.targetWeightUnit,
        })),
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setEditingId(null);
      router.refresh();
    });
  }

  function handleDelete(templateId: string) {
    startTransition(async () => {
      await deleteTemplate(templateId);
      router.refresh();
    });
  }

  return (
    <details className="rounded-xl bg-surface p-4">
      <summary className="cursor-pointer text-sm font-medium text-label">
        Manage templates
      </summary>

      <div className="mt-4 flex flex-col gap-3">
        {templates.length === 0 && editingId === null && (
          <p className="text-sm text-label-2">No templates yet.</p>
        )}

        {editingId === null &&
          templates.map((template) => (
            <div
              key={template.id}
              className="flex items-center justify-between rounded-lg bg-fill px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium text-label">{template.name}</p>
                <p className="text-xs text-label-2">
                  {template.template_exercises?.length ?? 0} exercise
                  {(template.template_exercises?.length ?? 0) === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => startEdit(template)}
                  className="text-xs text-tint"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(template.id)}
                  disabled={pending}
                  className="text-xs text-red disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}

        {editingId === null && (
          <button
            type="button"
            onClick={startCreate}
            className="self-start text-sm text-tint"
          >
            + New template
          </button>
        )}

        {editingId !== null && (
          <div className="flex flex-col gap-3 rounded-lg bg-fill p-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Template name (e.g. Push A)"
              className="rounded-lg bg-fill px-3 py-2 text-base text-label placeholder-label-3"
            />
            <ExerciseTargetEditor
              exercises={exercises}
              selected={selected}
              onChange={setSelected}
            />
            {error && <p className="text-sm text-red">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={pending}
                className="rounded-lg bg-tint px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {pending ? "Saving..." : "Save template"}
              </button>
              <button
                type="button"
                onClick={cancel}
                className="rounded-lg bg-fill px-4 py-2 text-sm text-label"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
