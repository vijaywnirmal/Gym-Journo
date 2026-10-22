"use client";

import { useState } from "react";
import type { WorkoutPlan } from "@/lib/types";
import type { PreviousPerformance, WorkoutLogWithContext } from "@/lib/queries";
import { formatDate } from "@/lib/date";
import { formatSetDetail } from "@/lib/setData";
import LogForm from "./LogForm";
import Icon from "@/components/Icon";
import ShareWorkoutButton from "@/components/ShareWorkoutButton";

type Props = {
  date: string;
  plan: WorkoutPlan | null;
  existingLog: WorkoutLogWithContext;
  initialPreviousPerformance: Record<string, PreviousPerformance | null>;
  // Passed to the edit-mode LogForm so unsynced edits are backed up on this device, as when logging.
  backupScope: string | null;
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
  plan,
  existingLog,
  initialPreviousPerformance,
  backupScope,
}: Props) {
  const [mode, setMode] = useState<"summary" | "edit">("summary");

  if (mode === "edit") {
    return (
      <div className="flex flex-col gap-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <h1 className="page-title">Edit workout</h1>
            <p className="text-sm text-label-2">{formatDate(date)} · changes save automatically</p>
          </div>
          <button
            type="button"
            onClick={() => setMode("summary")}
            className="h-9 shrink-0 rounded-[10px] border border-separator px-3 text-sm font-semibold hover:bg-fill"
          >
            Done
          </button>
        </div>
        <LogForm
          date={date}
          plan={plan}
          existingLog={existingLog}
          initialPreviousPerformance={initialPreviousPerformance}
          showTargets={false}
          backupScope={backupScope}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-6">
      <header className="mb-1 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="page-title truncate">{existingLog.planTitle ?? "Freeform workout"}</h1>
          <p className="flex items-center gap-1.5 text-sm text-label-2">
            {formatDate(date)} ·
            {existingLog.completed_at ? (
              <span className="flex items-center gap-1 font-medium text-green">
                <Icon name="checkmark" className="size-3.5" strokeWidth={2.5} />
                Completed
              </span>
            ) : (
              <span>Not marked finished</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMode("edit")}
          className="h-9 shrink-0 rounded-[10px] border border-separator px-3 text-sm font-semibold hover:bg-fill"
        >
          Edit
        </button>
      </header>

      {(existingLog.logged_exercises ?? []).length === 0 ? (
        <p className="card px-4 py-6 text-center text-sm text-label-2">No exercises were logged this day.</p>
      ) : (
        <div className="card divide-y divide-separator">
          {existingLog.logged_exercises?.map((le) => (
            <section key={le.id} className="p-4">
              <h2 className="mb-2 text-sm font-semibold">{le.exercise?.name ?? "Exercise"}</h2>
              <ul className="flex flex-col gap-1 text-sm">
                {(le.logged_sets ?? []).map((s) => (
                  <li key={s.id} className="flex items-center gap-3">
                    <span className="w-5 text-right text-xs tabular-nums text-label-3">{s.set_number}</span>
                    <span className="tabular-nums">
                      {s.weight ?? "?"}
                      {s.weight_unit} × {s.reps ?? "?"}
                    </span>
                    {formatSetDetail(s.set_type, s.rpe) && (
                      <span className="text-xs text-label-2">{formatSetDetail(s.set_type, s.rpe)}</span>
                    )}
                  </li>
                ))}
                {(le.logged_sets ?? []).length === 0 && <li className="text-label-2">No sets recorded.</li>}
              </ul>
              {le.notes && <p className="mt-2 text-xs text-label-2 italic">{le.notes}</p>}
            </section>
          ))}
        </div>
      )}

      {existingLog.notes && (
        <section className="card px-4 py-3">
          <h2 className="mb-1 text-xs font-medium text-label-2">Notes</h2>
          <p className="text-sm">{existingLog.notes}</p>
        </section>
      )}

      <ShareWorkoutButton date={date} />
    </div>
  );
}
