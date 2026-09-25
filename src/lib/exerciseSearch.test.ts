import { describe, expect, it } from "vitest";
import { filterExercises, matchesSearch } from "./exerciseSearch";
import type { Exercise } from "@/lib/types";

const chest = { id: "mg-chest", name: "Chest" };
const shoulders = { id: "mg-shoulders", name: "Shoulders" };
const ex = (name: string, equipment: string | null, muscles = [chest]): Exercise => ({
  id: name,
  user_id: null,
  name,
  equipment,
  notes: null,
  instructions: null,
  muscle_groups: muscles,
});

const library = [
  ex("Barbell Bench Press", "Barbell"),
  ex("Dumbbell Shoulder Press", "Dumbbell", [shoulders]),
  ex("Romanian Deadlift", "Barbell", []),
  ex("Farmer's Carry", "Dumbbell", []),
];

describe("matchesSearch", () => {
  it("matches name, equipment and muscle group, case-insensitively", () => {
    expect(matchesSearch(library[0], "BENCH")).toBe(true);
    expect(matchesSearch(library[1], "dumbbell")).toBe(true);
    expect(matchesSearch(library[1], "shoulders")).toBe(true);
    expect(matchesSearch(library[0], "squat")).toBe(false);
  });

  it("requires every word to match, in any order", () => {
    expect(matchesSearch(library[1], "press shoulder")).toBe(true);
    expect(matchesSearch(library[1], "press chest")).toBe(false);
  });

  it("expands common gym shorthand", () => {
    expect(matchesSearch(library[1], "db press")).toBe(true);
    expect(matchesSearch(library[2], "rdl")).toBe(true);
  });

  it("ignores punctuation and blank terms", () => {
    expect(matchesSearch(library[3], "farmers")).toBe(true);
    expect(matchesSearch(library[3], "   ")).toBe(true);
  });
});

describe("filterExercises", () => {
  it("combines search, muscle group and equipment", () => {
    const names = (list: Exercise[]) => list.map((e) => e.name);
    expect(names(filterExercises(library, { term: "", muscleGroupId: "mg-chest", equipment: null }))).toEqual([
      "Barbell Bench Press",
    ]);
    expect(names(filterExercises(library, { term: "", muscleGroupId: null, equipment: "Barbell" }))).toEqual([
      "Barbell Bench Press",
      "Romanian Deadlift",
    ]);
    expect(names(filterExercises(library, { term: "press", muscleGroupId: null, equipment: "Dumbbell" }))).toEqual([
      "Dumbbell Shoulder Press",
    ]);
  });

  it("returns everything with no filters", () => {
    expect(filterExercises(library, { term: "", muscleGroupId: null, equipment: null })).toHaveLength(4);
  });
});
