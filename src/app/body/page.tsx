import Link from "next/link";
import {
  getBodyMeasurements,
  getLastPerformedWorkoutDate,
  getProfile,
  getTrainingConsistency,
  getWeeklyTrainingDays,
} from "@/lib/queries";
import BodyMeasurementsSection from "./BodyMeasurementsSection";
import BodyProgressSummary from "./BodyProgressSummary";
import BodyWeightFacts from "./BodyWeightFacts";
import { summarizeBodyWeight } from "@/lib/analyze/bodyWeight";
import { getTargetWeightKg } from "@/lib/home";
import WeeklyTrainingDays from "./WeeklyTrainingDays";

export default async function BodyPage() {
  const [measurements, training, profile, lastWorkout, weeklyTraining] = await Promise.all([
    getBodyMeasurements(),
    getTrainingConsistency(),
    getProfile(),
    getLastPerformedWorkoutDate(),
    getWeeklyTrainingDays(),
  ]);

  return (
    <main className="px-4 pt-6">
      <Link href="/profile" className="mb-1 inline-block text-sm text-neutral-500">
        ← Profile
      </Link>
      <h1 className="mb-4 text-xl font-bold">Body & Progress</h1>
      <h2 className="mb-2 text-sm font-semibold text-neutral-200">Weight</h2>
      <BodyMeasurementsSection
        measurements={measurements}
        progressSummary={
          <>
            <BodyWeightFacts
              facts={summarizeBodyWeight(measurements)}
              targetWeightKg={getTargetWeightKg(
                profile?.primary_goal ?? null,
                profile?.target_weight_kg ?? null
              )}
            />
            <BodyProgressSummary training={training} lastWorkoutDate={lastWorkout.date} />
            {weeklyTraining.length > 0 && (
              <WeeklyTrainingDays
                weeks={weeklyTraining}
                targetDaysPerWeek={profile?.training_days_per_week ?? null}
              />
            )}
          </>
        }
      />
    </main>
  );
}
