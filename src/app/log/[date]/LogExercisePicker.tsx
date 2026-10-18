"use client";

import { useMemo, useState } from "react";
import type { Exercise } from "@/lib/types";
import { matchesSearch } from "@/lib/exerciseSearch";

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
    const filtered = exercises.filter((ex) => matchesSearch(ex, search));
    const byGroup = new Map<string, Exercise[]>();
    for (const ex of filtered) {
      const key = ex.muscle_groups?.[0]?.name ?? "Other";
      byGroup.set(key, [...(byGroup.get(key) ?? []), ex]);
    }
    return [...byGroup.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [exercises, search]);

  const isSearching = search.trim().length > 0;

  return (
    <div className="rounded-xl bg-surface p-3">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search exercises"
        autoFocus
        className="mb-3 w-full rounded-lg bg-fill px-3 py-2 text-base text-label placeholder-label-3"
      />

      <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
        {groups.length === 0 && (
          <p className="text-sm text-label-2">No exercises match &quot;{search}&quot;.</p>
        )}
        {groups.map(([groupName, list]) => (
          <details key={groupName} open={isSearching} className="rounded-lg bg-fill">
            <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-label">
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
                      className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm text-label disabled:opacity-40"
                    >
                      {ex.name}
                      <span className="text-xs text-label-2">{added ? "Added" : "+ Add"}</span>
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
        className="mt-3 w-full rounded-lg bg-fill px-4 py-2 text-sm text-label"
      >
        Close
      </button>
    </div>
  );
}
