"use client";

import { useMemo, useState } from "react";
import type { Exercise, MuscleGroup } from "@/lib/types";
import { EQUIPMENT_OPTIONS, filterExercises } from "@/lib/exerciseSearch";
import Icon from "@/components/Icon";
import Select from "@/components/ui/Select";
import DeleteExerciseButton from "./DeleteExerciseButton";
import ExerciseCreateForm from "./ExerciseCreateForm";

type Props = {
  exercises: Exercise[];
  muscleGroups: MuscleGroup[];
  userId: string | null;
};

const groupOf = (ex: Exercise) => ex.muscle_groups?.[0]?.name ?? "Other";

// Rendering the whole ~750-row library at once is slow on phones; reveal it a page at a time.
const PAGE_SIZE = 80;

// Search + muscle/equipment filters over the whole library, listed alphabetically under
// muscle-group headings. A row opens to show how-to notes and, for the person's own exercises,
// a delete action.
export default function ExerciseBrowser({ exercises, muscleGroups, userId }: Props) {
  const [term, setTerm] = useState("");
  const [muscleGroupId, setMuscleGroupId] = useState("");
  const [equipment, setEquipment] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const results = useMemo(() => {
    const filtered = filterExercises(exercises, {
      term,
      muscleGroupId: muscleGroupId || null,
      equipment: equipment || null,
    });
    return filtered.sort((a, b) => groupOf(a).localeCompare(groupOf(b)) || a.name.localeCompare(b.name));
  }, [exercises, term, muscleGroupId, equipment]);

  const filtering = term.trim() !== "" || muscleGroupId !== "" || equipment !== "";

  function resetPaging() {
    setLimit(PAGE_SIZE);
  }

  function clearFilters() {
    setTerm("");
    setMuscleGroupId("");
    setEquipment("");
    resetPaging();
  }


  return (
    <div className="flex flex-col gap-3 pb-6">
      {creating ? (
        <ExerciseCreateForm muscleGroups={muscleGroups} onDone={() => setCreating(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex h-10 items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-separator text-sm font-semibold text-link hover:bg-fill"
        >
          <Icon name="plus" className="size-4" strokeWidth={2.5} />
          New custom exercise
        </button>
      )}

      <label className="field flex h-11 items-center gap-2 rounded-[10px] px-3.5 focus-within:border-accent">
        <Icon name="search" className="size-[18px] shrink-0 text-label-3" />
        <input
          type="text"
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            resetPaging();
          }}
          placeholder="Search by name, muscle or equipment"
          aria-label="Search exercises"
          className="h-full w-full min-w-0 bg-transparent text-[15px] outline-none placeholder:text-label-3"
        />
        {term && (
          <button
            type="button"
            onClick={() => setTerm("")}
            aria-label="Clear search"
            className="grid size-7 place-items-center rounded-md text-label-3 hover:bg-fill"
          >
            <Icon name="close" className="size-4" strokeWidth={2.25} />
          </button>
        )}
      </label>

      <div className="flex items-center gap-2">
        <Select
          value={muscleGroupId}
          onChange={(v) => {
            setMuscleGroupId(v);
            resetPaging();
          }}
          options={[{ value: "", label: "All muscles" }, ...muscleGroups.map((mg) => ({ value: mg.id, label: mg.name }))]}
          ariaLabel="Filter by muscle"
          searchable={false}
          className="min-w-0 flex-1"
        />
        <Select
          value={equipment}
          onChange={(v) => {
            setEquipment(v);
            resetPaging();
          }}
          options={[{ value: "", label: "All equipment" }, ...EQUIPMENT_OPTIONS.map((eq) => ({ value: eq, label: eq }))]}
          ariaLabel="Filter by equipment"
          className="min-w-0 flex-1"
        />
      </div>

      <div className="-mt-1 flex h-8 items-center gap-2 px-1">
        <span className="text-sm text-label-2 tabular-nums">
          {results.length} exercise{results.length === 1 ? "" : "s"}
        </span>
        {filtering && (
          <button
            type="button"
            onClick={clearFilters}
            className="h-8 rounded-lg px-2 text-sm font-medium text-link hover:bg-fill"
          >
            Clear
          </button>
        )}
      </div>

      {results.length === 0 ? (
        <section className="card px-6 py-10 text-center">
          <h2 className="text-base font-semibold">No matches</h2>
          <p className="mt-1 text-sm text-label-2">Try a different search, or add it as a custom exercise.</p>
        </section>
      ) : (
        <div className="card overflow-clip">
          <ul>
            {results.slice(0, limit).map((ex, i) => {
              const group = groupOf(ex);
              const heading = i === 0 || groupOf(results[i - 1]) !== group ? group : null;
              const own = userId !== null && ex.user_id === userId;
              const expandable = !!ex.instructions || own;
              const open = openId === ex.id;
              return (
                <li key={ex.id}>
                  {heading && (
                    <p className="sticky top-0 z-10 border-b border-separator bg-surface/95 px-4 py-2 text-xs font-semibold text-label-2 backdrop-blur">
                      {heading}
                    </p>
                  )}
                  <div className="border-b border-separator">
                    <button
                      type="button"
                      onClick={() => expandable && setOpenId(open ? null : ex.id)}
                      aria-expanded={expandable ? open : undefined}
                      disabled={!expandable}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left enabled:hover:bg-fill"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{ex.name}</span>
                          {own && (
                            <span className="shrink-0 rounded-md bg-accent/10 px-1.5 py-0.5 text-[11px] font-semibold text-link">
                              Custom
                            </span>
                          )}
                        </span>
                        <span className="block truncate text-xs text-label-3">
                          {[ex.equipment, ...(ex.muscle_groups ?? []).map((m) => m.name)].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      {expandable && (
                        <Icon
                          name="chevronDown"
                          className={`size-4 shrink-0 text-label-3 transition-transform ${open ? "rotate-180" : ""}`}
                          strokeWidth={2.25}
                        />
                      )}
                    </button>
                    {open && (
                      <div className="flex flex-col gap-3 px-4 pb-4">
                        {ex.instructions ? (
                          <p className="text-sm leading-relaxed text-label-2">{ex.instructions}</p>
                        ) : (
                          <p className="text-sm text-label-3">No how-to notes.</p>
                        )}
                        {own && <DeleteExerciseButton exerciseId={ex.id} name={ex.name} />}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {results.length > limit && (
            <button
              type="button"
              onClick={() => setLimit((n) => n + PAGE_SIZE)}
              className="w-full py-3 text-sm font-medium text-link hover:bg-fill"
            >
              Show more ({results.length - limit} left)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
