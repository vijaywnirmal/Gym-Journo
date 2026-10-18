"use client";

import { useCallback, useId, useState } from "react";
import type { MuscleGroup } from "@/lib/types";
import type { ExerciseListItem } from "@/lib/exerciseLibrary";
import ExerciseLibraryBrowser from "@/components/exercise-library/ExerciseLibraryBrowser";
import ExerciseTutorialPanel from "@/components/exercise-library/ExerciseTutorialPanel";
import Icon from "@/components/Icon";
import ExerciseCreateForm from "./ExerciseCreateForm";
import DeleteExerciseButton from "./DeleteExerciseButton";

// The library page's interactive part: add a custom exercise, and browse muscle group ->
// exercise -> tutorial. Creating or deleting an exercise bumps `version` so the lists reload.
export default function ExerciseLibrary({ muscleGroups }: { muscleGroups: MuscleGroup[] }) {
  const [version, setVersion] = useState(0);
  const [creating, setCreating] = useState(false);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return (
    <div className="flex flex-col gap-4 pb-6">
      {creating ? (
        <ExerciseCreateForm muscleGroups={muscleGroups} onCreated={reload} onDone={() => setCreating(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex h-10 items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-separator text-sm font-semibold text-link hover:bg-fill"
        >
          <Icon name="plus" className="size-4" strokeWidth={2.5} />
          New custom exercise
        </button>
      )}
      <section className="card p-3">
        <ExerciseLibraryBrowser
          version={version}
          renderExercise={(exercise) => <LibraryExerciseRow exercise={exercise} onDeleted={reload} />}
        />
      </section>
    </div>
  );
}

function LibraryExerciseRow({ exercise, onDeleted }: { exercise: ExerciseListItem; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const expandable = exercise.hasTutorial || exercise.isOwn;

  return (
    <div>
      <button
        type="button"
        onClick={() => expandable && setOpen((value) => !value)}
        aria-expanded={expandable ? open : undefined}
        aria-controls={expandable ? panelId : undefined}
        disabled={!expandable}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left enabled:hover:bg-fill"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{exercise.name}</span>
            {exercise.isOwn && (
              <span className="shrink-0 rounded-md bg-accent/10 px-1.5 py-0.5 text-[11px] font-semibold text-link">
                Custom
              </span>
            )}
          </span>
          <span className="block truncate text-xs text-label-3">
            {exercise.equipment ?? "No equipment"}
            {exercise.hasTutorial ? " · Tutorial" : ""}
          </span>
        </span>
        {expandable && (
          <Icon
            name="chevronDown"
            className={`size-4 shrink-0 text-label-3 transition-transform ${open ? "rotate-180" : ""}`}
            strokeWidth={2.25}
          />
        )}
      </button>
      {open && (
        <div className="flex flex-col gap-3 px-4 pb-4">
          {exercise.hasTutorial && <ExerciseTutorialPanel exerciseId={exercise.id} panelId={panelId} />}
          {exercise.isOwn && <DeleteExerciseButton exerciseId={exercise.id} name={exercise.name} onDeleted={onDeleted} />}
        </div>
      )}
    </div>
  );
}
