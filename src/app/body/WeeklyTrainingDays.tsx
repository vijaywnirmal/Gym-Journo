import type { WeeklyTrainingDays as WeekData } from "@/lib/analyze/weeklyTraining";
import { buildWeeklyTrainingRows } from "./weeklyTrainingFormat";

// Workout days per Sunday–Saturday week beside the stated weekly target. Factual only — the
// current week is marked in progress and shows no difference, since it isn't finished.
export default function WeeklyTrainingDays({
  weeks,
  targetDaysPerWeek,
}: {
  weeks: WeekData[];
  targetDaysPerWeek: number | null;
}) {
  const rows = buildWeeklyTrainingRows(weeks, targetDaysPerWeek);

  return (
    <div className="rounded-xl border border-neutral-800 p-4">
      <h2 className="mb-3 text-sm font-semibold text-neutral-200">Weekly training days</h2>
      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <li key={row.key}>
            <p className="text-xs text-neutral-500">
              {row.label}
              {row.inProgress ? " · in progress" : ""}
            </p>
            <p className="text-sm text-neutral-300">
              {[row.performedLine, row.targetLine, row.differenceLine]
                .filter((line): line is string => line !== null)
                .join(" · ")}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
