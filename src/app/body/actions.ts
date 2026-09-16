"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validateMeasurementDate, validateMeasurementNote, validateWeightKg } from "@/lib/validation";

export type SaveMeasurementInput = {
  date: string;
  weightKg: number;
  notes: string;
};

export async function saveMeasurement(input: SaveMeasurementInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const dateError = validateMeasurementDate(input.date);
  if (dateError) return { error: dateError };

  const weightError = validateWeightKg(input.weightKg);
  if (weightError) return { error: weightError };

  const trimmedNotes = input.notes.trim();
  const notesError = validateMeasurementNote(trimmedNotes);
  if (notesError) return { error: notesError };

  // One row per (user, date) — this upsert is how "editing" an existing date's entry works,
  // and how a new date's entry is created; each date's row is otherwise fully independent.
  const { error } = await supabase.from("body_measurements").upsert(
    {
      user_id: user.id,
      date: input.date,
      weight_kg: input.weightKg,
      notes: trimmedNotes || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,date" }
  );

  if (error) {
    return { error: "Something went wrong saving this entry. Please try again." };
  }

  revalidatePath("/body");
  return { success: true };
}

export async function deleteMeasurement(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { error, count } = await supabase
    .from("body_measurements")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) {
    return { error: "Something went wrong deleting this entry. Please try again." };
  }
  if (!count) {
    return { error: "Unable to delete this entry." };
  }

  revalidatePath("/body");
  return { success: true };
}
