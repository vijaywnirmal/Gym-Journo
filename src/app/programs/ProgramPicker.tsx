"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { formatDate } from "@/lib/date";
import {
  buildProgramSchedule,
  MAX_PROGRAM_WEEKS,
  MIN_PROGRAM_WEEKS,
  WEEKDAY_LABELS,
  type Program,
} from "@/lib/programs";
import { applyProgram, type ApplyProgramResult } from "./actions";

const PREVIEW_DAYS = 6;

export default function ProgramPicker({ programs, today }: { programs: Program[]; today: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = programs.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-3 pb-6">
      {programs.map((program) => (
        <div key={program.id} className="rounded-xl border border-neutral-800">
          <button
            type="button"
            onClick={() => setSelectedId(selectedId === program.id ? null : program.id)}
            aria-expanded={selectedId === program.id}
            className="w-full px-4 py-3 text-left"
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-semibold text-neutral-100">{program.name}</p>
              <span className="shrink-0 text-xs text-neutral-500">
                {program.defaultWeekdays.length}×/week · {program.level}
              </span>
            </div>
            <p className="mt-1 text-sm text-neutral-400">{program.summary}</p>
          </button>
          {selected?.id === program.id && (
            // Keyed so switching programs resets the form to that program's defaults.
            <ProgramForm key={program.id} program={program} today={today} />
          )}
        </div>
      ))}
    </div>
  );
}

function ProgramForm({ program, today }: { program: Program; today: string }) {
  const [startDate, setStartDate] = useState(today);
  const [weekdays, setWeekdays] = useState<Set<number>>(new Set(program.defaultWeekdays));
  const [weeks, setWeeks] = useState(program.defaultWeeks);
  const [result, setResult] = useState<ApplyProgramResult | null>(null);
  const [pending, startTransition] = useTransition();

  const schedule = useMemo(
    () => buildProgramSchedule(program, startDate, [...weekdays], weeks),
    [program, startDate, weekdays, weeks]
  );

  function toggleDay(day: number) {
    setResult(null);
    setWeekdays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  function apply() {
    setResult(null);
    startTransition(async () => {
      setResult(await applyProgram({ programId: program.id, startDate, weekdays: [...weekdays], weeks }));
    });
  }

  return (
    <div className="flex flex-col gap-3 border-t border-neutral-800 px-4 py-3">
      <details>
        <summary className="cursor-pointer text-xs text-neutral-400">
          {program.days.length} workout{program.days.length === 1 ? "" : "s"} in rotation
        </summary>
        <ul className="mt-2 flex flex-col gap-2">
          {program.days.map((day) => (
            <li key={day.title} className="text-sm">
              <p className="font-medium text-neutral-200">{day.title}</p>
              <p className="text-xs text-neutral-400">
                {day.exercises.map((e) => `${e.name} ${e.sets}×${e.reps}`).join(" · ")}
              </p>
            </li>
          ))}
        </ul>
      </details>

      <label className="flex items-center justify-between gap-2 text-sm text-neutral-300">
        Start
        <input
          type="date"
          value={startDate}
          min={today}
          onChange={(e) => {
            setResult(null);
            setStartDate(e.target.value);
          }}
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-base text-neutral-100"
        />
      </label>

      <div>
        <p className="mb-1 text-sm text-neutral-300">Training days</p>
        <div className="flex gap-1" role="group" aria-label="Training days">
          {WEEKDAY_LABELS.map((label, day) => (
            <button
              key={label}
              type="button"
              onClick={() => toggleDay(day)}
              aria-pressed={weekdays.has(day)}
              className={`flex-1 rounded-md py-1.5 text-xs ${
                weekdays.has(day) ? "bg-white font-semibold text-neutral-900" : "border border-neutral-700 text-neutral-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center justify-between gap-2 text-sm text-neutral-300">
        Weeks
        <select
          value={weeks}
          onChange={(e) => {
            setResult(null);
            setWeeks(Number(e.target.value));
          }}
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-base text-neutral-100"
        >
          {Array.from({ length: MAX_PROGRAM_WEEKS - MIN_PROGRAM_WEEKS + 1 }, (_, i) => i + MIN_PROGRAM_WEEKS).map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </label>

      {schedule.length > 0 ? (
        <div className="rounded-lg bg-neutral-900 px-3 py-2">
          <p className="mb-1 text-xs text-neutral-500">
            {schedule.length} workouts · first {Math.min(PREVIEW_DAYS, schedule.length)}:
          </p>
          <ul className="text-xs text-neutral-300">
            {schedule.slice(0, PREVIEW_DAYS).map((s) => (
              <li key={s.date}>
                {formatDate(s.date)} — {s.day.title}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-neutral-500">Pick at least one training day.</p>
      )}

      {result && "error" in result && <p className="text-sm text-red-400">{result.error}</p>}
      {result && "success" in result && (
        <div className="rounded-lg border border-green-900 bg-green-950/40 px-3 py-2 text-sm text-green-300" role="status">
          Scheduled {result.created} workout{result.created === 1 ? "" : "s"}
          {result.skipped > 0 && ` · skipped ${result.skipped} day${result.skipped === 1 ? "" : "s"} you'd already planned`}.{" "}
          <Link href={`/calendar?week=${result.firstDate}`} className="underline">
            See calendar
          </Link>
        </div>
      )}

      <button
        type="button"
        onClick={apply}
        disabled={pending || schedule.length === 0 || (result !== null && "success" in result)}
        className="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 disabled:opacity-40"
      >
        {pending ? "Scheduling…" : "Schedule this program"}
      </button>
    </div>
  );
}
