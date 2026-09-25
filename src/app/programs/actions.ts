"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getToday } from "@/lib/userDate";
import { isValidIsoDate } from "@/lib/date";
import { buildProgramSchedule, findProgram, MAX_PROGRAM_WEEKS, MIN_PROGRAM_WEEKS } from "@/lib/programs";

export type ApplyProgramInput = {
  programId: string;
  startDate: string;
  weekdays: number[];
  weeks: number;
};

export type ApplyProgramResult =
  | { error: string }
  | { success: true; created: number; skipped: number; firstDate: string };

type LibraryRow = {
  id: string;
  name: string;
  exercise_muscle_groups: { muscle_group_id: string }[] | null;
};

// Schedules a built-in program onto the calendar in one transaction (apply_program, migration
// 0022). Days that already have a plan are skipped, never overwritten. Exercises come from the
// shared library by name.
export async function applyProgram(input: ApplyProgramInput): Promise<ApplyProgramResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const program = findProgram(input.programId);
  if (!program) return { error: "Unknown program." };
  if (!isValidIsoDate(input.startDate)) {
    return { error: "Pick a valid start date." };
  }
  if (input.startDate < (await getToday())) return { error: "The start date can't be in the past." };
  if (!Number.isInteger(input.weeks) || input.weeks < MIN_PROGRAM_WEEKS || input.weeks > MAX_PROGRAM_WEEKS) {
    return { error: `Choose between ${MIN_PROGRAM_WEEKS} and ${MAX_PROGRAM_WEEKS} weeks.` };
  }
  if (!Array.isArray(input.weekdays) || !input.weekdays.some((d) => Number.isInteger(d) && d >= 0 && d <= 6)) {
    return { error: "Pick at least one training day." };
  }

  const schedule = buildProgramSchedule(program, input.startDate, input.weekdays, input.weeks);
  if (schedule.length === 0) return { error: "Nothing to schedule with these settings." };

  const names = [...new Set(program.days.flatMap((d) => d.exercises.map((e) => e.name)))];
  const { data: library, error: libraryError } = await supabase
    .from("exercises")
    .select("id, name, exercise_muscle_groups(muscle_group_id)")
    .is("user_id", null)
    .in("name", names);
  if (libraryError || !library) return { error: "Couldn't load the exercise library. Please try again." };

  const byName = new Map((library as unknown as LibraryRow[]).map((row) => [row.name, row]));
  const missing = names.filter((n) => !byName.has(n));
  if (missing.length > 0) {
    return { error: `The exercise library is missing ${missing.join(", ")}. Apply the latest database migrations.` };
  }

  const plans = schedule.map(({ date, day }) => {
    const rows = day.exercises.map((e) => byName.get(e.name)!);
    const muscleGroupIds = [
      ...new Set(rows.flatMap((r) => (r.exercise_muscle_groups ?? []).map((m) => m.muscle_group_id))),
    ];
    return {
      date,
      title: `${program.name} · ${day.title}`,
      muscle_group_ids: muscleGroupIds,
      exercises: day.exercises.map((e, position) => ({
        exercise_id: byName.get(e.name)!.id,
        position,
        target_sets: e.sets,
        target_reps: e.reps,
      })),
    };
  });

  const { data: created, error } = await supabase.rpc("apply_program", { p_plans: plans });
  if (error || typeof created !== "number") {
    return { error: "Couldn't schedule the program. Nothing was changed — please try again." };
  }

  revalidatePath("/calendar");
  revalidatePath("/");
  return { success: true, created, skipped: plans.length - created, firstDate: schedule[0].date };
}
