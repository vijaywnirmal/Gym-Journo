"use client";

import { useRouter } from "next/navigation";
import type { ExerciseOption } from "@/lib/queries";
import Select from "@/components/ui/Select";

// Picks the exercise a History or Progress view is scoped to, kept in the URL so the view can be
// shared and survives a reload. Lists the exercises the person has logged; searchable once long.
export default function ExerciseFilter({
  exercises,
  selectedId,
  basePath = "/history",
  allLabel = "All exercises",
}: {
  exercises: ExerciseOption[];
  selectedId?: string;
  basePath?: string;
  allLabel?: string;
}) {
  const router = useRouter();

  return (
    <Select
      value={selectedId ?? ""}
      onChange={(value) => router.push(value ? `${basePath}?exercise=${value}` : basePath)}
      options={[{ value: "", label: allLabel }, ...exercises.map((ex) => ({ value: ex.id, label: ex.name }))]}
      ariaLabel="Filter by exercise"
      size="lg"
      searchPlaceholder="Search your exercises"
      emptyText="You haven't logged an exercise by that name"
      className="w-full"
    />
  );
}
