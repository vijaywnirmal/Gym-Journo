"use client";

import { useState, useTransition } from "react";
import { deleteExercise } from "./actions";

// Deleting a custom exercise can't be undone, so it takes two deliberate taps.
export default function DeleteExerciseButton({
  exerciseId,
  name,
  onDeleted,
}: {
  exerciseId: string;
  name: string;
  onDeleted: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteExercise(exerciseId);
      if (result.error) {
        setError(result.error);
        return;
      }
      onDeleted();
    });
  }

  return (
    <div>
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="mr-auto text-sm">Delete {name}?</p>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={pending}
            className="h-8 rounded-lg border border-separator px-3 text-sm font-medium hover:bg-fill"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="h-8 rounded-lg bg-red px-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Deleting…" : "Delete"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="h-8 rounded-lg px-2 text-sm font-medium text-red hover:bg-red/10"
        >
          Delete exercise
        </button>
      )}
      {error && <p className="mt-1 text-xs text-red">{error}</p>}
    </div>
  );
}
