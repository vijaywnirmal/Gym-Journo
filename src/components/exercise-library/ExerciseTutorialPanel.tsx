"use client";

import ExerciseDemo from "@/components/ExerciseDemo";
import { useExerciseTutorial } from "./hooks";

// An exercise's demo images and step-by-step instructions. Mount it only when the tutorial is
// opened: that's when it's fetched.
export default function ExerciseTutorialPanel({ exerciseId, panelId }: { exerciseId: string; panelId?: string }) {
  const { tutorial, status, retry } = useExerciseTutorial(exerciseId);

  return (
    <div id={panelId} className="flex flex-col gap-3" aria-live="polite" aria-busy={status === "loading"}>
      {status === "loading" && (
        <div className="flex flex-col gap-2" aria-label="Loading tutorial">
          <div className="skeleton h-32 w-full max-w-xs" />
          <div className="skeleton h-4 w-2/3" />
        </div>
      )}

      {status === "error" && (
        <p className="text-sm text-red">
          Couldn&apos;t load the tutorial.{" "}
          <button type="button" onClick={retry} className="font-medium text-link">
            Try again
          </button>
        </p>
      )}

      {tutorial && (
        <>
          {tutorial.demoImages.length > 0 && <ExerciseDemo images={tutorial.demoImages} name={tutorial.name} />}
          {tutorial.muscleGroups.length > 0 && (
            <p className="text-xs font-medium text-label-2">{tutorial.muscleGroups.join(" · ")}</p>
          )}
          {tutorial.steps.length > 1 && (
            <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-label-2 marker:text-label-3">
              {tutorial.steps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          )}
          {tutorial.steps.length === 1 && <p className="text-sm leading-relaxed text-label-2">{tutorial.steps[0]}</p>}
          {tutorial.steps.length === 0 && tutorial.demoImages.length === 0 && (
            <p className="text-sm text-label-3">No tutorial for this exercise yet.</p>
          )}
        </>
      )}
    </div>
  );
}
