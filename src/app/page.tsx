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
import Icon, { type IconName } from "@/components/Icon";

const TRAINING_FREQUENCY_WINDOW_DAYS = 7;

// One row of an inset grouped list: tinted icon tile, label, chevron.
function ListRow({ href, icon, iconBg, label }: { href: string; icon: IconName; iconBg: string; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-xl px-4 py-3 active:bg-fill">
      <span className={`grid size-7 place-items-center rounded-lg text-white ${iconBg}`}>
        <Icon name={icon} className="size-[18px]" strokeWidth={2} />
      </span>
      <span className="flex-1 text-base text-label">{label}</span>
      <Icon name="chevronRight" className="size-4 text-label-3" strokeWidth={2.25} />
    </Link>
  );
}

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
    <main className="screen-enter px-4 pt-4">
      <header className="mb-5 flex items-end justify-between px-1">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-label-2">{formatDate(date)}</p>
          <h1 className="large-title">{greeting}</h1>
        </div>
        <SignOutButton />
      </header>

      {plan?.is_rest_day ? (
        <section className="mb-4 rounded-xl bg-surface p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-teal/15 text-teal">
              <Icon name="moon" className="size-5" strokeWidth={2} />
            </span>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-label">Rest day</h2>
              {plan.title && <p className="text-sm text-label-2">{plan.title}</p>}
            </div>
            <Link href={`/schedule/${date}`} className="text-base text-tint">
              Edit
            </Link>
          </div>
        </section>
      ) : plan ? (
        <section className="mb-4 rounded-xl bg-surface p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-tint">Today&apos;s workout</p>
              <h2 className="text-2xl font-bold text-label">{plan.title ?? "Scheduled workout"}</h2>
            </div>
            <Link href={`/schedule/${date}`} className="pt-1 text-base text-tint">
              Edit
            </Link>
          </div>
          {plan.muscle_groups && plan.muscle_groups.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {plan.muscle_groups.map((mg) => (
                <span key={mg.id} className="rounded-full bg-fill px-2.5 py-1 text-xs font-medium text-label">
                  {mg.name}
                </span>
              ))}
            </div>
          )}
          {plan.planned_exercises && plan.planned_exercises.length > 0 && (
            <>
              <p className="mb-1 text-xs font-medium text-label-2">
                {plan.planned_exercises.length} exercise
                {plan.planned_exercises.length === 1 ? "" : "s"}
              </p>
              <ul className="mb-5 divide-y divide-separator text-sm text-label">
                {plan.planned_exercises.map((pe) => (
                  <li key={pe.id} className="py-2">
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
            </>
          )}
          {log?.completed_at && (
            <p className="mb-3 flex items-center gap-1.5 text-sm font-medium text-green">
              <Icon name="checkmark" className="size-4" strokeWidth={2.5} />
              Completed
            </p>
          )}
          <Link
            href={cta.href}
            className="block rounded-lg bg-tint px-4 py-3.5 text-center text-base font-semibold text-white"
          >
            {cta.label}
          </Link>
        </section>
      ) : (
        <section className="mb-4 rounded-xl bg-surface p-5 text-center">
          <span className="mx-auto mb-2 grid size-12 place-items-center rounded-full bg-fill text-label-2">
            <Icon name="calendar" className="size-6" />
          </span>
          <h2 className="text-xl font-semibold text-label">Nothing scheduled</h2>
          <p className="mb-4 text-sm text-label-2">Plan today, follow a program, or just start lifting.</p>
          <div className="flex flex-col gap-2">
            <Link
              href={cta.href}
              className="rounded-lg bg-tint px-4 py-3.5 text-base font-semibold text-white"
            >
              {log ? cta.label : "Log a freeform workout"}
            </Link>
            <Link
              href={`/schedule/${date}`}
              className="rounded-lg bg-fill px-4 py-3.5 text-base font-semibold text-tint"
            >
              Schedule today
            </Link>
            <Link href="/programs" className="py-2 text-sm text-tint">
              Or follow a program
            </Link>
          </div>
        </section>
      )}

      {recentActivity && (
        <p className="mb-4 px-1 text-center text-xs text-label-2">
          Last completed workout: {recentActivity.title ?? "Freeform workout"} · {formatDate(recentActivity.date)}
        </p>
      )}

      {suggestions.length > 0 && (
        <Link href="/suggestions" className="mb-4 flex items-center gap-3 rounded-xl bg-green/12 px-4 py-3.5">
          <Icon name="lightbulb" className="size-5 text-green" strokeWidth={2} />
          <span className="flex-1 text-sm font-medium text-label">
            {suggestions.length} weight suggestion{suggestions.length === 1 ? "" : "s"} for upcoming workouts
          </span>
          <Icon name="chevronRight" className="size-4 text-label-3" strokeWidth={2.25} />
        </Link>
      )}

      {(goalSummary || trainingFrequency) && (
        <section className="mb-4 grid grid-cols-2 gap-3">
          {goalSummary && (
            <div className={`rounded-xl bg-surface px-4 py-3 ${trainingFrequency ? "" : "col-span-2"}`}>
              <p className="mb-1 text-xs font-medium text-label-2">Goal</p>
              <p className="text-sm font-semibold text-label">{goalSummary.goalLine}</p>
              {goalSummary.targetLine && <p className="text-xs text-label-2">{goalSummary.targetLine}</p>}
            </div>
          )}
          {trainingFrequency && (
            <div className={`rounded-xl bg-surface px-4 py-3 ${goalSummary ? "" : "col-span-2"}`}>
              <p className="mb-1 text-xs font-medium text-label-2">Training frequency</p>
              <p className="text-sm font-semibold text-label">{trainingFrequency.actualLine}</p>
              <p className="text-xs text-label-2">{trainingFrequency.goalLine}</p>
            </div>
          )}
        </section>
      )}

      {weeklyInsights && <WeeklyInsightsCard insights={weeklyInsights} goalDaysPerWeek={goalDaysPerWeek} />}

      <h2 className="section-header">Get help</h2>
      <nav className="mb-6 rounded-xl bg-surface p-1">
        <ListRow href="/coach" icon="compass" iconBg="bg-tint" label="What changed? Ask Coach" />
        <div className="ml-[3.75rem] h-px bg-separator" />
        <ListRow href="/ai-plan" icon="sparkles" iconBg="bg-orange" label="AI diet & workout plan" />
      </nav>
    </main>
  );
}
