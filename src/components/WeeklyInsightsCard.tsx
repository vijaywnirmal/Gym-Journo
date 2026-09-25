import type { WeeklyInsights } from "@/lib/queries";
import { volumeStatus, weeklyStreak, WEEKLY_SET_RANGE } from "@/lib/analyze/weeklyInsights";
import { formatAdherence, formatStreak } from "@/lib/home";

const STATUS_STYLE = {
  below: { bar: "bg-neutral-500", text: "text-neutral-400", label: "below range" },
  within: { bar: "bg-green-500", text: "text-green-400", label: "in range" },
  above: { bar: "bg-amber-500", text: "text-amber-400", label: "above range" },
} as const;

// Hard sets per muscle group this week against the 10–20 sets/week guideline, plus streak and plan
// adherence. The shaded band on each bar is the guideline range.
export default function WeeklyInsightsCard({
  insights,
  goalDaysPerWeek,
}: {
  insights: WeeklyInsights;
  goalDaysPerWeek: number | null;
}) {
  const streak = formatStreak(weeklyStreak(insights.weeks, goalDaysPerWeek), goalDaysPerWeek);
  const adherence = formatAdherence(insights.adherence, insights.adherenceWindowDays);
  const lastWeekById = new Map(insights.lastWeek.map((m) => [m.muscleGroupId, m.sets]));
  const scaleMax = Math.max(WEEKLY_SET_RANGE.max + 4, ...insights.thisWeek.map((m) => m.sets));
  const pct = (n: number) => `${(n / scaleMax) * 100}%`;

  return (
    <div className="mb-4 rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-xs font-medium text-neutral-500">This week · sets per muscle</p>
        <p className="text-[10px] text-neutral-600">
          guide {WEEKLY_SET_RANGE.min}–{WEEKLY_SET_RANGE.max}
        </p>
      </div>

      {streak && <p className="mb-1 text-sm text-neutral-100">{streak}</p>}
      {adherence && <p className="mb-2 text-xs text-neutral-400">{adherence}</p>}

      {insights.thisWeek.length === 0 ? (
        <p className="text-sm text-neutral-500">No working sets logged this week yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {insights.thisWeek.map((m) => {
            const style = STATUS_STYLE[volumeStatus(m.sets)];
            const last = lastWeekById.get(m.muscleGroupId) ?? 0;
            return (
              <li key={m.muscleGroupId}>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-neutral-200">{m.name}</span>
                  <span className={style.text}>
                    {m.sets} set{m.sets === 1 ? "" : "s"} · {style.label}
                    <span className="text-neutral-600"> · last week {last}</span>
                  </span>
                </div>
                <div
                  className="relative mt-1 h-2 overflow-hidden rounded-full bg-neutral-800"
                  role="img"
                  aria-label={`${m.name}: ${m.sets} sets this week, ${style.label}`}
                >
                  <div
                    className="absolute inset-y-0 bg-neutral-700"
                    style={{ left: pct(WEEKLY_SET_RANGE.min), width: pct(WEEKLY_SET_RANGE.max - WEEKLY_SET_RANGE.min) }}
                  />
                  <div className={`absolute inset-y-0 left-0 rounded-full ${style.bar}`} style={{ width: pct(m.sets) }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
