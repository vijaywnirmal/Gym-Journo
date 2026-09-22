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
    <details className="rounded-xl border border-neutral-800 p-4">
      <summary className="cursor-pointer text-sm font-medium text-neutral-100">
        Manage templates
      </summary>

      <div className="mt-4 flex flex-col gap-3">
        {templates.length === 0 && editingId === null && (
          <p className="text-sm text-neutral-500">No templates yet.</p>
        )}

        {editingId === null &&
          templates.map((template) => (
            <div
              key={template.id}
              className="flex items-center justify-between rounded-lg border border-neutral-800 px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium text-neutral-100">{template.name}</p>
                <p className="text-xs text-neutral-500">
                  {template.template_exercises?.length ?? 0} exercise
                  {(template.template_exercises?.length ?? 0) === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => startEdit(template)}
                  className="text-xs text-neutral-300 underline"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(template.id)}
                  disabled={pending}
                  className="text-xs text-red-400 disabled:opacity-50"
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
            className="self-start text-sm text-neutral-300 underline"
          >
            + New template
          </button>
        )}

        {editingId !== null && (
          <div className="flex flex-col gap-3 rounded-lg border border-neutral-800 p-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Template name (e.g. Push A)"
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-base text-neutral-100 placeholder-neutral-500"
            />
            <ExerciseTargetEditor
              exercises={exercises}
              selected={selected}
              onChange={setSelected}
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={pending}
                className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-900 disabled:opacity-50"
              >
                {pending ? "Saving..." : "Save template"}
              </button>
              <button
                type="button"
                onClick={cancel}
                className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300"
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
