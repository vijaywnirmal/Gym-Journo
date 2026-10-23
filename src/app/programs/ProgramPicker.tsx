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
import DateField from "@/components/ui/DateField";
import Disclosure from "@/components/ui/Disclosure";
import Icon from "@/components/Icon";
import Select from "@/components/ui/Select";
import { applyProgram, undoProgram, type ApplyProgramInput, type ApplyProgramResult } from "./actions";

const PREVIEW_DAYS = 6;

// Who the program is for: the signed-in person by default, or, on a trainer's screen, a client,
// through server actions bound to that client (so it can come from a server component).
export type ProgramTarget = {
  apply: (input: ApplyProgramInput) => Promise<ApplyProgramResult>;
  undo: (programId: string, dates: string[]) => Promise<{ error: string } | { removed: number }>;
  // "Add to my calendar", "See calendar", and that link, which gets the first scheduled date appended.
  addLabel: string;
  seeLabel: string;
  seeHrefPrefix: string;
  removedFrom: string;
};

const OWN_CALENDAR: ProgramTarget = {
  apply: applyProgram,
  undo: undoProgram,
  addLabel: "Add to my calendar",
  seeLabel: "See calendar",
  seeHrefPrefix: "/calendar?week=",
  removedFrom: "your calendar",
};

export default function ProgramPicker({
  programs,
  today,
  target = OWN_CALENDAR,
}: {
  programs: Program[];
  today: string;
  target?: ProgramTarget;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3 pb-6">
      {programs.map((program) => {
        const open = selectedId === program.id;
        return (
          <section key={program.id} className={`card overflow-hidden ${open ? "ring-2 ring-accent/40" : ""}`}>
            <button
              type="button"
              onClick={() => setSelectedId(open ? null : program.id)}
              aria-expanded={open}
              className="flex w-full items-start gap-3 px-4 py-4 text-left hover:bg-fill"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{program.name}</p>
                <p className="mt-0.5 text-sm text-label-2">{program.summary}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded-md bg-fill px-2 py-0.5 text-xs font-medium text-label-2">
                    {program.defaultWeekdays.length} days/week
                  </span>
                  <span className="rounded-md bg-fill px-2 py-0.5 text-xs font-medium text-label-2 capitalize">
                    {program.level}
                  </span>
                  <span className="rounded-md bg-fill px-2 py-0.5 text-xs font-medium text-label-2">
                    {program.defaultWeeks} weeks
                  </span>
                </div>
              </div>
              <Icon
                name="chevronDown"
                className={`mt-1 size-4 shrink-0 text-label-3 transition-transform ${open ? "rotate-180" : ""}`}
                strokeWidth={2.25}
              />
            </button>
            {open && (
              // Keyed so switching programs resets the form to that program's defaults.
              <ProgramForm key={program.id} program={program} today={today} target={target} />
            )}
          </section>
        );
      })}
    </div>
  );
}

