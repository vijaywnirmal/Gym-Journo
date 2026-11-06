import { addWeeks, format } from "date-fns";
import type { TrendPoint } from "@/components/TrendChart";

// Sample data for the front door's previews and the demo (/demo). Nobody's real records: a made-up
// lifter, Asha, four sessions a week. Everything shown is something the app really does.

export const DEMO_NAME = "Asha";

export type DemoDay = { day: string; label: string; status: "done" | "rest" | "today" | "planned" };

export const DEMO_WEEK: DemoDay[] = [
  { day: "Mon", label: "Push", status: "done" },
  { day: "Tue", label: "Rest", status: "rest" },
  { day: "Wed", label: "Pull", status: "done" },
  { day: "Thu", label: "Rest", status: "rest" },
  { day: "Fri", label: "Legs", status: "today" },
  { day: "Sat", label: "Upper", status: "planned" },
  { day: "Sun", label: "Rest", status: "rest" },
];

export type DemoSet = { weight: number; reps: number; previous: string; record?: boolean };
export type DemoExercise = { name: string; sets: DemoSet[] };

// Monday's push day, as logged, with last week's sets beside each one.
export const DEMO_WORKOUT: { title: string; day: string; exercises: DemoExercise[] } = {
  title: "Push",
  day: "Monday",
  exercises: [
    {
      name: "Bench press",
      sets: [
        { weight: 60, reps: 8, previous: "60 × 8" },
        { weight: 62.5, reps: 8, previous: "60 × 8", record: true },
        { weight: 62.5, reps: 7, previous: "60 × 7" },
      ],
    },
    {
      name: "Overhead press",
      sets: [
        { weight: 40, reps: 8, previous: "37.5 × 8" },
        { weight: 40, reps: 8, previous: "37.5 × 8" },
        { weight: 40, reps: 6, previous: "37.5 × 7" },
      ],
    },
    {
      name: "Incline dumbbell press",
      sets: [
        { weight: 22, reps: 10, previous: "20 × 10" },
        { weight: 22, reps: 9, previous: "20 × 10" },
      ],
    },
  ],
};

// Today's plan.
export const DEMO_PLAN = {
  title: "Legs",
  exercises: ["Back squat · 4 × 6", "Romanian deadlift · 3 × 8", "Walking lunge · 3 × 10", "Calf raise · 3 × 15"],
};

// Bench press, best estimated one-rep max per week, for the last eight weeks up to today.
const BENCH_E1RM = [70, 71.5, 71.5, 73, 74, 75.5, 77, 78.5];
export function demoBenchTrend(today: Date = new Date()): TrendPoint[] {
  return BENCH_E1RM.map((value, i) => ({
    date: format(addWeeks(today, i - (BENCH_E1RM.length - 1)), "yyyy-MM-dd"),
    value,
  }));
}

export const DEMO_RECORDS = [
  { exercise: "Bench press", record: "62.5 kg × 8", when: "Monday" },
  { exercise: "Back squat", record: "90 kg × 6", when: "Last Friday" },
  { exercise: "Pull-up", record: "Bodyweight × 10", when: "Wednesday" },
];

export const DEMO_COACH = {
  question: "Is my bench still going up?",
  answer:
    "Yes. Your best bench press set went from 60 kg × 8 four weeks ago to 62.5 kg × 8 on Monday, and your estimated one-rep max rose from 73 kg to 78.5 kg.",
  evidence: "From your logs: 8 bench press sessions in the last 8 weeks.",
};
