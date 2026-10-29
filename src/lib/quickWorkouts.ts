// Built-in short sessions, offered when someone wants to train but has nothing planned (a comeback
// after a break, or an unplanned day). Picking one fills the logger with its exercises and targets;
// nothing is scheduled. Every exercise name must exist in the shared library (migration 0021) — a
// test checks. Pure.

export type QuickExercise = { name: string; sets: number; reps: number };
export type QuickWorkout = {
  id: string;
  name: string;
  summary: string;
  minutes: number;
  equipment: string;
  // Muscle groups the session mostly trains, by library name — used to rank suggestions.
  focus: string[];
  exercises: QuickExercise[];
};

const ex = (name: string, sets: number, reps: number): QuickExercise => ({ name, sets, reps });

export const QUICK_WORKOUTS: QuickWorkout[] = [
  {
    id: "full-body-reset",
    name: "Full-body reset",
    summary: "Two easy sets of the big movements. A good first session back.",
    minutes: 20,
    equipment: "Dumbbells",
    focus: ["Quads", "Chest", "Back", "Glutes", "Core"],
    exercises: [
      ex("Goblet Squat", 2, 10),
      ex("Dumbbell Bench Press", 2, 10),
      ex("Single-Arm Dumbbell Row", 2, 10),
      ex("Glute Bridge", 2, 12),
      ex("Dead Bug", 2, 10),
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
      ex("Push-Up", 3, 10),
      ex("Glute Bridge", 3, 12),
      ex("Mountain Climber", 3, 20),
      ex("Dead Bug", 2, 10),
      ex("Standing Calf Raise", 2, 15),
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
      ex("Dumbbell Shoulder Press", 2, 10),
      ex("Incline Dumbbell Press", 2, 10),
      ex("Single-Arm Dumbbell Row", 3, 10),
      ex("Lateral Raise", 2, 12),
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
      ex("Goblet Squat", 3, 10),
      ex("Walking Lunge", 2, 10),
      ex("Glute Bridge", 2, 12),
      ex("Standing Calf Raise", 2, 15),
    ],
  },
];

export function findQuickWorkout(id: string | undefined | null): QuickWorkout | null {
  return QUICK_WORKOUTS.find((w) => w.id === id) ?? null;
}

// Hard sets per muscle over this week and last, by muscle name — the input to rankQuickWorkouts.
export function recentSetsByMuscle(
  weeks: { thisWeek: { name: string; sets: number }[]; lastWeek: { name: string; sets: number }[] } | null
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of [...(weeks?.thisWeek ?? []), ...(weeks?.lastWeek ?? [])]) {
    totals.set(row.name, (totals.get(row.name) ?? 0) + row.sets);
  }
  return totals;
}

// Suggestions in order: the session whose focus muscles have had the fewest recent sets first, so
// it nudges toward what's been neglected. Ties (including "no recent training at all", the usual
// comeback case) keep the list order, which starts with the full-body reset.
export function rankQuickWorkouts(recentSetsByMuscle: ReadonlyMap<string, number>): QuickWorkout[] {
  const score = (w: QuickWorkout) =>
    w.focus.reduce((total, muscle) => total + (recentSetsByMuscle.get(muscle) ?? 0), 0) / w.focus.length;
  return QUICK_WORKOUTS.map((w, order) => ({ w, order, score: score(w) }))
    .sort((a, b) => a.score - b.score || a.order - b.order)
    .map(({ w }) => w);
}
