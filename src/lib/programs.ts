import { parseISO } from "date-fns";
import { shiftDate } from "@/lib/date";

// Built-in multi-week programs (M9). Each program is a rotation of workout days; applying it lays
// the rotation onto the chosen weekdays for N weeks. The rotation continues across weeks (it does
// not restart each Monday), so a 3-day-a-week Push/Pull/Legs or an A/B full-body split alternates
// correctly. Every exercise name must exist in the shared library (migration 0021) — a test checks.
//
// No percentage-based programs (e.g. 5/3/1): they need a training max the app doesn't store yet.

export type ProgramExercise = { name: string; sets: number; reps: number };
export type ProgramDay = { title: string; exercises: ProgramExercise[] };
export type Program = {
  id: string;
  name: string;
  summary: string;
  level: "Beginner" | "Intermediate";
  defaultWeekdays: number[]; // 0 = Sunday … 6 = Saturday
  defaultWeeks: number;
  days: ProgramDay[];
};

const ex = (name: string, sets: number, reps: number): ProgramExercise => ({ name, sets, reps });

export const PROGRAMS: Program[] = [
  {
    id: "full-body-ab",
    name: "Full Body A/B",
    summary: "Three full-body sessions a week alternating two workouts. Simple, effective start for strength and muscle.",
    level: "Beginner",
    defaultWeekdays: [1, 3, 5],
    defaultWeeks: 8,
    days: [
      {
        title: "Full Body A",
        exercises: [ex("Back Squat", 3, 5), ex("Barbell Bench Press", 3, 5), ex("Barbell Row", 3, 8), ex("Dumbbell Curl", 2, 12)],
      },
      {
        title: "Full Body B",
        exercises: [ex("Deadlift", 3, 5), ex("Overhead Press", 3, 5), ex("Lat Pulldown", 3, 10), ex("Hip Thrust", 3, 10)],
      },
    ],
  },
  {
    id: "upper-lower",
    name: "Upper / Lower",
    summary: "Four days a week: two upper-body and two lower-body sessions, one heavier and one higher-rep each.",
    level: "Intermediate",
    defaultWeekdays: [1, 2, 4, 5],
    defaultWeeks: 8,
    days: [
      {
        title: "Upper (Strength)",
        exercises: [ex("Barbell Bench Press", 4, 5), ex("Barbell Row", 4, 6), ex("Overhead Press", 3, 6), ex("Chin-Up", 3, 8)],
      },
      {
        title: "Lower (Strength)",
        exercises: [ex("Back Squat", 4, 5), ex("Romanian Deadlift", 3, 8), ex("Leg Press", 3, 10), ex("Standing Calf Raise", 3, 12)],
      },
      {
        title: "Upper (Volume)",
        exercises: [
          ex("Incline Dumbbell Press", 3, 10),
          ex("Seated Cable Row", 3, 12),
          ex("Lateral Raise", 3, 15),
          ex("Tricep Pushdown", 3, 12),
          ex("Hammer Curl", 3, 12),
        ],
      },
      {
        title: "Lower (Volume)",
        exercises: [ex("Deadlift", 3, 5), ex("Bulgarian Split Squat", 3, 10), ex("Leg Curl", 3, 12), ex("Hanging Leg Raise", 3, 12)],
      },
    ],
  },
  {
    id: "push-pull-legs",
    name: "Push / Pull / Legs",
    summary: "Six days a week (or three, for a slower rotation): chest-shoulders-triceps, back-biceps, and legs.",
    level: "Intermediate",
    defaultWeekdays: [1, 2, 3, 4, 5, 6],
    defaultWeeks: 6,
    days: [
      {
        title: "Push",
        exercises: [
          ex("Barbell Bench Press", 4, 6),
          ex("Overhead Press", 3, 8),
          ex("Incline Dumbbell Press", 3, 10),
          ex("Lateral Raise", 3, 15),
          ex("Tricep Pushdown", 3, 12),
        ],
      },
      {
        title: "Pull",
        exercises: [
          ex("Deadlift", 3, 5),
          ex("Pull-Up", 3, 8),
          ex("Barbell Row", 3, 8),
          ex("Face Pull", 3, 15),
          ex("Dumbbell Curl", 3, 12),
        ],
      },
      {
        title: "Legs",
        exercises: [
          ex("Back Squat", 4, 6),
          ex("Romanian Deadlift", 3, 8),
          ex("Leg Press", 3, 10),
          ex("Leg Curl", 3, 12),
          ex("Calf Raise", 4, 12),
        ],
      },
    ],
  },
  {
    id: "gzclp-style",
    name: "Tiered Linear (GZCLP-style)",
    summary: "Four days a week. Each day: a heavy main lift (5×3), a secondary lift (3×10) and an accessory (3×15).",
    level: "Beginner",
    defaultWeekdays: [1, 2, 4, 5],
    defaultWeeks: 12,
    days: [
      { title: "Day 1 · Squat", exercises: [ex("Back Squat", 5, 3), ex("Barbell Bench Press", 3, 10), ex("Lat Pulldown", 3, 15)] },
      { title: "Day 2 · Press", exercises: [ex("Overhead Press", 5, 3), ex("Deadlift", 3, 10), ex("Single-Arm Dumbbell Row", 3, 15)] },
      { title: "Day 3 · Bench", exercises: [ex("Barbell Bench Press", 5, 3), ex("Back Squat", 3, 10), ex("Lat Pulldown", 3, 15)] },
      { title: "Day 4 · Deadlift", exercises: [ex("Deadlift", 5, 3), ex("Overhead Press", 3, 10), ex("Single-Arm Dumbbell Row", 3, 15)] },
    ],
  },
];

export const MIN_PROGRAM_WEEKS = 1;
export const MAX_PROGRAM_WEEKS = 16;

export function findProgram(id: string): Program | null {
  return PROGRAMS.find((p) => p.id === id) ?? null;
}

export type ScheduledProgramDay = { date: string; day: ProgramDay; dayIndex: number };

// Lays the program onto `weekdays` for `weeks` weeks starting at `startDate` (inclusive): the
// first matching weekday on or after the start date gets the program's first day, and so on.
// Weekdays are deduplicated; invalid ones are ignored.
export function buildProgramSchedule(
  program: Program,
  startDate: string,
  weekdays: number[],
  weeks: number
): ScheduledProgramDay[] {
  const days = new Set(weekdays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6));
  if (days.size === 0 || program.days.length === 0 || weeks < 1) return [];

  const result: ScheduledProgramDay[] = [];
  for (let offset = 0; offset < weeks * 7; offset++) {
    const date = shiftDate(startDate, offset);
    if (!days.has(parseISO(date).getDay())) continue;
    const dayIndex = result.length % program.days.length;
    result.push({ date, day: program.days[dayIndex], dayIndex });
  }
  return result;
}

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
