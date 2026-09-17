import Link from "next/link";
import {
  getBodyMeasurements,
  getBodyWeightWindow,
  getLastWorkoutDate,
  getProfile,
  getTrainingConsistency,
} from "@/lib/queries";
import BodyMeasurementsSection from "./BodyMeasurementsSection";
import BodyProgressSummary from "./BodyProgressSummary";

export default async function BodyPage() {
  const [measurements, training, weightWindow, profile, lastWorkout] = await Promise.all([
    getBodyMeasurements(),
    getTrainingConsistency(),
    getBodyWeightWindow(),
    getProfile(),
    getLastWorkoutDate(),
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
          <BodyProgressSummary
            training={training}
            weightWindow={weightWindow}
            primaryGoal={profile?.primary_goal ?? null}
            targetWeightKg={profile?.target_weight_kg ?? null}
            lastWorkoutDate={lastWorkout.date}
          />
        }
      />
    </main>
  );
}
