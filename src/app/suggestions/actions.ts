"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAdaptSuggestions } from "@/lib/queries";
import { explainSuggestion } from "@/lib/analyze/overload";
import { formatDate } from "@/lib/date";

// Accept or reject a progressive-overload suggestion. The suggestion is recomputed here from the
// person's data — the client only says which planned exercise and what they decided, so a stale
// or tampered page can never apply a weight the rules didn't produce. Accepting changes that one
// planned exercise's target weight; rejecting changes nothing. Both are recorded.
export async function decideSuggestion(
  plannedExerciseId: string,
  accept: boolean
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  if (typeof plannedExerciseId !== "string" || typeof accept !== "boolean") return { error: "Invalid request." };

  const current = (await getAdaptSuggestions()).find((s) => s.plannedExerciseId === plannedExerciseId);
  if (!current) return { error: "This suggestion is no longer current — the page has been refreshed." };

  const { suggestion } = current;
  const { error } = await supabase.rpc("decide_recommendation", {
    p_planned_exercise_id: plannedExerciseId,
    p_kind: suggestion.kind,
    p_current_weight: suggestion.currentWeight,
    p_proposed_weight: suggestion.proposedWeight,
    p_weight_unit: suggestion.unit,
    p_reason: explainSuggestion(suggestion, formatDate),
    p_evidence: suggestion.evidence,
    p_accept: accept,
  });
  if (error) return { error: "Couldn't save your decision. Nothing was changed — please try again." };

  revalidatePath("/suggestions");
  revalidatePath("/");
  revalidatePath(`/schedule/${current.planDate}`);
  revalidatePath(`/log/${current.planDate}`);
  return { success: true };
}
