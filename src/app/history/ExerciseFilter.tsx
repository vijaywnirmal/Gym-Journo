"use client";

import { useRouter } from "next/navigation";
import type { Exercise } from "@/lib/types";

export default function ExerciseFilter({
  exercises,
  selectedId,
  basePath = "/history",
}: {
  exercises: Exercise[];
  selectedId?: string;
  basePath?: string;
}) {
  const router = useRouter();

  return (
    <select
      defaultValue={selectedId ?? ""}
      onChange={(e) => {
        const value = e.target.value;
        router.push(value ? `${basePath}?exercise=${value}` : basePath);
      }}
      className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-base text-neutral-100"
    >
      <option value="">All exercises</option>
      {exercises.map((ex) => (
        <option key={ex.id} value={ex.id}>
          {ex.name}
        </option>
      ))}
    </select>
  );
}
