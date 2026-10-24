import type { Metadata } from "next";
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
import PageHeader from "@/components/PageHeader";
import { requireMemberApp } from "@/lib/workAccount";

export const metadata: Metadata = { title: "Body" };

export default async function BodyPage() {
  await requireMemberApp();
  const [todayStr, measurements, training, profile, lastWorkout, weeklyTraining] = await Promise.all([
    getToday(),
    getBodyMeasurements(),
    getTrainingConsistency(),
    getProfile(),
    getLastPerformedWorkoutDate(),
    getWeeklyTrainingDays(),
  ]);

  // Weeks that ended before the account existed can't have been missed.
  const signUpDate = profile?.created_at?.slice(0, 10) ?? null;
  const weeksSinceSignUp = signUpDate ? weeklyTraining.filter((week) => week.weekEnd >= signUpDate) : weeklyTraining;

  return (
    <main className="px-4 pt-6 md:px-8 md:pt-10">
      <PageHeader
        title="Body"
        subtitle="Body weight and how consistently you train."
        back={{ href: "/profile", label: "Profile" }}
      />
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
            {weeksSinceSignUp.length > 0 && (
              <WeeklyTrainingDays
                weeks={weeksSinceSignUp}
                targetDaysPerWeek={profile?.training_days_per_week ?? null}
              />
            )}
          </>
        }
      />
    </main>
  );
}
