"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { WorkoutTemplate } from "@/lib/types";
import Disclosure from "@/components/ui/Disclosure";
import Icon from "@/components/Icon";
import ExerciseTargetEditor, { type ExerciseTargets } from "./ExerciseTargetEditor";
import { deleteTemplate, saveTemplate } from "./template-actions";
import { toExerciseTargets } from "./exerciseTargets";

// Lightweight template management (create/rename+re-select exercises/delete), folded into the
// scheduling flow rather than a new page or nav item. Deleting asks once more.
export default function TemplateManager({ templates }: { templates: WorkoutTemplate[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<ExerciseTargets>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function startCreate() {
    setEditingId("new");
    setName("");
    setSelected(new Map());
    setError(null);
  }

  function startEdit(template: WorkoutTemplate) {
    setEditingId(template.id);
    setName(template.name);
    setSelected(toExerciseTargets(template.template_exercises));
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
      setConfirmDeleteId(null);
      router.refresh();
    });
  }

  return (
    <Disclosure
      className="card"
      summaryClassName="px-4 py-3"
      panelClassName="flex flex-col gap-3 px-4 pb-4"
      summary={
        <span>
          <span className="block text-sm font-semibold">Workout templates</span>
          <span className="block text-xs text-label-2">Save a set of exercises to reuse on any day.</span>
        </span>
      }
    >
      {templates.length === 0 && editingId === null && (
        <p className="text-sm text-label-2">No templates yet.</p>
      )}

      {editingId === null && templates.length > 0 && (
        <ul className="divide-y divide-separator rounded-[10px] border border-separator">
          {templates.map((template) => {
            const count = template.template_exercises?.length ?? 0;
            return (
              <li key={template.id} className="flex items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{template.name}</p>
                  <p className="text-xs text-label-3">
                    {count} exercise{count === 1 ? "" : "s"}
                  </p>
                </div>
                {confirmDeleteId === template.id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="h-8 rounded-lg px-2.5 text-sm font-medium hover:bg-fill"
                    >
                      Keep
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(template.id)}
                      disabled={pending}
                      className="h-8 rounded-lg bg-red px-2.5 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => startEdit(template)}
                      className="h-8 rounded-lg px-2.5 text-sm font-medium text-link hover:bg-fill"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(template.id)}
                      aria-label={`Delete ${template.name}`}
                      className="grid size-8 place-items-center rounded-lg text-label-3 hover:bg-fill hover:text-red"
                    >
                      <Icon name="trash" className="size-4" />
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {editingId === null && (
        <button
          type="button"
          onClick={startCreate}
          className="flex h-9 items-center gap-1 self-start rounded-lg px-2.5 text-sm font-semibold text-link hover:bg-fill"
        >
          <Icon name="plus" className="size-4" strokeWidth={2.5} />
          New template
        </button>
      )}

      {editingId !== null && (
        <div className="flex flex-col gap-3 rounded-[10px] border border-separator p-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Template name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Push A"
              className="field h-11 w-full rounded-[10px] px-3.5 text-base"
            />
          </label>
          <ExerciseTargetEditor selected={selected} onChange={setSelected} />
          {error && <p className="text-sm text-red">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={pending}
              className="h-10 rounded-[10px] bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save template"}
            </button>
            <button
              type="button"
              onClick={cancel}
              className="h-10 rounded-[10px] border border-separator px-4 text-sm font-semibold hover:bg-fill"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </Disclosure>
  );
}
