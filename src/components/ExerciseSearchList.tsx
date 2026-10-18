"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { Exercise } from "@/lib/types";
import { filterExercises } from "@/lib/exerciseSearch";
import Icon from "@/components/Icon";
import Select from "@/components/ui/Select";

const groupOf = (ex: Exercise) => ex.muscle_groups?.[0]?.name ?? "Other";

// Rendering every row of a ~750-exercise library at once is slow on phones; show a page at a time.
const PAGE_SIZE = 60;

// Search box + muscle filter over the exercise library, listing matches alphabetically under
// muscle-group headings. Used wherever an exercise is picked (logging, planning); the caller
// decides what each row's trailing control does.
export default function ExerciseSearchList({
  exercises,
  renderAction,
  isSelected,
  onRowClick,
  autoFocus = false,
  maxHeightClass = "max-h-[22rem]",
}: {
  exercises: Exercise[];
  renderAction: (ex: Exercise) => ReactNode;
  isSelected?: (ex: Exercise) => boolean;
  onRowClick?: (ex: Exercise) => void;
  autoFocus?: boolean;
  maxHeightClass?: string;
}) {
  const [term, setTerm] = useState("");
  const [muscleGroupId, setMuscleGroupId] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const muscleOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const ex of exercises) for (const mg of ex.muscle_groups ?? []) byId.set(mg.id, mg.name);
    return [
      { value: "", label: "All muscles" },
      ...[...byId].sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ value, label })),
    ];
  }, [exercises]);

  const results = useMemo(() => {
    const filtered = filterExercises(exercises, { term, muscleGroupId: muscleGroupId || null, equipment: null });
    return filtered.sort((a, b) => groupOf(a).localeCompare(groupOf(b)) || a.name.localeCompare(b.name));
  }, [exercises, term, muscleGroupId]);

  const shown = results.slice(0, limit);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <label className="field flex h-10 min-w-0 flex-1 items-center gap-2 rounded-[10px] px-3 focus-within:border-accent">
          <Icon name="search" className="size-4 shrink-0 text-label-3" />
          <input
            type="text"
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              setLimit(PAGE_SIZE);
            }}
            placeholder="Search exercises"
            aria-label="Search exercises"
            autoFocus={autoFocus}
            className="h-full w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-label-3"
          />
          {term && (
            <button
              type="button"
              onClick={() => setTerm("")}
              aria-label="Clear search"
              className="grid size-6 place-items-center rounded-md text-label-3 hover:bg-fill"
            >
              <Icon name="close" className="size-3.5" strokeWidth={2.25} />
            </button>
          )}
        </label>
        <Select
          value={muscleGroupId}
          onChange={(v) => {
            setMuscleGroupId(v);
            setLimit(PAGE_SIZE);
          }}
          options={muscleOptions}
          ariaLabel="Filter by muscle"
          searchable={false}
          className="w-36 shrink-0"
        />
      </div>

      <div className={`${maxHeightClass} overflow-y-auto overscroll-contain rounded-[10px] border border-separator`}>
        {results.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-label-2">No exercises match your search.</p>
        ) : (
          <ul>
            {shown.map((ex, i) => {
              const group = groupOf(ex);
              const heading = i === 0 || groupOf(shown[i - 1]) !== group ? group : null;
              const selected = isSelected?.(ex) ?? false;
              return (
                <li key={ex.id}>
                  {heading && (
                    <p className="sticky top-0 z-10 border-b border-separator bg-surface/95 px-3 py-1.5 text-xs font-semibold text-label-2 backdrop-blur">
                      {heading}
                    </p>
                  )}
                  <div
                    onClick={onRowClick ? () => onRowClick(ex) : undefined}
                    className={`flex items-center gap-3 border-b border-separator px-3 py-2.5 last:border-b-0 ${
                      onRowClick ? "cursor-pointer hover:bg-fill" : ""
                    } ${selected ? "bg-accent/5" : ""}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{ex.name}</p>
                      {ex.equipment && <p className="truncate text-xs text-label-3">{ex.equipment}</p>}
                    </div>
                    {renderAction(ex)}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {results.length > limit && (
          <button
            type="button"
            onClick={() => setLimit((n) => n + PAGE_SIZE)}
            className="w-full border-t border-separator py-2.5 text-sm font-medium text-link hover:bg-fill"
          >
            Show more ({results.length - limit} left)
          </button>
        )}
      </div>
    </div>
  );
}
