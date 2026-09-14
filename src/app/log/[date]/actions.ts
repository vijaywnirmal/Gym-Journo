"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SaveLogInput = {
  date: string;
  planId: string | null;
  notes: string;
  completed: boolean;
  exercises: {
    exerciseId: string;
    sets: { reps: number | null; weight: number | null; weightUnit: string }[];
  }[];
};

export async function saveLog(input: SaveLogInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { data: log, error: upsertError } = await supabase
    .from("workout_logs")
    .upsert(
      {
        user_id: user.id,
        date: input.date,
        plan_id: input.planId,
        notes: input.notes || null,
        completed_at: input.completed ? new Date().toISOString() : null,
      },
      { onConflict: "user_id,date" }
    )
    .select()
    .single();

  if (upsertError || !log) return { error: upsertError?.message ?? "Failed to save log" };

  await supabase.from("logged_exercises").delete().eq("log_id", log.id);

  for (let i = 0; i < input.exercises.length; i++) {
    const ex = input.exercises[i];
    const { data: loggedExercise, error: leError } = await supabase
      .from("logged_exercises")
      .insert({ log_id: log.id, exercise_id: ex.exerciseId, position: i })
      .select()
      .single();

    if (leError || !loggedExercise) continue;

    if (ex.sets.length > 0) {
      await supabase.from("logged_sets").insert(
        ex.sets.map((s, setIndex) => ({
          logged_exercise_id: loggedExercise.id,
          set_number: setIndex + 1,
          reps: s.reps,
          weight: s.weight,
          weight_unit: s.weightUnit,
        }))
      );
    }
  }

  revalidatePath(`/log/${input.date}`);
  revalidatePath("/history");
  revalidatePath("/calendar");
  revalidatePath("/");
  return { success: true };
}
