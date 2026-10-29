"use client";

import { useEffect, useState } from "react";
import { fetchSwapOptions } from "./actions";
import type { SwapOption } from "@/lib/exerciseSwap";

// Exercises that do the same job as the current one (lib/exerciseSwap.ts), for when its equipment is
// taken. Mount it only when Swap is opened: that's when it's fetched.
export default function ExerciseSwapPanel({
  exerciseId,
  excludeIds,
  panelId,
  onChoose,
}: {
  exerciseId: string;
  excludeIds: string[];
  panelId: string;
  onChoose: (option: SwapOption) => void;
}) {
  const [options, setOptions] = useState<SwapOption[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Loaded once per opening; the workout's other exercises don't change while it's open.
  const [excluded] = useState(excludeIds);

  useEffect(() => {
    let cancelled = false;
    fetchSwapOptions(exerciseId, excluded)
      .then((result) => {
        if (!cancelled) setOptions(result);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [exerciseId, excluded, attempt]);

  function retry() {
    setFailed(false);
    setOptions(null);
    setAttempt((n) => n + 1);
  }

  return (
    <div id={panelId} aria-live="polite" aria-busy={!options && !failed}>
      <p className="mb-2 text-sm font-medium">Swap for an exercise that works the same muscles</p>
      {failed ? (
        <p className="text-sm text-red">
          Couldn&apos;t load alternatives.{" "}
          <button type="button" onClick={retry} className="font-medium text-link">
            Try again
          </button>
        </p>
      ) : !options ? (
        <div className="flex flex-col gap-2" aria-label="Loading alternatives">
          <div className="skeleton h-10" />
          <div className="skeleton h-10" />
        </div>
      ) : options.length === 0 ? (
        <p className="text-sm text-label-2">No close alternatives. Use Add exercise to pick any other one.</p>
      ) : (
        <ul className="divide-y divide-separator overflow-hidden rounded-[10px] border border-separator">
          {options.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => onChoose(option)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-fill"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{option.name}</span>
                  {option.equipment && <span className="block text-xs text-label-3">{option.equipment}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
