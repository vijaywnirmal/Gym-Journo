// Built-in short sessions, offered when someone wants to train but has nothing planned (a comeback
// after a break, or an unplanned day). Picking one fills the logger with its exercises and targets;
// nothing is scheduled. Every exercise name must exist in the shared library (migration 0021) — a
// test checks. Pure.
//
// Each person sees them made their own: ranked by what they've trained least over the last
// HISTORY_WEEKS, with their usual exercises swapped in where one does the same job, and a target
// weight from their last time (lighter after a break).

import { lighterWeight } from "@/lib/analyze/comeback";

// muscle: the main muscle group the slot trains, by library name. A usual exercise can take the
// slot only if it trains that muscle too (see personaliseQuickWorkout).
export type QuickExercise = { name: string; sets: number; reps: number; muscle: string };
export type QuickWorkout = {
  id: string;
  name: string;
  summary: string;
  minutes: number;
  // "None" means bodyweight only: only bodyweight exercises are swapped in.
  equipment: string;
  // Muscle groups the session mostly trains, by library name — used to rank suggestions.
  focus: string[];
  exercises: QuickExercise[];
};

// How far back ranking and "usual exercises" look. Long enough that a few weeks off still leaves
// the person's habits to go on.
export const HISTORY_WEEKS = 8;
// Sessions in HISTORY_WEEKS that make an exercise one of the person's usual ones.
export const MIN_USUAL_SESSIONS = 2;

const ex = (name: string, sets: number, reps: number, muscle: string): QuickExercise => ({ name, sets, reps, muscle });

export const QUICK_WORKOUTS: QuickWorkout[] = [
  {
    id: "full-body-reset",
    name: "Full-body reset",
    summary: "Two easy sets of the big movements. A good first session back.",
    minutes: 20,
    equipment: "Dumbbells",
    focus: ["Quads", "Chest", "Back", "Glutes", "Core"],
    exercises: [
      ex("Goblet Squat", 2, 10, "Quads"),
      ex("Dumbbell Bench Press", 2, 10, "Chest"),
      ex("Single-Arm Dumbbell Row", 2, 10, "Back"),
      ex("Glute Bridge", 2, 12, "Glutes"),
      ex("Dead Bug", 2, 10, "Core"),
    ],
  },
  {
    id: "no-equipment",
    name: "No-equipment circuit",
    summary: "Bodyweight only, for home or a busy gym.",
    minutes: 15,
    equipment: "None",
    focus: ["Chest", "Glutes", "Core", "Cardio", "Calves"],
    exercises: [
      ex("Push-Up", 3, 10, "Chest"),
      ex("Glute Bridge", 3, 12, "Glutes"),
      ex("Mountain Climber", 3, 20, "Core"),
      ex("Dead Bug", 2, 10, "Core"),
      ex("Standing Calf Raise", 2, 15, "Calves"),
    ],
  },
  {
    id: "upper-express",
    name: "Upper-body express",
    summary: "Press, pull and shoulders in four moves.",
    minutes: 20,
    equipment: "Dumbbells",
    focus: ["Shoulders", "Chest", "Back"],
    exercises: [
      ex("Dumbbell Shoulder Press", 2, 10, "Shoulders"),
      ex("Incline Dumbbell Press", 2, 10, "Chest"),
      ex("Single-Arm Dumbbell Row", 3, 10, "Back"),
      ex("Lateral Raise", 2, 12, "Shoulders"),
    ],
  },
  {
    id: "lower-express",
    name: "Lower-body express",
    summary: "Squat, lunge and hinge without a barbell.",
    minutes: 20,
    equipment: "Dumbbells",
    focus: ["Quads", "Glutes", "Hamstrings", "Calves"],
    exercises: [
      ex("Goblet Squat", 3, 10, "Quads"),
      ex("Walking Lunge", 2, 10, "Quads"),
      ex("Glute Bridge", 2, 12, "Glutes"),
      ex("Standing Calf Raise", 2, 15, "Calves"),
    ],
  },
];

// Every exercise name the sessions use, for looking them up in the library.
export const QUICK_EXERCISE_NAMES = [...new Set(QUICK_WORKOUTS.flatMap((w) => w.exercises.map((e) => e.name)))];

