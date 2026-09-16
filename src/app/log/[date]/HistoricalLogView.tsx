"use client";

import { useState } from "react";
import type { Exercise, WorkoutPlan } from "@/lib/types";
import type { PreviousPerformance, WorkoutLogWithContext } from "@/lib/queries";
import { formatDate } from "@/lib/date";
import LogForm from "./LogForm";

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
          className="self-start text-sm text-neutral-400 underline"
        >
          ← Back to summary
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
          <p className="text-sm text-neutral-500">{formatDate(date)}</p>
          <h2 className="text-lg font-semibold text-neutral-100">
            {existingLog.planTitle ?? "Freeform workout"}
          </h2>
        </div>
        {existingLog.completed_at ? (
          <span className="text-xs font-medium text-green-400">Completed ✓</span>
        ) : (
          <span className="text-xs font-medium text-neutral-500">In progress</span>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {(existingLog.logged_exercises ?? []).length === 0 && (
          <p className="text-sm text-neutral-500">No exercises were logged this day.</p>
        )}
        {existingLog.logged_exercises?.map((le) => (
          <div key={le.id} className="rounded-xl border border-neutral-800 p-4">
            <p className="mb-2 font-medium text-neutral-100">{le.exercise?.name ?? "Exercise"}</p>
            <ul className="flex flex-col gap-1 text-sm text-neutral-300">
              {(le.logged_sets ?? []).map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <span className="w-5 text-neutral-500">{s.set_number}</span>
                  <span>
                    {s.weight ?? "?"}
                    {s.weight_unit} × {s.reps ?? "?"}
                  </span>
                </li>
              ))}
              {(le.logged_sets ?? []).length === 0 && (
                <li className="text-neutral-500">No sets recorded.</li>
              )}
            </ul>
          </div>
        ))}
      </div>

      {existingLog.notes && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3">
          <p className="mb-1 text-xs font-medium text-neutral-400">Notes</p>
          <p className="text-sm text-neutral-200">{existingLog.notes}</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setMode("edit")}
        className="rounded-xl border border-neutral-700 px-4 py-3 text-sm font-medium text-neutral-100"
      >
        Edit workout
      </button>
    </div>
  );
}
