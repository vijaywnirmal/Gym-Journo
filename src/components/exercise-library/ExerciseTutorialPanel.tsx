"use client";

import ExerciseDemo from "@/components/ExerciseDemo";
import { useExerciseTutorial } from "./hooks";

// An exercise's demo images and step-by-step instructions. Mount it only when the tutorial is
// opened: that's when it's fetched.
export default function ExerciseTutorialPanel({ exerciseId, panelId }: { exerciseId: string; panelId?: string }) {
  const { tutorial, status, retry } = useExerciseTutorial(exerciseId);

  return (
    <div id={panelId} className="mt-2 flex flex-col gap-2" aria-live="polite" aria-busy={status === "loading"}>
      {status === "loading" && <p className="text-xs text-neutral-500">Loading tutorial…</p>}

      {status === "error" && (
        <p className="text-xs text-red-400">
          Couldn&apos;t load the tutorial.{" "}
          <button type="button" onClick={retry} className="underline">
            Try again
          </button>
        </p>
      )}

      {tutorial && (
        <>
          {tutorial.demoImages.length > 0 && <ExerciseDemo images={tutorial.demoImages} name={tutorial.name} />}
          {tutorial.muscleGroups.length > 0 && (
            <p className="text-xs text-neutral-400">{tutorial.muscleGroups.join(" · ")}</p>
          )}
          {tutorial.steps.length > 1 && (
            <ol className="list-decimal space-y-1 pl-5 text-sm text-neutral-300">
              {tutorial.steps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          )}
          {tutorial.steps.length === 1 && <p className="text-sm text-neutral-300">{tutorial.steps[0]}</p>}
          {tutorial.steps.length === 0 && tutorial.demoImages.length === 0 && (
            <p className="text-xs text-neutral-500">No tutorial for this exercise yet.</p>
          )}
        </>
      )}
    </div>
  );
}
