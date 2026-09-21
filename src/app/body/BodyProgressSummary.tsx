import type { TrainingConsistency } from "@/lib/queries";
import { daysSince } from "@/lib/date";

// One decimal place, matching the existing 0.1kg step used on the measurement form.
export function formatWeightKg(weightKg: number): string {
  return `${weightKg.toFixed(1)} kg`;
}

export function formatDeltaKg(deltaKg: number): string {
  const sign = deltaKg > 0 ? "+" : deltaKg < 0 ? "−" : "";
  return `${sign}${Math.abs(deltaKg).toFixed(1)} kg`;
}

// Purely factual — "when," never "how you're doing." No fatigue/readiness/rest-day claim.
export function formatLastWorkout(lastWorkoutDate: string | null): string {
  if (lastWorkoutDate === null) return "No workouts logged yet.";
  const diff = daysSince(lastWorkoutDate);
  if (diff === 0) return "Last workout: today.";
  if (diff === 1) return "Last workout: yesterday.";
  return `Last workout: ${diff} days ago.`;
}

export default function BodyProgressSummary({
  training,
  lastWorkoutDate,
}: {
  training: TrainingConsistency;
  lastWorkoutDate: string | null;
}) {
  return (
    <div className="rounded-xl border border-neutral-800 p-4">
      <h2 className="mb-3 text-sm font-semibold text-neutral-200">
        Last {training.windowDays} days
      </h2>

      <div className="flex flex-col gap-3">
        <div>
          {training.daysPerformed === 0 ? (
            <p className="text-sm text-neutral-500">
              No workouts in the last {training.windowDays} days.
            </p>
          ) : (
            <p className="text-sm text-neutral-300">
              {training.daysPerformed} workout{training.daysPerformed === 1 ? "" : "s"} in the
              last {training.windowDays} days.
            </p>
          )}
          <p
            className={
              lastWorkoutDate === null ? "mt-1 text-sm text-neutral-500" : "mt-1 text-sm text-neutral-300"
            }
          >
            {formatLastWorkout(lastWorkoutDate)}
          </p>
        </div>
      </div>
    </div>
  );
}
