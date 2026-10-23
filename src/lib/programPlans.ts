import type { SupabaseClient } from "@supabase/supabase-js";
import { isValidIsoDate } from "@/lib/date";
import { buildProgramSchedule, findProgram, MAX_PROGRAM_WEEKS, MIN_PROGRAM_WEEKS } from "@/lib/programs";

export type ApplyProgramInput = {
  programId: string;
  startDate: string;
  weekdays: number[];
  weeks: number;
};

export type ProgramPlan = {
  date: string;
  title: string;
  muscle_group_ids: string[];
  exercises: { exercise_id: string; position: number; target_sets: number; target_reps: number }[];
};

type LibraryRow = {
  id: string;
  name: string;
  exercise_muscle_groups: { muscle_group_id: string }[] | null;
};

// Checks a program request and turns it into the plans apply_program (or apply_program_for_client)
// takes. today is the day of whoever the plans are for. Exercises come from the shared library by
// name, so they're visible to everyone.
export async function programPlans(
  supabase: SupabaseClient,
  input: ApplyProgramInput,
  today: string
): Promise<{ error: string } | { plans: ProgramPlan[]; firstDate: string }> {
  const program = findProgram(input.programId);
  if (!program) return { error: "Unknown program." };
  if (!isValidIsoDate(input.startDate)) {
    return { error: "Pick a valid start date." };
  }
  if (input.startDate < today) return { error: "The start date can't be in the past." };
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
  return { plans, firstDate: schedule[0].date };
}
