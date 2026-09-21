// Shared fixture for the Coach tests only — never imported by app code.
import { buildTrainingEvidence, type TrainingEvidence } from "@/lib/analyze/evidence";

// As of Monday 2026-09-21. Bench: sessions Sep 18 (80×8, 80×7) and Sep 11 (80×6, 80×7), 7 days
// apart; body weight 70 kg on Jul 2 and 72 kg on Sep 18 with a 75 kg target; 4 training days/week.
export function coachEvidence(): TrainingEvidence {
  return buildTrainingEvidence({
    todayStr: "2026-09-21",
    profile: {
      primary_goal: "build_muscle",
      experience_level: "intermediate",
      training_days_per_week: 4,
      target_weight_kg: 75,
    },
    performedDates: ["2026-09-11", "2026-09-15", "2026-09-18"],
    lastPerformedWorkoutDate: "2026-09-18",
    bodyMeasurements: [
      { date: "2026-07-02", weight_kg: 70 },
      { date: "2026-09-18", weight_kg: 72 },
    ],
    exercises: [
      {
        exerciseId: "ex-bench",
        name: "Bench Press",
        sessions: [
          {
            date: "2026-09-18",
            sets: [
              { setNumber: 1, reps: 8, weight: 80, weightUnit: "kg" },
              { setNumber: 2, reps: 7, weight: 80, weightUnit: "kg" },
            ],
          },
          {
            date: "2026-09-11",
            sets: [
              { setNumber: 1, reps: 6, weight: 80, weightUnit: "kg" },
              { setNumber: 2, reps: 7, weight: 80, weightUnit: "kg" },
            ],
          },
        ],
      },
    ],
    exercisesTruncated: false,
  });
}

export const BENCH_ID = "exercise.ex-bench";
