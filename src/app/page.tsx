import Link from "next/link";
import {
  getLastCompletedLog,
  getLogForDate,
  getPlanForDate,
  getProfile,
  getTrainingConsistency,
  getWeeklyInsights,
  getAdaptSuggestions,
} from "@/lib/queries";
import WeeklyInsightsCard from "@/components/WeeklyInsightsCard";
import { formatDate, hourIn, todayIn } from "@/lib/date";
import { getUserTimeZone } from "@/lib/userDate";
import { namePartsOf } from "@/lib/names";
import {
  formatGoalSummary,
  formatPlannedExercise,
  formatTrainingFrequency,
  getGreeting,
  getWorkoutCta,
} from "@/lib/home";
import SignOutButton from "@/components/SignOutButton";

const TRAINING_FREQUENCY_WINDOW_DAYS = 7;

export default async function TodayPage() {
  const { timeZone } = await getUserTimeZone();
  const date = todayIn(timeZone);
  const [profile, plan, log, trainingConsistency, weeklyInsights, suggestions] = await Promise.all([
    getProfile(),
    getPlanForDate(date),
    getLogForDate(date),
    getTrainingConsistency(TRAINING_FREQUENCY_WINDOW_DAYS),
    getWeeklyInsights(),
    getAdaptSuggestions(),
  ]);

  const greeting = getGreeting(profile ? namePartsOf(profile).firstName : null, hourIn(timeZone));
  const goalSummary = profile ? formatGoalSummary(profile) : null;
  const trainingFrequency = formatTrainingFrequency(
    profile?.training_days_per_week ?? null,
    trainingConsistency.daysPerformed,
    trainingConsistency.windowDays
  );
  const cta = getWorkoutCta(date, !!log, !!log?.completed_at);

  const goalDaysPerWeek = profile?.training_days_per_week ?? null;

  const hasNothingToday = !plan && !log;
  const recentActivity = hasNothingToday ? await getLastCompletedLog() : null;

  return (
    <main className="px-4 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-neutral-500">{formatDate(date)}</p>
          <h1 className="text-xl font-bold">{greeting}</h1>
        </div>
        <SignOutButton />
      </div>

      {goalSummary && (
        <div className="mb-4 rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3">
          <p className="text-sm font-medium text-neutral-100">{goalSummary.goalLine}</p>
          {goalSummary.targetLine && (
            <p className="text-xs text-neutral-400">{goalSummary.targetLine}</p>
          )}
        </div>
      )}

      {trainingFrequency && (
        <div className="mb-4 rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3">
          <p className="text-xs font-medium text-neutral-500">Training frequency</p>
          <p className="text-sm text-neutral-100">{trainingFrequency.actualLine}</p>
          <p className="text-xs text-neutral-400">{trainingFrequency.goalLine}</p>
        </div>
      )}

      {suggestions.length > 0 && (
        <Link
          href="/suggestions"
          className="mb-4 flex items-center justify-between rounded-xl border border-green-900 bg-green-950/30 p-4"
        >
          <span className="text-sm font-medium text-green-300">
            💡 {suggestions.length} weight suggestion{suggestions.length === 1 ? "" : "s"} for upcoming workouts
          </span>
          <span className="text-green-500">→</span>
        </Link>
      )}

      {weeklyInsights && <WeeklyInsightsCard insights={weeklyInsights} goalDaysPerWeek={goalDaysPerWeek} />}

      {plan?.is_rest_day ? (
        <div className="mb-4 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-semibold text-neutral-100">😴 Rest day</h2>
            <Link href={`/schedule/${date}`} className="text-xs text-neutral-400 underline">
              Edit
            </Link>
          </div>
          {plan.title && <p className="text-sm text-neutral-400">{plan.title}</p>}
        </div>
      ) : plan ? (
        <div className="mb-4 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold text-neutral-100">{plan.title ?? "Scheduled workout"}</h2>
            <Link href={`/schedule/${date}`} className="text-xs text-neutral-400 underline">
              Edit
            </Link>
          </div>
          {plan.muscle_groups && plan.muscle_groups.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {plan.muscle_groups.map((mg) => (
                <span
                  key={mg.id}
                  className="rounded-full bg-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-200"
                >
                  {mg.name}
                </span>
              ))}
            </div>
          )}
          {plan.planned_exercises && plan.planned_exercises.length > 0 && (
            <p className="mb-2 text-xs text-neutral-500">
              {plan.planned_exercises.length} exercise
              {plan.planned_exercises.length === 1 ? "" : "s"}
            </p>
          )}
          <ul className="mb-4 flex flex-col gap-1 text-sm text-neutral-300">
            {plan.planned_exercises?.map((pe) => (
              <li key={pe.id}>
                {formatPlannedExercise({
                  name: pe.exercise?.name ?? "Exercise",
                  targetSets: pe.target_sets,
                  targetReps: pe.target_reps,
                  // `?? null`/`?? "kg"`: before migration 0017 is applied, these columns don't exist
                  // yet and Supabase omits them rather than returning null.
                  targetWeight: pe.target_weight ?? null,
                  targetWeightUnit: pe.target_weight_unit ?? "kg",
                })}
              </li>
            ))}
          </ul>
          {log?.completed_at && (
            <p className="mb-2 text-xs text-green-400">Completed ✓</p>
          )}
          <Link
            href={cta.href}
            className="block rounded-lg bg-white px-4 py-2.5 text-center text-sm font-medium text-neutral-900"
          >
            {cta.label}
          </Link>
        </div>
      ) : (
        <div className="mb-4 rounded-xl border border-dashed border-neutral-700 p-4 text-center">
          <p className="mb-3 text-sm text-neutral-400">Nothing scheduled for today.</p>
          <div className="flex flex-col gap-2">
            <Link
              href={`/schedule/${date}`}
              className="rounded-lg border border-neutral-700 px-4 py-2.5 text-sm font-medium text-neutral-100"
            >
              Schedule today
            </Link>
            <Link
              href={cta.href}
              className="rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-neutral-900"
            >
              {log ? cta.label : "Log a freeform workout"}
            </Link>
            <Link href="/programs" className="text-xs text-neutral-400 underline">
              Or follow a program
            </Link>
          </div>
        </div>
      )}

      {recentActivity && (
        <p className="mb-4 text-center text-xs text-neutral-500">
          Last completed workout: {recentActivity.title ?? "Freeform workout"} · {formatDate(recentActivity.date)}
        </p>
      )}

      <Link
        href="/coach"
        className="mb-4 flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 p-4"
      >
        <span className="text-sm font-medium text-neutral-100">🧭 What changed? Ask Coach</span>
        <span className="text-neutral-500">→</span>
      </Link>

      <Link
        href="/ai-plan"
        className="mb-4 flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 p-4"
      >
        <span className="text-sm font-medium text-neutral-100">✨ Get an AI diet & workout plan</span>
        <span className="text-neutral-500">→</span>
      </Link>
    </main>
  );
}
