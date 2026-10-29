import Link from "next/link";
import type { PersonalQuickWorkout } from "@/lib/quickWorkouts";
import Icon from "@/components/Icon";

// Short sessions someone can start right away, in suggestion order (the first is marked). Each opens
// the day's logger pre-filled with that session's exercises and targets.
export default function QuickWorkoutList({ date, workouts }: { date: string; workouts: PersonalQuickWorkout[] }) {
  return (
    <ul className="divide-y divide-separator overflow-hidden rounded-[10px] border border-separator bg-surface text-left">
      {workouts.map((workout, i) => (
        <li key={workout.id}>
          <Link href={`/log/${date}?quick=${workout.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-fill">
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold">{workout.name}</span>
                {i === 0 && (
                  <span className="shrink-0 rounded-md bg-accent/10 px-1.5 py-0.5 text-[11px] font-semibold text-link">
                    Suggested
                  </span>
                )}
              </span>
              <span className="block truncate text-xs text-label-2">{workout.summary}</span>
              <span className="block text-xs text-label-3">
                ~{workout.minutes} min · {workout.exercises.length} exercises · {workout.equipmentLabel}
              </span>
            </span>
            <Icon name="chevronRight" className="size-4 shrink-0 text-label-3" strokeWidth={2} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
