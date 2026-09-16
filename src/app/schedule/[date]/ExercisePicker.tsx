"use client";

import { useMemo, useState } from "react";
import type { Exercise } from "@/lib/types";

// Compact, on-demand exercise picker: grouped by muscle group and collapsed by default, with a
// search box, so the user is never shown the entire exercise library as one long expanded list.
export default function ExercisePicker({
  exercises,
  initiallySelected,
  onConfirm,
  onCancel,
}: {
  exercises: Exercise[];
  initiallySelected: Set<string>;
  onConfirm: (selectedIds: string[]) => void;
  onCancel: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set(initiallySelected));

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

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const isSearching = search.trim().length > 0;

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search exercises"
        className="mb-3 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-base text-neutral-100 placeholder-neutral-500"
      />

      <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
        {groups.length === 0 && (
          <p className="text-sm text-neutral-500">No exercises match &quot;{search}&quot;.</p>
        )}
        {groups.map(([groupName, list]) => (
          <details
            key={groupName}
            open={isSearching}
            className="rounded-lg border border-neutral-800"
          >
            <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-neutral-200">
              {groupName}
            </summary>
            <ul className="flex flex-col gap-1 px-3 pb-2">
              {list.map((ex) => (
                <li key={ex.id}>
                  <label className="flex items-center gap-2 py-1 text-sm text-neutral-100">
                    <input
                      type="checkbox"
                      checked={selected.has(ex.id)}
                      onChange={() => toggle(ex.id)}
                    />
                    {ex.name}
                  </label>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => onConfirm([...selected])}
          className="flex-1 rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-900"
        >
          Add{selected.size > 0 ? ` (${selected.size})` : ""}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
