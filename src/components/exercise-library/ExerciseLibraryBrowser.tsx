"use client";

import { useState, type ReactNode } from "react";
import { EQUIPMENT_OPTIONS, MAX_SEARCH_LENGTH, searchWords, type Equipment } from "@/lib/exerciseSearch";
import type { ExerciseListItem } from "@/lib/exerciseLibrary";
import Disclosure from "@/components/ui/Disclosure";
import Icon from "@/components/Icon";
import Select from "@/components/ui/Select";
import ExercisePageList from "./ExercisePageList";
import { useDebouncedValue, useExerciseGroups } from "./hooks";

const SEARCH_DEBOUNCE_MS = 300;

type Props = {
  // How each exercise row looks and what it does (open its tutorial, add it to a workout, ...).
  renderExercise: (exercise: ExerciseListItem) => ReactNode;
  // Change it to reload everything, e.g. after creating or deleting an exercise.
  version?: number;
  autoFocus?: boolean;
  // Extra classes for the scrolling results area (pickers cap its height).
  resultsClassName?: string;
};

// Browse the exercise library without loading it all: muscle groups with counts, ten exercises at
// a time within the open group ("Load more" for the next ten), and a search box and equipment
// filter that page through matching exercises across every group. Shared by the library page and
// the log and schedule pickers.
export default function ExerciseLibraryBrowser({ renderExercise, version = 0, autoFocus, resultsClassName = "" }: Props) {
  const [term, setTerm] = useState("");
  const [equipment, setEquipment] = useState<Equipment | "">("");
  const debouncedTerm = useDebouncedValue(term.trim(), SEARCH_DEBOUNCE_MS);
  const searching = searchWords(debouncedTerm).length > 0;
  const filters = { term: debouncedTerm, equipment: equipment || null };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <label className="field flex h-10 min-w-0 flex-1 items-center gap-2 rounded-[10px] px-3 focus-within:border-accent">
          <Icon name="search" className="size-4 shrink-0 text-label-3" />
          <input
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search name, muscle or equipment"
            aria-label="Search exercises"
            maxLength={MAX_SEARCH_LENGTH}
            autoFocus={autoFocus}
            className="h-full w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-label-3"
          />
          {term && (
            <button
              type="button"
              onClick={() => setTerm("")}
              aria-label="Clear search"
              className="grid size-6 shrink-0 place-items-center rounded-md text-label-3 hover:bg-fill"
            >
              <Icon name="close" className="size-3.5" strokeWidth={2.25} />
            </button>
          )}
        </label>
        <Select
          value={equipment}
          onChange={(v) => setEquipment(v as Equipment | "")}
          options={[{ value: "", label: "All equipment" }, ...EQUIPMENT_OPTIONS.map((o) => ({ value: o, label: o }))]}
          ariaLabel="Filter by equipment"
          className="w-28 shrink-0 sm:w-36"
        />
      </div>

      <div className={resultsClassName}>
        {searching ? (
          <div className="rounded-[10px] border border-separator">
            <ExercisePageList
              key={`search|${debouncedTerm}|${equipment}|${version}`}
              {...filters}
              renderExercise={renderExercise}
            />
          </div>
        ) : (
          <MuscleGroupAccordion
            key={`groups|${equipment}`}
            filters={filters}
            renderExercise={renderExercise}
            version={version}
          />
        )}
      </div>
    </div>
  );
}

function MuscleGroupAccordion({
  filters,
  renderExercise,
  version,
}: {
  filters: { term: string; equipment: Equipment | null };
  renderExercise: Props["renderExercise"];
  version: number;
}) {
  const { groups, status, retry } = useExerciseGroups(filters, version);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const visible = (groups ?? []).filter((group) => group.exerciseCount > 0);

  if (status === "error")
    return (
      <p className="px-1 text-sm text-red">
        Couldn&apos;t load muscle groups.{" "}
        <button type="button" onClick={retry} className="font-medium text-link">
          Try again
        </button>
      </p>
    );
  if (!groups)
    return (
      <div className="flex flex-col gap-2" role="status" aria-label="Loading muscle groups">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-11" />
        ))}
      </div>
    );
  if (visible.length === 0) return <p className="px-1 py-6 text-center text-sm text-label-2">No exercises match.</p>;

  return (
    <ul className="divide-y divide-separator rounded-[10px] border border-separator">
      {visible.map((group) => {
        const open = openGroupId === group.id;
        return (
          <li key={group.id}>
            <Disclosure
              open={open}
              onOpenChange={(next) => setOpenGroupId(next ? group.id : null)}
              summaryClassName="px-4 py-3 hover:bg-fill"
              summary={
                <span className="flex items-center justify-between gap-3 pr-1">
                  <span className="text-sm font-semibold">{group.name}</span>
                  <span className="text-xs tabular-nums text-label-3">{group.exerciseCount}</span>
                </span>
              }
            >
              {open && (
                <div className="border-t border-separator">
                  <ExercisePageList
                    key={`${group.id}|${filters.equipment ?? ""}|${version}`}
                    muscleGroupId={group.id}
                    {...filters}
                    renderExercise={renderExercise}
                  />
                </div>
              )}
            </Disclosure>
          </li>
        );
      })}
    </ul>
  );
}
