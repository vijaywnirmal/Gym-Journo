import type { BodyWeightWindow, TrainingConsistency } from "@/lib/queries";

export type GoalDirection = "toward" | "away" | null;

// Descriptive only — never a score. lose_fat/build_muscle are the only goals with a directional
// interpretation of a weight change; maintain/general_fitness (or no goal/target) always get the
// raw number with no toward/away claim. A zero delta makes no directional claim either way.
export function getGoalDirection(
  primaryGoal: string | null,
  deltaKg: number,
  targetWeightKg: number | null
): GoalDirection {
  if (targetWeightKg === null) return null;
  if (deltaKg === 0) return null;

  if (primaryGoal === "lose_fat") return deltaKg < 0 ? "toward" : "away";
  if (primaryGoal === "build_muscle") return deltaKg > 0 ? "toward" : "away";
  return null;
}

// One decimal place, matching the existing 0.1kg step used on the measurement form.
export function formatWeightKg(weightKg: number): string {
  return `${weightKg.toFixed(1)} kg`;
}

export function formatDeltaKg(deltaKg: number): string {
  const sign = deltaKg > 0 ? "+" : deltaKg < 0 ? "−" : "";
  return `${sign}${Math.abs(deltaKg).toFixed(1)} kg`;
}

export default function BodyProgressSummary({
  training,
  weightWindow,
  primaryGoal,
  targetWeightKg,
}: {
  training: TrainingConsistency;
  weightWindow: BodyWeightWindow;
  primaryGoal: string | null;
  targetWeightKg: number | null;
}) {
  const delta =
    weightWindow.measurementCount >= 2 && weightWindow.earliest && weightWindow.latest
      ? weightWindow.latest.weightKg - weightWindow.earliest.weightKg
      : null;

  const direction =
    delta !== null ? getGoalDirection(primaryGoal, delta, targetWeightKg) : null;

  return (
    <div className="rounded-xl border border-neutral-800 p-4">
      <h2 className="mb-3 text-sm font-semibold text-neutral-200">
        Last {training.windowDays} days
      </h2>

      <div className="flex flex-col gap-3">
        <div>
          {training.daysLogged === 0 ? (
            <p className="text-sm text-neutral-500">
              No workouts logged in the last {training.windowDays} days.
            </p>
          ) : (
            <p className="text-sm text-neutral-300">
              {training.daysLogged} workout{training.daysLogged === 1 ? "" : "s"} logged in the
              last {training.windowDays} days.
            </p>
          )}
        </div>

        <div>
          {weightWindow.measurementCount === 0 && (
            <p className="text-sm text-neutral-500">No weight change to report yet.</p>
          )}

          {weightWindow.measurementCount === 1 && weightWindow.latest && (
            <p className="text-sm text-neutral-300">
              Weight: {formatWeightKg(weightWindow.latest.weightKg)}.
            </p>
          )}

          {weightWindow.measurementCount >= 2 &&
            weightWindow.earliest &&
            weightWindow.latest &&
            delta !== null && (
              <>
                <p className="text-sm text-neutral-300">
                  Weight: {formatWeightKg(weightWindow.earliest.weightKg)} →{" "}
                  {formatWeightKg(weightWindow.latest.weightKg)}
                </p>
                <p className="text-sm text-neutral-300">Change: {formatDeltaKg(delta)}</p>
                {direction === "toward" && (
                  <p className="mt-1 text-xs text-neutral-500">
                    This change moved toward your target weight of{" "}
                    {formatWeightKg(targetWeightKg as number)}.
                  </p>
                )}
                {direction === "away" && (
                  <p className="mt-1 text-xs text-neutral-500">
                    This change moved away from your target weight of{" "}
                    {formatWeightKg(targetWeightKg as number)}.
                  </p>
                )}
              </>
            )}
        </div>
      </div>
    </div>
  );
}
