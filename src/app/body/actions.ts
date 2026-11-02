"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getToday } from "@/lib/userDate";
import { validateMeasurementDate, validateMeasurementNote, validateWeightKg } from "@/lib/validation";

export type SaveMeasurementInput = {
  date: string;
  weightKg: number;
  notes: string;
};

// The profile's weight (shown on Profile, used by AI plans) follows the newest logged entry. It only
// changes when the entry at changedDate is, or was, the newest: an older entry added later leaves
// it alone, and deleting the newest falls back to the one before. Deleting the only entry leaves
// it too. Best-effort: the entry itself is already saved, so a failure here doesn't undo that.
async function syncProfileWeight(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  changedDate: string
) {
  const { data: newest, error } = await supabase
    .from("body_measurements")
    .select("date, weight_kg")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("Reading the newest weight failed:", error.message);
    return;
  }
  if (!newest || newest.date > changedDate) return;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ weight_kg: newest.weight_kg, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (profileError) console.error("Updating the profile weight failed:", profileError.message);
}

export async function saveMeasurement(input: SaveMeasurementInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const dateError = validateMeasurementDate(input.date, await getToday());
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

  await syncProfileWeight(supabase, user.id, input.date);
  revalidatePath("/body");
  revalidatePath("/profile");
  return { success: true };
}

export async function deleteMeasurement(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { data: deleted, error } = await supabase
    .from("body_measurements")
    .delete()
    .eq("id", id)
    .select("date");

  if (error) {
    return { error: "Something went wrong deleting this entry. Please try again." };
  }
  if (!deleted?.length) {
    return { error: "Unable to delete this entry." };
  }

  await syncProfileWeight(supabase, user.id, deleted[0].date);
  revalidatePath("/body");
  revalidatePath("/profile");
  return { success: true };
}
