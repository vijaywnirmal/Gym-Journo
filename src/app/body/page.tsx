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
import { getToday } from "@/lib/userDate";
import BackLink from "@/components/BackLink";

export default async function BodyPage() {
  const [todayStr, measurements, training, profile, lastWorkout, weeklyTraining] = await Promise.all([
    getToday(),
    getBodyMeasurements(),
    getTrainingConsistency(),
    getProfile(),
    getLastPerformedWorkoutDate(),
    getWeeklyTrainingDays(),
  ]);

  return (
    <main className="screen-enter px-4 pt-4">
      <BackLink href="/profile" label="Profile" />
      <h1 className="mb-4 large-title">Body & Progress</h1>
      <h2 className="mb-2 text-base font-semibold text-label">Weight</h2>
      <BodyMeasurementsSection
        measurements={measurements}
        todayStr={todayStr}
        progressSummary={
          <>
            <BodyWeightFacts
              facts={summarizeBodyWeight(measurements, todayStr)}
              targetWeightKg={getTargetWeightKg(
                profile?.primary_goal ?? null,
                profile?.target_weight_kg ?? null
              )}
            />
            <BodyProgressSummary
              training={training}
              lastWorkoutDate={lastWorkout.date}
              todayStr={todayStr}
            />
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
