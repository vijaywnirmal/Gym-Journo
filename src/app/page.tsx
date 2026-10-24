import type { Metadata } from "next";
import Link from "next/link";
import {
  getLastCompletedLog,
  getLogForDate,
  getPlanForDate,
  getProfile,
  getTrainingConsistency,
  getWeeklyInsights,
  getAdaptSuggestions,
  getLastPerformedWorkoutDate,
} from "@/lib/queries";
import WeeklyInsightsCard from "@/components/WeeklyInsightsCard";
import { formatDate, formatDateLong, hourIn, todayIn } from "@/lib/date";
import { getUserTimeZone } from "@/lib/userDate";
import { namePartsOf } from "@/lib/names";
import { planAuthorLabel } from "@/lib/planAuthors";
import { getKnownTrainer } from "@/lib/trainers";
import { getMyGymTrainerOffer } from "@/lib/gyms";
import {
  formatGoalSummary,
  formatPlannedExercise,
  formatTrainingFrequency,
  getGreeting,
  getWorkoutCta,
} from "@/lib/home";
import PageHeader from "@/components/PageHeader";
import { dayTypeOf } from "@/lib/dayType";
import { comebackGapDays } from "@/lib/analyze/comeback";
import Icon, { type IconName } from "@/components/Icon";
import { requireMemberApp } from "@/lib/workAccount";

export const metadata: Metadata = { title: "Today" };

const TRAINING_FREQUENCY_WINDOW_DAYS = 7;

function ShortcutCard({ href, icon, title, text }: { href: string; icon: IconName; title: string; text: string }) {
  return (
    <Link href={href} className="card flex flex-col gap-3 p-4 hover:bg-fill">
      <span className="grid size-8 place-items-center rounded-lg bg-accent/10 text-link">
        <Icon name={icon} className="size-[18px]" strokeWidth={2} />
      </span>
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-label-2">{text}</span>
      </span>
    </Link>
  );
}

