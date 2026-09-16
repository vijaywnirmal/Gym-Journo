import Link from "next/link";
import { getLogForDate, getPlanForDate } from "@/lib/queries";
import { formatDate, today } from "@/lib/date";
import SignOutButton from "@/components/SignOutButton";

export default async function TodayPage() {
  const date = today();
  const [plan, log] = await Promise.all([getPlanForDate(date), getLogForDate(date)]);

  return (
    <main className="px-4 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-neutral-500">{formatDate(date)}</p>
          <h1 className="text-xl font-bold">Today</h1>
        </div>
        <SignOutButton />
      </div>

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
          <ul className="mb-4 flex flex-col gap-1 text-sm text-neutral-300">
            {plan.planned_exercises?.map((pe) => (
              <li key={pe.id}>
                {pe.exercise?.name} — {pe.target_sets ?? "?"} × {pe.target_reps ?? "?"}
              </li>
            ))}
          </ul>
          <Link
            href={`/log/${date}`}
            className="block rounded-lg bg-white px-4 py-2.5 text-center text-sm font-medium text-neutral-900"
          >
            {log?.completed_at ? "Workout complete ✓ — view log" : "Log this workout"}
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
              href={`/log/${date}`}
              className="rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-neutral-900"
            >
              {log ? "Continue today's log" : "Log a freeform workout"}
            </Link>
          </div>
        </div>
      )}

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
