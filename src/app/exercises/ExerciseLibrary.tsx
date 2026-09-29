"use client";

import { useCallback, useId, useState } from "react";
import type { MuscleGroup } from "@/lib/types";
import type { ExerciseListItem } from "@/lib/exerciseLibrary";
import ExerciseLibraryBrowser from "@/components/exercise-library/ExerciseLibraryBrowser";
import ExerciseTutorialPanel from "@/components/exercise-library/ExerciseTutorialPanel";
import ExerciseCreateForm from "./ExerciseCreateForm";
import DeleteExerciseButton from "./DeleteExerciseButton";

// The library page's interactive part: add a custom exercise, and browse muscle group ->
// exercise -> tutorial. Creating or deleting an exercise bumps `version` so the lists reload.
export default function ExerciseLibrary({ muscleGroups }: { muscleGroups: MuscleGroup[] }) {
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return (
    <>
      <ExerciseCreateForm muscleGroups={muscleGroups} onCreated={reload} />
      <div className="pb-6">
        <ExerciseLibraryBrowser
          version={version}
          renderExercise={(exercise) => <LibraryExerciseRow exercise={exercise} onDeleted={reload} />}
        />
      </div>
    </>
  );
}

function LibraryExerciseRow({ exercise, onDeleted }: { exercise: ExerciseListItem; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="rounded-lg border border-neutral-800 px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={panelId}
          className="min-w-0 text-left"
        >
          <span className="block font-medium text-neutral-100">{exercise.name}</span>
          <span className="block text-xs text-neutral-400">
            {exercise.equipment ?? "—"}
            {exercise.hasTutorial ? ` · ${open ? "Hide" : "Show"} tutorial` : ""}
          </span>
        </button>
        {exercise.isOwn && <DeleteExerciseButton exerciseId={exercise.id} onDeleted={onDeleted} />}
      </div>
      {open && <ExerciseTutorialPanel exerciseId={exercise.id} panelId={panelId} />}
    </div>
  );
}