function ProgramForm({ program, today, target }: { program: Program; today: string; target: ProgramTarget }) {
  const [startDate, setStartDate] = useState(today);
  const [weekdays, setWeekdays] = useState<Set<number>>(new Set(program.defaultWeekdays));
  const [weeks, setWeeks] = useState(program.defaultWeeks);
  const [result, setResult] = useState<ApplyProgramResult | null>(null);
  const [undone, setUndone] = useState<string | null>(null);
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

  function undo(dates: string[]) {
    startTransition(async () => {
      const outcome = await target.undo(program.id, dates);
      if ("error" in outcome) {
        setUndone(outcome.error);
        return;
      }
      setResult(null);
      setUndone(`Removed ${outcome.removed} workout${outcome.removed === 1 ? "" : "s"} from ${target.removedFrom}.`);
    });
  }

  function apply() {
    setResult(null);
    setUndone(null);
    startTransition(async () => {
      setResult(await target.apply({ programId: program.id, startDate, weekdays: [...weekdays], weeks }));
    });
  }

  return (
    <div className="flex flex-col gap-4 border-t border-separator px-4 py-4">
      <Disclosure
        summary={
          <span className="text-sm font-medium text-link">
            See the {program.days.length} workout{program.days.length === 1 ? "" : "s"} in rotation
          </span>
        }
        summaryClassName="h-8"
      >
        <ul className="mt-1 flex flex-col divide-y divide-separator rounded-[10px] border border-separator">
          {program.days.map((day) => (
            <li key={day.title} className="px-3 py-2">
              <p className="text-sm font-medium">{day.title}</p>
              <p className="text-xs text-label-2">
                {day.exercises.map((e) => `${e.name} ${e.sets}×${e.reps}`).join(" · ")}
              </p>
            </li>
          ))}
        </ul>
      </Disclosure>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <span className="mb-1.5 block text-sm font-medium">Start date</span>
          <DateField
            value={startDate}
            min={today}
            onChange={(v) => {
              setResult(null);
              setStartDate(v);
            }}
            ariaLabel="Start date"
          />
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-medium">Length</span>
          <Select
            value={String(weeks)}
            onChange={(v) => {
              setResult(null);
              setWeeks(Number(v));
            }}
            options={Array.from({ length: MAX_PROGRAM_WEEKS - MIN_PROGRAM_WEEKS + 1 }, (_, i) => {
              const w = i + MIN_PROGRAM_WEEKS;
              return { value: String(w), label: `${w} week${w === 1 ? "" : "s"}` };
            })}
            ariaLabel="Program length"
            searchable={false}
            size="lg"
            className="w-full"
          />
        </div>
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-medium">Training days</span>
        <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Training days">
          {WEEKDAY_LABELS.map((label, day) => (
            <button
              key={label}
              type="button"
              onClick={() => toggleDay(day)}
              aria-pressed={weekdays.has(day)}
              className={`h-10 rounded-lg border text-sm font-medium ${
                weekdays.has(day)
                  ? "border-transparent bg-accent text-on-accent"
                  : "border-separator text-label-2 hover:bg-fill"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {schedule.length > 0 ? (
        <div className="rounded-[10px] bg-fill px-3 py-2.5">
          <p className="mb-1.5 text-xs font-medium text-label-2">
            {schedule.length} workouts. First {Math.min(PREVIEW_DAYS, schedule.length)}:
          </p>
          <ul className="flex flex-col gap-0.5 text-sm">
            {schedule.slice(0, PREVIEW_DAYS).map((s) => (
              <li key={s.date} className="flex gap-3">
                <span className="w-24 shrink-0 text-label-2">{formatDate(s.date)}</span>
                <span className="truncate">{s.day.title}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-label-2">Pick at least one training day.</p>
      )}

      {result && "error" in result && <p className="text-sm text-red">{result.error}</p>}
      {result && "success" in result && (
        <div className="flex items-start gap-2 rounded-[10px] bg-green/10 px-3 py-2.5 text-sm" role="status">
          <Icon name="checkmark" className="mt-0.5 size-4 shrink-0 text-green" strokeWidth={2.5} />
          <p>
            Scheduled {result.created} workout{result.created === 1 ? "" : "s"}
            {result.skipped > 0 &&
              ` · skipped ${result.skipped} day${result.skipped === 1 ? "" : "s"} already planned`}
            .{" "}
            <Link href={`${target.seeHrefPrefix}${result.firstDate}`} className="font-medium text-link">
              {target.seeLabel}
            </Link>
            {result.createdDates.length > 0 && (
              <>
                {" · "}
                <button
                  type="button"
                  onClick={() => undo(result.createdDates)}
                  disabled={pending}
                  className="font-medium text-link disabled:opacity-50"
                >
                  Undo
                </button>
              </>
            )}
          </p>
        </div>
      )}
      {undone && (
        <p role="status" className="text-sm text-label-2">
          {undone}
        </p>
      )}

      <button
        type="button"
        onClick={apply}
        disabled={pending || schedule.length === 0 || (result !== null && "success" in result)}
        className="h-11 rounded-[10px] bg-accent px-4 text-[15px] font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-40"
      >
        {pending ? "Scheduling…" : target.addLabel}
      </button>
    </div>
  );
}
