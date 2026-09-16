"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteExercise } from "./actions";

export default function DeleteExerciseButton({ exerciseId }: { exerciseId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteExercise(exerciseId);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        className="text-xs text-red-400 disabled:opacity-50"
      >
        {pending ? "Deleting..." : "Delete"}
      </button>
      {error && <p className="mt-1 max-w-[10rem] text-xs text-red-400">{error}</p>}
    </div>
  );
}
