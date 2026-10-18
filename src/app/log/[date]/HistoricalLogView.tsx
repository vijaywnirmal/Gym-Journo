"use client";

import { useState } from "react";
import type { Exercise, WorkoutPlan } from "@/lib/types";
import type { PreviousPerformance, WorkoutLogWithContext } from "@/lib/queries";
import { formatDate } from "@/lib/date";
import { formatSetDetail } from "@/lib/setData";
import LogForm from "./LogForm";
import ShareWorkoutButton from "@/components/ShareWorkoutButton";

type Props = {
  date: string;
  exercises: Exercise[];
  plan: WorkoutPlan | null;
  existingLog: WorkoutLogWithContext;
  initialPreviousPerformance: Record<string, PreviousPerformance | null>;
};

// A previously-logged day defaults to a read-first summary — the whole day at a glance — rather
// than the Phase 6 single-exercise execution stepper, which is built for actively performing a
// workout, not reviewing one. "Edit workout" reveals the exact same stepper unchanged.
//
// Deliberately does not read `plan.planned_exercises` targets here, and passes
// `showTargets={false}` into LogForm's edit mode: the plan driving this display must never be a
// live lookup for a workout that already happened (see LogForm's `showTargets` prop) — only the
// logged actual performance (`existingLog`) is shown.
export default function HistoricalLogView({
  date,
  exercises,
  plan,
  existingLog,
  initialPreviousPerformance,
}: Props) {
  const [mode, setMode] = useState<"summary" | "edit">("summary");

  if (mode === "edit") {
    return (
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setMode("summary")}
          className="self-start text-sm text-tint"
        >
          Back to summary
        </button>
        <LogForm
          date={date}
          exercises={exercises}
          plan={plan}
          existingLog={existingLog}
          initialPreviousPerformance={initialPreviousPerformance}
          showTargets={false}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-label-2">{formatDate(date)}</p>
          <h2 className="text-xl font-semibold text-label">
            {existingLog.planTitle ?? "Freeform workout"}
          </h2>
        </div>
        {existingLog.completed_at ? (
          <span className="text-xs font-medium text-green">Completed ✓</span>
        ) : (
          <span className="text-xs font-medium text-label-2">In progress</span>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {(existingLog.logged_exercises ?? []).length === 0 && (
          <p className="text-sm text-label-2">No exercises were logged this day.</p>
        )}
        {existingLog.logged_exercises?.map((le) => (
          <div key={le.id} className="rounded-xl bg-surface p-4">
            <p className="mb-2 font-medium text-label">{le.exercise?.name ?? "Exercise"}</p>
            <ul className="flex flex-col gap-1 text-sm text-label">
              {(le.logged_sets ?? []).map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <span className="w-5 text-label-2">{s.set_number}</span>
                  <span>
                    {s.weight ?? "?"}
                    {s.weight_unit} × {s.reps ?? "?"}
                  </span>
                  {formatSetDetail(s.set_type, s.rpe) && (
                    <span className="text-xs text-label-2">{formatSetDetail(s.set_type, s.rpe)}</span>
                  )}
                </li>
              ))}
              {(le.logged_sets ?? []).length === 0 && (
                <li className="text-label-2">No sets recorded.</li>
              )}
            </ul>
            {le.notes && <p className="mt-2 text-xs text-label-2">{le.notes}</p>}
          </div>
        ))}
      </div>

      {existingLog.notes && (
        <div className="rounded-xl bg-surface px-4 py-3">
          <p className="mb-1 text-xs font-medium text-label-2">Notes</p>
          <p className="text-sm text-label">{existingLog.notes}</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setMode("edit")}
        className="rounded-xl bg-fill px-4 py-3 text-sm font-medium text-label"
      >
        Edit workout
      </button>

      <ShareWorkoutButton date={date} />
    </div>
  );
}
