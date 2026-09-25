import type { Exercise } from "@/lib/types";

// Exercise library search and filters — shared by the library page and the log/schedule pickers.
// Pure. A search term matches the exercise name, its equipment or any of its muscle groups, and
// every word of the term must match (so "db press" finds "Dumbbell Shoulder Press").

export const EQUIPMENT_OPTIONS = [
  "Barbell",
  "Dumbbell",
  "Machine",
  "Cable",
  "Bodyweight",
  "Kettlebell",
  "Band",
  "Other",
] as const;

// Common gym shorthand, expanded before matching.
const ALIASES: Record<string, string> = {
  db: "dumbbell",
  bb: "barbell",
  kb: "kettlebell",
  bw: "bodyweight",
  ohp: "overhead press",
  rdl: "romanian deadlift",
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/['’]/g, "") // "Farmer's" -> "farmers"
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function searchText(ex: Exercise): string {
  return normalize([ex.name, ex.equipment ?? "", ...(ex.muscle_groups ?? []).map((m) => m.name)].join(" "));
}

export function matchesSearch(ex: Exercise, term: string): boolean {
  const words = normalize(term)
    .split(" ")
    .filter(Boolean)
    .flatMap((w) => normalize(ALIASES[w] ?? w).split(" "));
  if (words.length === 0) return true;
  const haystack = searchText(ex);
  return words.every((w) => haystack.includes(w));
}

export type ExerciseFilters = { term: string; muscleGroupId: string | null; equipment: string | null };

export function filterExercises(exercises: Exercise[], filters: ExerciseFilters): Exercise[] {
  return exercises.filter(
    (ex) =>
      matchesSearch(ex, filters.term) &&
      (!filters.muscleGroupId || (ex.muscle_groups ?? []).some((m) => m.id === filters.muscleGroupId)) &&
      (!filters.equipment || (ex.equipment ?? "").toLowerCase() === filters.equipment.toLowerCase())
  );
}
