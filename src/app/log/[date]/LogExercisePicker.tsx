"use client";

import { useMemo, useState } from "react";
import type { Exercise } from "@/lib/types";

// Search + muscle-group grouping, same interaction pattern as schedule/[date]/ExercisePicker —
// but adding an exercise here takes effect immediately (this session's log), rather than
// building up a selection to confirm, since there's no separate "apply" step during execution.
export default function LogExercisePicker({
  exercises,
  alreadyAdded,
  onAdd,
  onCancel,
}: {
  exercises: Exercise[];
  alreadyAdded: Set<string>;
  onAdd: (exerciseId: string) => void;
  onCancel: () => void;
}) {
  const [search, setSearch] = useState("");

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term
      ? exercises.filter((ex) => ex.name.toLowerCase().includes(term))
      : exercises;
    const byGroup = new Map<string, Exercise[]>();
    for (const ex of filtered) {
      const key = ex.muscle_groups?.[0]?.name ?? "Other";
      byGroup.set(key, [...(byGroup.get(key) ?? []), ex]);
    }
    return [...byGroup.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [exercises, search]);

  const isSearching = search.trim().length > 0;

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search exercises"
        autoFocus
        className="mb-3 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-base text-neutral-100 placeholder-neutral-500"
      />

      <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
        {groups.length === 0 && (
          <p className="text-sm text-neutral-500">No exercises match &quot;{search}&quot;.</p>
        )}
        {groups.map(([groupName, list]) => (
          <details key={groupName} open={isSearching} className="rounded-lg border border-neutral-800">
            <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-neutral-200">
              {groupName}
            </summary>
            <ul className="flex flex-col gap-1 px-3 pb-2">
              {list.map((ex) => {
                const added = alreadyAdded.has(ex.id);
                return (
                  <li key={ex.id}>
                    <button
                      type="button"
                      disabled={added}
                      onClick={() => onAdd(ex.id)}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm text-neutral-100 disabled:opacity-40"
                    >
                      {ex.name}
                      <span className="text-xs text-neutral-500">{added ? "Added" : "+ Add"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </details>
        ))}
      </div>

      <button
        type="button"
        onClick={onCancel}
        className="mt-3 w-full rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300"
      >
        Close
      </button>
    </div>
  );
}