export default async function TodayPage() {
  await requireMemberApp();
  const { timeZone } = await getUserTimeZone();
  const date = todayIn(timeZone);
  const [profile, plan, log, trainingConsistency, weeklyInsights, suggestions, lastWorkout, trainer, gymOffer] = await Promise.all([
    getProfile(),
    getPlanForDate(date),
    getLogForDate(date),
    getTrainingConsistency(TRAINING_FREQUENCY_WINDOW_DAYS),
    getWeeklyInsights(),
    getAdaptSuggestions(),
    getLastPerformedWorkoutDate(),
    getKnownTrainer(),
    getMyGymTrainerOffer(),
  ]);
  const planAuthor = plan && profile ? planAuthorLabel(plan, profile.id, trainer) : null;

  const greeting = getGreeting(profile ? namePartsOf(profile).firstName : null, hourIn(timeZone));
  const goalSummary = profile ? formatGoalSummary(profile) : null;
  const trainingFrequency = formatTrainingFrequency(
    profile?.training_days_per_week ?? null,
    trainingConsistency.daysPerformed,
    trainingConsistency.windowDays
  );
  const cta = getWorkoutCta(date, !!log, !!log?.completed_at);

  const goalDaysPerWeek = profile?.training_days_per_week ?? null;

  // Welcome back after a break — unless today is already under way or is a planned day off.
  const gapDays = !log && (!plan || !plan.is_rest_day) ? comebackGapDays(lastWorkout.date, date) : null;
  const canGoLighter = !!plan && !plan.is_rest_day && (plan.planned_exercises?.length ?? 0) > 0;

  const hasNothingToday = !plan && !log;
  const recentActivity = hasNothingToday ? await getLastCompletedLog() : null;

  const daysDone = trainingConsistency.daysPerformed;
  const weekProgress = goalDaysPerWeek ? Math.min(1, daysDone / goalDaysPerWeek) : null;

  return (
    <main className="px-4 pt-6 md:px-8 md:pt-10">
      <PageHeader title={greeting} subtitle={formatDateLong(date)} />

      {gymOffer && (
        <Link href="/profile#gym-offer" className="card mb-4 flex items-center gap-3 border-accent/30 px-4 py-3 hover:bg-fill">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">
              {gymOffer.gym_name} suggests {gymOffer.trainer_name} as your trainer
            </span>
            <span className="block text-sm text-label-2">Accept or decline in Profile</span>
          </span>
          <Icon name="chevronRight" className="size-4 shrink-0 text-label-3" strokeWidth={2} />
        </Link>
      )}

      {gapDays !== null && lastWorkout.date && (
        <section className="card mb-4 border-teal/30 bg-teal/5 p-5" role="status">
          <h2 className="text-base font-semibold">Welcome back</h2>
          <p className="mt-0.5 mb-4 text-sm text-label-2">
            Your last workout was {gapDays} days ago ({formatDate(lastWorkout.date)}). A shorter session still counts.
          </p>
          <Link
            href={canGoLighter ? `/log/${date}?lighter=1` : `/log/${date}`}
            className="inline-flex h-10 items-center rounded-[10px] bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover"
          >
            {canGoLighter ? "Start a lighter session" : "Log a short workout"}
          </Link>
        </section>
      )}

      {plan?.is_rest_day ? (
        <section className="card mb-4 flex items-center gap-4 p-5">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-teal/12 text-teal">
            <Icon name="moon" className="size-5" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">{dayTypeOf(plan) === "absence" ? "Day off" : "Rest day"}</h2>
            <p className="text-sm text-label-2">
              {plan.title ?? (dayTypeOf(plan) === "absence" ? "Marked as an absence." : "Recovery is part of the plan.")}
            </p>
            {planAuthor && <p className="mt-0.5 text-xs text-label-2">{planAuthor}</p>}
          </div>
          <Link href={`/schedule/${date}`} className="rounded-lg px-3 py-1.5 text-sm font-medium text-link hover:bg-fill">
            Change
          </Link>
        </section>
      ) : plan ? (
        <section className="card mb-4 p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="mb-0.5 text-xs font-semibold text-link">Today&apos;s workout</p>
              <h2 className="truncate text-xl font-semibold">{plan.title ?? "Scheduled workout"}</h2>
              {plan.muscle_groups && plan.muscle_groups.length > 0 && (
                <p className="mt-0.5 truncate text-sm text-label-2">
                  {plan.muscle_groups.map((mg) => mg.name).join(" · ")}
                </p>
              )}
              {planAuthor && <p className="mt-0.5 text-xs text-label-2">{planAuthor}</p>}
            </div>
            <Link
              href={`/schedule/${date}`}
              className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-link hover:bg-fill"
            >
              Edit
            </Link>
          </div>
          {plan.planned_exercises && plan.planned_exercises.length > 0 && (
            <ol className="mb-5 divide-y divide-separator border-y border-separator">
              {plan.planned_exercises.map((pe, i) => (
                <li key={pe.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="w-5 text-right text-xs font-medium tabular-nums text-label-3">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {formatPlannedExercise({
                      name: pe.exercise?.name ?? "Exercise",
                      targetSets: pe.target_sets,
                      targetReps: pe.target_reps,
                      // `?? null`/`?? "kg"`: before migration 0017 is applied, these columns don't exist
                      // yet and Supabase omits them rather than returning null.
                      targetWeight: pe.target_weight ?? null,
                      targetWeightUnit: pe.target_weight_unit ?? "kg",
                    })}
                  </span>
                </li>
              ))}
            </ol>
          )}
          <div className="flex items-center gap-3">
            <Link
              href={cta.href}
              className="flex h-11 flex-1 items-center justify-center rounded-[10px] bg-accent px-4 text-[15px] font-semibold text-on-accent hover:bg-accent-hover"
            >
              {cta.label}
            </Link>
            {log?.completed_at && (
              <span className="flex items-center gap-1.5 text-sm font-medium text-green">
                <Icon name="checkmark" className="size-4" strokeWidth={2.5} />
                Done
              </span>
            )}
          </div>
        </section>
      ) : (
        <section className="card mb-4 p-5">
          <h2 className="text-lg font-semibold">Nothing planned for today</h2>
          <p className="mb-4 text-sm text-label-2">Log what you do as you go, or plan the session first.</p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={cta.href}
              className="flex h-10 items-center rounded-[10px] bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover"
            >
              {log ? cta.label : "Start a workout"}
            </Link>
            <Link
              href={`/schedule/${date}`}
              className="flex h-10 items-center rounded-[10px] border border-separator px-4 text-sm font-semibold hover:bg-fill"
            >
              Plan today
            </Link>
            <Link
              href="/programs"
              className="flex h-10 items-center rounded-[10px] px-3 text-sm font-medium text-link hover:bg-fill"
            >
              Follow a program
            </Link>
          </div>
          {recentActivity && (
            <p className="mt-4 border-t border-separator pt-3 text-xs text-label-2">
              Last workout: {recentActivity.title ?? "Freeform workout"} · {formatDate(recentActivity.date)}
            </p>
          )}
        </section>
      )}

      {suggestions.length > 0 && (
        <Link href="/suggestions" className="card mb-4 flex items-center gap-3 px-4 py-3 hover:bg-fill">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-green/12 text-green">
            <Icon name="lightbulb" className="size-4" strokeWidth={2} />
          </span>
          <span className="min-w-0 flex-1 text-sm">
            <span className="font-medium">
              {suggestions.length} weight suggestion{suggestions.length === 1 ? "" : "s"}
            </span>
            <span className="text-label-2"> for upcoming workouts</span>
          </span>
          <Icon name="chevronRight" className="size-4 text-label-3" strokeWidth={2} />
        </Link>
      )}

      <h2 className="section-title mt-6">This week</h2>
      <section className="card mb-4 p-5">
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-semibold tabular-nums tracking-tight">
            {daysDone}
            {goalDaysPerWeek && <span className="text-label-3"> / {goalDaysPerWeek}</span>}
          </p>
          <p className="text-sm text-label-2">training days in the last {trainingConsistency.windowDays} days</p>
        </div>
        {weekProgress !== null && (
          <div
            className="mt-4 h-2 overflow-hidden rounded-full bg-fill"
            role="img"
            aria-label={trainingFrequency?.actualLine}
          >
            <div className="h-full rounded-full bg-accent" style={{ width: `${weekProgress * 100}%` }} />
          </div>
        )}
        {goalSummary ? (
          <p className="mt-3 text-sm text-label-2">
            Goal: <span className="font-medium text-label">{goalSummary.goalLine}</span>
            {goalSummary.targetLine && <> · {goalSummary.targetLine}</>}
          </p>
        ) : (
          trainingFrequency && <p className="mt-3 text-xs text-label-2">{trainingFrequency.goalLine}</p>
        )}
      </section>

      {weeklyInsights && <WeeklyInsightsCard insights={weeklyInsights} goalDaysPerWeek={goalDaysPerWeek} />}

      <h2 className="section-title mt-6">Help</h2>
      <div className="mb-6 grid grid-cols-2 gap-3">
        <ShortcutCard href="/coach" icon="compass" title="Ask Coach" text="What changed in my training?" />
        <ShortcutCard href="/ai-plan" icon="sparkles" title="AI plan" text="Diet and workout plan" />
      </div>
    </main>
  );
}
