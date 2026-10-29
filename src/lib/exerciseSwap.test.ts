import { describe, expect, it } from "vitest";
import { MAX_SWAP_OPTIONS, rankSwapOptions, type SwapCandidate } from "./exerciseSwap";
import { equipmentAt, type UsualExercise } from "./quickWorkouts";

const candidate = (name: string, equipment: string, exact: boolean): SwapCandidate => ({
  id: name,
  name,
  equipment,
  muscles: [],
  exact,
});
const usual = (name: string, sessions: number): UsualExercise => ({
  id: name,
  name,
  equipment: null,
  muscles: [],
  sessions,
  lastDate: "2026-10-01",
});
const names = (options: { name: string }[]) => options.map((o) => o.name);

// Alternatives to a barbell bench press.
const BENCH_ALTERNATIVES = [
  candidate("Machine Chest Press", "Machine", true),
  candidate("Dumbbell Bench Press", "Dumbbell", true),
  candidate("Decline Push-Up", "Bodyweight", true),
  candidate("Arnold Press", "Dumbbell", false),
  candidate("Diamond Push-Up", "Bodyweight", false),
];

describe("rankSwapOptions", () => {
  it("offers only exact matches when there are enough, by name", () => {
    expect(names(rankSwapOptions(BENCH_ALTERNATIVES, [], null, new Set()))).toEqual([
      "Decline Push-Up",
      "Dumbbell Bench Press",
      "Machine Chest Press",
    ]);
  });

  it("puts the person's usual exercises first, most done first", () => {
    const options = rankSwapOptions(BENCH_ALTERNATIVES, [usual("Machine Chest Press", 5), usual("Dumbbell Bench Press", 2)], null, new Set());
    expect(names(options)).toEqual(["Machine Chest Press", "Dumbbell Bench Press", "Decline Push-Up"]);
  });

  it("falls back to partial matches, exact ones first, when there are too few exact ones", () => {
    const few = [candidate("Dumbbell Bench Press", "Dumbbell", true), candidate("Diamond Push-Up", "Bodyweight", false)];
    expect(names(rankSwapOptions(few, [], null, new Set()))).toEqual(["Dumbbell Bench Press", "Diamond Push-Up"]);
  });

  it("leaves out exercises already in the workout", () => {
    const options = rankSwapOptions(BENCH_ALTERNATIVES, [], null, new Set(["Dumbbell Bench Press"]));
    expect(names(options)).not.toContain("Dumbbell Bench Press");
  });

  it("only offers equipment available where the person trains", () => {
    expect(names(rankSwapOptions(BENCH_ALTERNATIVES, [], equipmentAt("bodyweight"), new Set()))).toEqual([
      "Decline Push-Up",
      "Diamond Push-Up",
    ]);
    expect(names(rankSwapOptions(BENCH_ALTERNATIVES, [], equipmentAt("home_dumbbells"), new Set()))).not.toContain(
      "Machine Chest Press"
    );
  });

  it(`offers at most ${MAX_SWAP_OPTIONS}`, () => {
    const many = Array.from({ length: 10 }, (_, i) => candidate(`Press ${i}`, "Dumbbell", true));
    expect(rankSwapOptions(many, [], null, new Set())).toHaveLength(MAX_SWAP_OPTIONS);
  });

  it("returns only what the logger needs", () => {
    expect(rankSwapOptions([candidate("Dip", "Bodyweight", true)], [], null, new Set())).toEqual([
      { id: "Dip", name: "Dip", equipment: "Bodyweight" },
    ]);
  });

  it("is empty when nothing is similar", () => {
    expect(rankSwapOptions([], [], null, new Set())).toEqual([]);
  });
});
