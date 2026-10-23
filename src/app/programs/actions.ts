"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getToday } from "@/lib/userDate";
import { isValidIsoDate } from "@/lib/date";
import { findProgram } from "@/lib/programs";
import { programPlans, type ApplyProgramInput } from "@/lib/programPlans";

export type { ApplyProgramInput };

export type ApplyProgramResult =
  | { error: string }
  | { success: true; created: number; skipped: number; firstDate: string; createdDates: string[] };

// Schedules a built-in program onto the calendar in one transaction (apply_program, migration
// 0022). Days that already have a plan are skipped, never overwritten. Exercises come from the
// shared library by name.
export async function applyProgram(input: ApplyProgramInput): Promise<ApplyProgramResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const built = await programPlans(supabase, input, await getToday());
  if ("error" in built) return built;
  const { plans } = built;

  // Days that already have a plan are skipped by apply_program; knowing which lets "Undo" remove
  // exactly the days this created, never a plan that was there before.
  const { data: existing, error: existingError } = await supabase
    .from("workout_plans")
    .select("date")
    .eq("user_id", user.id)
    .in("date", plans.map((p) => p.date));
  if (existingError) return { error: "Couldn't schedule the program. Nothing was changed — please try again." };
  const alreadyPlanned = new Set((existing ?? []).map((row) => row.date as string));

  const { data: created, error } = await supabase.rpc("apply_program", { p_plans: plans });
  if (error || typeof created !== "number") {
    return { error: "Couldn't schedule the program. Nothing was changed — please try again." };
  }

  revalidatePath("/calendar");
  revalidatePath("/");
  return {
    success: true,
    created,
    skipped: plans.length - created,
    firstDate: built.firstDate,
    createdDates: plans.map((p) => p.date).filter((date) => !alreadyPlanned.has(date)),
  };
}

// Undoes applyProgram: removes the plans it created on those dates, recognised by the program's
// titles, so a plan the person has since retitled or replaced stays.
export async function undoProgram(programId: string, dates: string[]): Promise<{ error: string } | { removed: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const program = findProgram(programId);
  if (!program) return { error: "Unknown program." };
  if (!Array.isArray(dates) || dates.length === 0 || dates.length > 200 || !dates.every(isValidIsoDate)) {
    return { error: "Nothing to undo." };
  }

  const { data: rows, error } = await supabase
    .from("workout_plans")
    .select("id, title")
    .eq("user_id", user.id)
    .in("date", dates);
  if (error) return { error: "Couldn't undo the program. Please try again." };
  const ids = (rows ?? [])
    .filter((row) => typeof row.title === "string" && row.title.startsWith(`${program.name} · `))
    .map((row) => row.id as string);
  if (ids.length > 0) {
    const { error: deleteError } = await supabase.from("workout_plans").delete().eq("user_id", user.id).in("id", ids);
    if (deleteError) return { error: "Couldn't undo the program. Please try again." };
  }

  revalidatePath("/calendar");
  revalidatePath("/");
  return { removed: ids.length };
}
