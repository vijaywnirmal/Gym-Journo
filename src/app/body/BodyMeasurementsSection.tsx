"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { BodyMeasurement } from "@/lib/types";
import { formatDate } from "@/lib/date";
import { saveMeasurement, deleteMeasurement } from "./actions";

export default function BodyMeasurementsSection({
  measurements,
  todayStr,
  progressSummary,
}: {
  measurements: BodyMeasurement[];
  // The person's today, computed on the server — not this browser's clock.
  todayStr: string;
  progressSummary?: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [date, setDate] = useState(todayStr);
  const [weightKg, setWeightKg] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Already ordered newest-first by the query.
  // `measurements` is newest-first; a future-dated row is never the current weight.
  const latest = measurements.find((m) => m.date <= todayStr) ?? null;

  function startAdd() {
    setEditingId("new");
    setDate(todayStr);
    setWeightKg("");
    setNotes("");
    setError(null);
  }

  function startEdit(m: BodyMeasurement) {
    setEditingId(m.id);
    setDate(m.date);
    setWeightKg(m.weight_kg.toString());
    setNotes(m.notes ?? "");
    setError(null);
  }

  function cancel() {
    setEditingId(null);
    setError(null);
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await saveMeasurement({
        date,
        weightKg: weightKg ? parseFloat(weightKg) : NaN,
        notes,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setEditingId(null);
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteMeasurement(id);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3">
        <p className="text-xs font-medium text-neutral-400">Latest weight</p>
        <p className="text-2xl font-bold text-neutral-100">
          {latest ? `${latest.weight_kg} kg` : "—"}
        </p>
        {latest && <p className="text-xs text-neutral-500">{formatDate(latest.date)}</p>}
      </div>

      {progressSummary}

      {editingId !== null ? (
        <div className="flex flex-col gap-3 rounded-xl border border-neutral-800 p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-400">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={editingId !== "new"}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-base text-neutral-100 disabled:opacity-60"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-400">Weight (kg)</label>
            <input
              type="number"
              min={0}
              step="0.1"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder="70"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-base text-neutral-100 placeholder-neutral-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-400">
              Note (optional)
            </label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How are you feeling?"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-base text-neutral-100 placeholder-neutral-500"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={pending}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-900 disabled:opacity-50"
            >
              {pending ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={cancel}
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={startAdd}
          className="rounded-lg border border-neutral-700 px-4 py-2.5 text-sm font-medium text-neutral-100"
        >
          + Add entry
        </button>
      )}

      <div className="flex flex-col gap-2">
        {measurements.length === 0 && (
          <p className="text-sm text-neutral-500">No weight entries yet.</p>
        )}
        {measurements.map((m) => (
          <div key={m.id} className="rounded-xl border border-neutral-800 p-4">
            <div className="mb-1 flex items-center justify-between">
              <p className="font-medium text-neutral-100">{formatDate(m.date)}</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => startEdit(m)}
                  className="text-xs text-neutral-300 underline"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(m.id)}
                  disabled={pending}
                  className="text-xs text-red-400 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
            <p className="text-sm text-neutral-300">{m.weight_kg} kg</p>
            {m.notes && <p className="mt-1 text-xs text-neutral-500">{m.notes}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
