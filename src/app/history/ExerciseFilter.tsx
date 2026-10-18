"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import type { Exercise } from "@/lib/types";
import Select from "@/components/ui/Select";

// Picks the exercise a History or Progress view is scoped to, kept in the URL so the view can be
// shared and survives a reload. Searchable, since the library has hundreds of exercises.
export default function ExerciseFilter({
  exercises,
  selectedId,
  basePath = "/history",
  allLabel = "All exercises",
  recentIds = [],
}: {
  exercises: Exercise[];
  selectedId?: string;
  basePath?: string;
  allLabel?: string;
  /** Exercises the person has performed recently, listed first. */
  recentIds?: string[];
}) {
  const router = useRouter();

  const options = useMemo(() => {
    const byId = new Map(exercises.map((ex) => [ex.id, ex]));
    const recent = recentIds.map((id) => byId.get(id)).filter((ex): ex is Exercise => !!ex);
    const recentSet = new Set(recent.map((ex) => ex.id));
    const rest = exercises.filter((ex) => !recentSet.has(ex.id));
    const toOption = (group: string) => (ex: Exercise) => ({
      value: ex.id,
      label: ex.name,
      hint: [ex.muscle_groups?.[0]?.name, ex.equipment].filter(Boolean).join(" · ") || undefined,
      group,
    });
    return [
      { value: "", label: allLabel },
      ...recent.map(toOption("Recently performed")),
      ...rest.map(toOption(recent.length ? "All exercises" : "")),
    ];
  }, [exercises, recentIds, allLabel]);

  return (
    <Select
      value={selectedId ?? ""}
      onChange={(value) => router.push(value ? `${basePath}?exercise=${value}` : basePath)}
      options={options}
      ariaLabel="Exercise"
      size="lg"
      searchable
      searchPlaceholder="Search exercises"
      className="w-full"
    />
  );
}
