"use client";

import { useId, useState, type ReactNode } from "react";
import { EQUIPMENT_OPTIONS, searchWords, type Equipment } from "@/lib/exerciseSearch";
import type { ExerciseListItem } from "@/lib/exerciseLibrary";
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
      <input
        type="search"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search exercises, muscles or equipment"
        aria-label="Search exercises"
        autoFocus={autoFocus}
        className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-base text-neutral-100 placeholder-neutral-500"
      />
      <select
        value={equipment}
        onChange={(e) => setEquipment(e.target.value as Equipment | "")}
        aria-label="Filter by equipment"
        className="self-start rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-100"
      >
        <option value="">All equipment</option>
        {EQUIPMENT_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      <div className={resultsClassName}>
        {searching ? (
          <ExercisePageList
            key={`search|${debouncedTerm}|${equipment}|${version}`}
            {...filters}
            renderExercise={renderExercise}
          />
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
  const { groups, status } = useExerciseGroups(filters, version);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const baseId = useId();
  const visible = (groups ?? []).filter((group) => group.exerciseCount > 0);

  if (status === "error") return <p className="text-xs text-red-400">Couldn&apos;t load muscle groups.</p>;
  if (!groups) return <p className="text-xs text-neutral-500">Loading muscle groups…</p>;
  if (visible.length === 0) return <p className="text-xs text-neutral-500">No exercises match.</p>;

  return (
    <ul className="flex flex-col gap-2">
      {visible.map((group) => {
        const open = openGroupId === group.id;
        const panelId = `${baseId}-${group.id}`;
        return (
          <li key={group.id} className="rounded-xl border border-neutral-800">
            <button
              type="button"
              onClick={() => setOpenGroupId(open ? null : group.id)}
              aria-expanded={open}
              aria-controls={panelId}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-neutral-200"
            >
              <span>
                {open ? "▾" : "▸"} {group.name}
              </span>
              <span className="text-xs font-normal text-neutral-500">{group.exerciseCount}</span>
            </button>
            {open && (
              <div id={panelId} className="px-4 pb-3">
                <ExercisePageList
                  key={`${group.id}|${filters.equipment ?? ""}|${version}`}
                  muscleGroupId={group.id}
                  {...filters}
                  renderExercise={renderExercise}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
