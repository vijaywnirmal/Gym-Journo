"use client";

import { useMemo, useState } from "react";
import type { Exercise, MuscleGroup } from "@/lib/types";
import { EQUIPMENT_OPTIONS, filterExercises } from "@/lib/exerciseSearch";
import DeleteExerciseButton from "./DeleteExerciseButton";

type Props = {
  exercises: Exercise[];
  muscleGroups: MuscleGroup[];
  userId: string | null;
};

// Search + muscle/equipment filters over the whole library. With no filter active it keeps the
// original collapsed-by-muscle-group layout; once filtering, groups open so results are visible.
export default function ExerciseBrowser({ exercises, muscleGroups, userId }: Props) {
  const [term, setTerm] = useState("");
  const [muscleGroupId, setMuscleGroupId] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);

  const filtered = useMemo(
    () => filterExercises(exercises, { term, muscleGroupId, equipment }),
    [exercises, term, muscleGroupId, equipment]
  );
  const filtering = term.trim() !== "" || muscleGroupId !== null || equipment !== null;

  const grouped = useMemo(() => {
    const map = new Map<string, Exercise[]>();
    for (const ex of filtered) {
      const key = ex.muscle_groups?.[0]?.name ?? "Other";
      map.set(key, [...(map.get(key) ?? []), ex]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  function clearFilters() {
    setTerm("");
    setMuscleGroupId(null);
    setEquipment(null);
  }

  return (
    <div className="flex flex-col gap-3 pb-6">
      <input
        type="search"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search exercises, muscles or equipment"
        aria-label="Search exercises"
        className="rounded-lg bg-fill px-3 py-2 text-base text-label placeholder-label-3"
      />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filter by muscle group">
        {muscleGroups.map((mg) => {
          const active = muscleGroupId === mg.id;
          return (
            <button
              key={mg.id}
              type="button"
              onClick={() => setMuscleGroupId(active ? null : mg.id)}
              aria-pressed={active}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                active ? "bg-tint text-white" : "bg-fill text-label"
              }`}
            >
              {mg.name}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <select
          value={equipment ?? ""}
          onChange={(e) => setEquipment(e.target.value || null)}
          aria-label="Filter by equipment"
          className="rounded-lg bg-fill px-2 py-1.5 text-sm text-label"
        >
          <option value="">All equipment</option>
          {EQUIPMENT_OPTIONS.map((eq) => (
            <option key={eq} value={eq}>
              {eq}
            </option>
          ))}
        </select>
        <span className="text-xs text-label-2">
          {filtered.length} exercise{filtered.length === 1 ? "" : "s"}
        </span>
        {filtering && (
          <button type="button" onClick={clearFilters} className="ml-auto text-xs text-tint">
            Clear
          </button>
        )}
      </div>

      {filtered.length === 0 && <p className="text-sm text-label-2">No exercises match these filters.</p>}

      {grouped.map(([groupName, list]) => (
        <details key={`${groupName}-${filtering}`} open={filtering} className="rounded-xl bg-surface">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-label">
            {groupName} ({list.length})
          </summary>
          <ul className="flex flex-col gap-2 px-4 pb-4">
            {list.map((ex) => (
              <li key={ex.id} className="rounded-xl bg-fill px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-label">{ex.name}</p>
                    <p className="text-xs text-label-2">
                      {ex.equipment ?? "—"}
                      {ex.muscle_groups && ex.muscle_groups.length > 0
                        ? ` · ${ex.muscle_groups.map((m) => m.name).join(", ")}`
                        : ""}
                    </p>
                  </div>
                  {userId !== null && ex.user_id === userId && <DeleteExerciseButton exerciseId={ex.id} />}
                </div>
                {ex.instructions && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-label-2">How to</summary>
                    <p className="mt-1 text-sm text-label">{ex.instructions}</p>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}