// Hard sets per muscle group, by name — the input to rankQuickWorkouts.
export function toSetsByMuscle(rows: { name: string; sets: number }[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(row.name, (totals.get(row.name) ?? 0) + row.sets);
  return totals;
}

// Suggestions in order: the session whose focus muscles have had the fewest sets over the last
// HISTORY_WEEKS first, so it nudges toward what's been neglected. After a break (familiarFirst),
// the session with the most of the person's usual exercises comes first instead — familiar moves
// make it easier to come back — and neglect only breaks ties. Remaining ties (including someone
// with no history yet) keep the list order, which starts with the full-body reset.
export function rankQuickWorkouts<W extends Pick<QuickWorkout, "focus"> & { usualCount?: number }>(
  workouts: W[],
  setsByMuscle: ReadonlyMap<string, number>,
  familiarFirst = false
): W[] {
  const score = (w: W) => w.focus.reduce((total, muscle) => total + (setsByMuscle.get(muscle) ?? 0), 0) / w.focus.length;
  const familiarity = (w: W) => (familiarFirst ? (w.usualCount ?? 0) : 0);
  return workouts
    .map((w, order) => ({ w, order, score: score(w), familiar: familiarity(w) }))
    .sort((a, b) => b.familiar - a.familiar || a.score - b.score || a.order - b.order)
    .map(({ w }) => w);
}

export type ExerciseInfo = { id: string; name: string; equipment: string | null; muscles: string[] };
// An exercise the person has done in at least MIN_USUAL_SESSIONS sessions over HISTORY_WEEKS.
export type UsualExercise = ExerciseInfo & { sessions: number; lastDate: string };

export type PersonalExercise = {
  exerciseId: string;
  name: string;
  sets: number;
  reps: number;
  // One of the person's usual exercises (the session's own, or one swapped in).
  usual: boolean;
};
export type PersonalQuickWorkout = Omit<QuickWorkout, "exercises"> & {
  exercises: PersonalExercise[];
  equipmentLabel: string;
  usualCount: number;
};

// Most sessions first, then most recent.
export function sortUsual(usual: UsualExercise[]): UsualExercise[] {
  return [...usual].sort((a, b) => b.sessions - a.sessions || b.lastDate.localeCompare(a.lastDate));
}

// A usual exercise does the same job as a slot's exercise when it trains the slot's main muscle and
// nothing the slot's exercise doesn't (so a deadlift can't stand in for a row). A bodyweight-only
// session only takes bodyweight exercises.
function canStandIn(usual: UsualExercise, slot: QuickExercise, base: ExerciseInfo, bodyweightOnly: boolean): boolean {
  if (bodyweightOnly && usual.equipment !== "Bodyweight") return false;
  return usual.muscles.includes(slot.muscle) && usual.muscles.every((m) => base.muscles.includes(m));
}

// The session with the person's usual exercises swapped in where one does the same job, each used
// at most once. Slots whose exercise isn't in the library are left out. `usual` must be sorted by
// sortUsual.
export function personaliseQuickWorkout(
  workout: QuickWorkout,
  library: ReadonlyMap<string, ExerciseInfo>,
  usual: UsualExercise[]
): PersonalQuickWorkout {
  const usualIds = new Set(usual.map((u) => u.id));
  const taken = new Set(workout.exercises.map((e) => library.get(e.name)?.id).filter((id): id is string => !!id));
  const equipment = new Set<string>();
  const exercises: PersonalExercise[] = [];

  for (const slot of workout.exercises) {
    const base = library.get(slot.name);
    if (!base) continue;
    const swap = usualIds.has(base.id)
      ? null
      : usual.find((u) => !taken.has(u.id) && canStandIn(u, slot, base, workout.equipment === "None"));
    const chosen = swap ?? base;
    if (swap) taken.add(swap.id);
    if (chosen.equipment && chosen.equipment !== "Bodyweight") equipment.add(chosen.equipment);
    exercises.push({
      exerciseId: chosen.id,
      name: chosen.name,
      sets: slot.sets,
      reps: slot.reps,
      usual: !!swap || usualIds.has(base.id),
    });
  }

  return {
    ...workout,
    exercises,
    equipmentLabel: equipmentLabel([...equipment]),
    usualCount: exercises.filter((e) => e.usual).length,
  };
}

const PLURAL_EQUIPMENT: Record<string, string> = { Dumbbell: "Dumbbells", Band: "Bands", Machine: "Machines" };

export function equipmentLabel(equipment: string[]): string {
  if (equipment.length === 0) return "No equipment";
  return equipment.map((e) => PLURAL_EQUIPMENT[e] ?? e).join(", ");
}

// A target weight from last time: the heaviest working set, ~90% of it after a break (as the
// lighter session does). Null when last time had no weights.
export function quickTargetWeight(
  lastSets: { weight: number | null; weightUnit: string; setType?: string }[],
  lighter: boolean
): { weight: number; unit: string } | null {
  const working = lastSets.filter((s) => s.setType !== "warmup" && s.weight !== null && s.weight > 0);
  if (working.length === 0) return null;
  const top = working.reduce((a, b) => ((b.weight ?? 0) > (a.weight ?? 0) ? b : a));
  const weight = top.weight as number;
  return { weight: lighter ? lighterWeight(weight, top.weightUnit) : weight, unit: top.weightUnit };
}
