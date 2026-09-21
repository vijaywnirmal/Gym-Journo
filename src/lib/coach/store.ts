import { createClient } from "@/lib/supabase/server";
import type { CoachRecord } from "./run";

// Persists one Coach exchange to coach_replies (see 0013_add_coach_replies.sql). Nothing calls this
// yet — it is the write side of the record the future Coach UI will use.
export async function saveCoachRecord(record: CoachRecord) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" as const };

  const { error } = await supabase.from("coach_replies").insert({
    user_id: user.id,
    question: record.question,
    evidence: record.evidence,
    status: record.status,
    reply: record.reply,
    raw_reply: record.rawReply,
    issues: record.issues,
    model: record.model,
  });

  if (error) return { error: "Couldn't save this exchange." as const };
  return { success: true as const };
}
