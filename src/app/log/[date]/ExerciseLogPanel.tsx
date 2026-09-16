"use client";

import type { PreviousPerformance } from "@/lib/queries";

export type SetRow = { reps: string; weight: string; weightUnit: string };
export type ExerciseEntry = {
  exerciseId: string;
  name: string;
  target: { sets: number | null; reps: number | null } | null;
  sets: SetRow[];
  done: boolean;
};

type Props = {
  entry: ExerciseEntry;
  positionLabel: string;
  previous: PreviousPerformance | null | undefined; // undefined = still loading
  onUpdateSet: (index: number, field: keyof SetRow, value: string) => void;
  onAddSet: () => void;
  onRemoveSet: (index: number) => void;
  onToggleDone: () => void;
  onRemoveExercise: () => void;
};

function targetLabel(target: ExerciseEntry["target"]): string | null {
  if (!target || (!target.sets && !target.reps)) return null;
  const sets = target.sets ?? "?";
  const reps = target.reps ?? "?";
  return `${sets} × ${reps}`;
}

export default function ExerciseLogPanel({
  entry,
  positionLabel,
  previous,
  onUpdateSet,
  onAddSet,
  onRemoveSet,
  onToggleDone,
  onRemoveExercise,
}: Props) {
  const target = targetLabel(entry.target);

  return (
    <div className="rounded-xl border border-neutral-800 p-4">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <p className="text-xs text-neutral-500">{positionLabel}</p>
          <h2 className="text-lg font-semibold text-neutral-100">{entry.name}</h2>
        </div>
        <button type="button" onClick={onRemoveExercise} className="text-xs text-red-400">
          Remove
        </button>
      </div>

      {target && (
        <p className="mb-1 text-sm text-neutral-400">
          Target: <span className="text-neutral-200">{target}</span>
        </p>
      )}

      {previous === undefined ? (
        <p className="mb-3 text-xs text-neutral-600">Loading last time…</p>
      ) : previous ? (
        <div className="mb-3 rounded-lg bg-neutral-900 px-3 py-2">
          <p className="text-xs font-medium text-neutral-400">Last time</p>
          <p className="text-sm text-neutral-200">
            {previous.sets
              .map((s) => `${s.weight ?? "?"}${s.weightUnit} × ${s.reps ?? "?"}`)
              .join(", ")}
          </p>
        </div>
      ) : (
        <p className="mb-3 text-xs text-neutral-600">No previous record for this exercise yet.</p>
      )}

      <div className="flex flex-col gap-2">
        {entry.sets.map((set, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-5 text-sm text-neutral-500">{i + 1}</span>
            <input
              type="number"
              inputMode="decimal"
              placeholder="weight"
              value={set.weight}
              onChange={(e) => onUpdateSet(i, "weight", e.target.value)}
              className="w-20 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-2.5 text-base text-neutral-100"
            />
            <select
              value={set.weightUnit}
              onChange={(e) => onUpdateSet(i, "weightUnit", e.target.value)}
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-2.5 text-base text-neutral-100"
            >
              <option value="kg">kg</option>
              <option value="lb">lb</option>
            </select>
            <span className="text-neutral-500">×</span>
            <input
              type="number"
              inputMode="numeric"
              placeholder="reps"
              value={set.reps}
              onChange={(e) => onUpdateSet(i, "reps", e.target.value)}
              className="w-16 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-2.5 text-base text-neutral-100"
            />
            <button
              type="button"
              onClick={() => onRemoveSet(i)}
              aria-label={`Remove set ${i + 1}`}
              className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-700 text-neutral-400"
            >
              ✕
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={onAddSet}
          className="self-start rounded-lg border border-neutral-700 px-3 py-1.5 text-sm font-medium text-neutral-100"
        >
          + Add set
        </button>
      </div>

      <button
        type="button"
        onClick={onToggleDone}
        className={`mt-4 w-full rounded-lg px-4 py-2.5 text-sm font-medium ${
          entry.done
            ? "border border-neutral-700 text-neutral-300"
            : "bg-white text-neutral-900"
        }`}
      >
        {entry.done ? "Undo complete" : "✓ Complete exercise"}
      </button>
    </div>
  );
}
