"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { BodyMeasurement } from "@/lib/types";
import { formatDate } from "@/lib/date";
import DateField from "@/components/ui/DateField";
import Icon from "@/components/Icon";
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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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

  // Logging a new entry on a date that already has one replaces it (one entry per date), so say so
  // before the old weight and note are gone.
  const replacing = editingId === "new" ? (measurements.find((m) => m.date === date) ?? null) : null;

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
      setConfirmDeleteId(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4 pb-6">
      <section className="card flex items-end justify-between gap-4 p-5">
        <div>
          <p className="text-xs font-medium text-label-2">Latest weight</p>
          <p className="text-3xl font-semibold tabular-nums tracking-tight">
            {latest ? (
              <>
                {latest.weight_kg} <span className="text-base font-medium text-label-2">kg</span>
              </>
            ) : (
              "—"
            )}
          </p>
          <p className="text-xs text-label-3">{latest ? formatDate(latest.date) : "No entries yet"}</p>
        </div>
        {editingId === null && (
          <button
            type="button"
            onClick={startAdd}
            className="flex h-10 items-center gap-1.5 rounded-[10px] bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover"
          >
            <Icon name="plus" className="size-4" strokeWidth={2.5} />
            Log weight
          </button>
        )}
      </section>

      {editingId !== null && (
        <section className="card flex flex-col gap-4 p-4">
          <h2 className="text-sm font-semibold">{editingId === "new" ? "Log weight" : "Edit entry"}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className="mb-1.5 block text-sm font-medium">Date</span>
              <DateField
                value={date}
                onChange={setDate}
                max={todayStr}
                disabled={editingId !== "new"}
                ariaLabel="Date"
              />
            </div>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Weight</span>
              <span className="field flex h-11 items-center rounded-[10px] pr-3.5 focus-within:border-accent">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.1"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  placeholder="70"
                  autoFocus
                  className="h-full w-full min-w-0 bg-transparent pl-3.5 text-base tabular-nums outline-none placeholder:text-label-3"
                />
                <span className="text-sm text-label-2">kg</span>
              </span>
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">
              Note <span className="font-normal text-label-3">(optional)</span>
            </span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How are you feeling?"
              className="field h-11 w-full rounded-[10px] px-3.5 text-base"
            />
          </label>
          {replacing && (
            <p className="text-sm text-orange">
              You already logged {replacing.weight_kg} kg on {formatDate(replacing.date)}
              {replacing.notes ? " with a note" : ""}. Saving replaces it.
            </p>
          )}
          {error && <p className="text-sm text-red">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={pending}
              className="h-10 rounded-[10px] bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-50"
            >
              {pending ? "Saving…" : replacing ? "Replace entry" : "Save"}
            </button>
            <button
              type="button"
              onClick={cancel}
              className="h-10 rounded-[10px] border border-separator px-4 text-sm font-semibold hover:bg-fill"
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      {progressSummary}

      <section>
        <h2 className="section-title mt-2">Entries</h2>
        {measurements.length === 0 ? (
          <p className="card px-4 py-6 text-center text-sm text-label-2">No weight entries yet.</p>
        ) : (
          <ul className="card divide-y divide-separator">
            {measurements.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium tabular-nums">{m.weight_kg} kg</span>
                    <span className="text-label-3"> · {formatDate(m.date)}</span>
                  </p>
                  {m.notes && <p className="truncate text-xs text-label-2">{m.notes}</p>}
                </div>
                {confirmDeleteId === m.id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="h-8 rounded-lg px-2.5 text-sm font-medium hover:bg-fill"
                    >
                      Keep
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(m.id)}
                      disabled={pending}
                      className="h-8 rounded-lg bg-red px-2.5 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => startEdit(m)}
                      className="h-8 rounded-lg px-2.5 text-sm font-medium text-link hover:bg-fill"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(m.id)}
                      aria-label={`Delete entry for ${formatDate(m.date)}`}
                      className="grid size-8 place-items-center rounded-lg text-label-3 hover:bg-fill hover:text-red"
                    >
                      <Icon name="trash" className="size-4" />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
