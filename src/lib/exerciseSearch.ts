// Exercise library search terms. Pure. A term becomes a list of words that must all match an
// exercise's name, equipment or muscle groups (so "db press" finds "Dumbbell Shoulder Press"); the
// matching itself runs in the database (browse_exercises, migration 0028), which normalises
// exercise text the same way as normalize() below.

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

export type Equipment = (typeof EQUIPMENT_OPTIONS)[number];

// Common gym shorthand, expanded before matching.
const ALIASES: Record<string, string> = {
  db: "dumbbell",
  bb: "barbell",
  kb: "kettlebell",
  bw: "bodyweight",
  ohp: "overhead press",
  rdl: "romanian deadlift",
};

// Lowercase, accents and apostrophes dropped ("Farmer's" -> "farmers"), other punctuation to
// single spaces. Keep in step with exercise_search_text in migration 0028 (which doesn't strip
// accents; exercise names are plain ASCII, so only typed terms need it).
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// The words a search term must all match, with shorthand expanded. [] for a blank term.
export function searchWords(term: string): string[] {
  return normalize(term)
    .split(" ")
    .filter(Boolean)
    .flatMap((word) => normalize(ALIASES[word] ?? word).split(" "));
}
