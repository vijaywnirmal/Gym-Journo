import type { Metadata } from "next";
import { getProfile } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { replySources } from "@/lib/coach/presentation";
import type { CoachReply } from "@/lib/coach/contract";
import type { TrainingEvidence } from "@/lib/analyze/evidence";
import { hasCoachConsent } from "@/lib/coach/consent";
import PageHeader from "@/components/PageHeader";
import { CoachConsentPrompt } from "@/app/profile/CoachConsentSection";
import { formatDateTimeIn } from "@/lib/date";
import CoachChat, { type LastCoachAnswer } from "./CoachChat";

export const metadata: Metadata = { title: "Coach" };

// The latest verified answer, rebuilt from its saved record (the reply and the exact evidence it
// was checked against), so it survives a reload. null when there is none or it can't be read.
async function getLastAnswer(userId: string, timeZone: string | null): Promise<LastCoachAnswer | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("coach_replies")
    .select("question, reply, evidence, created_at")
    .eq("user_id", userId)
    .eq("status", "accepted")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.reply || !data.evidence) return null;
  try {
    const reply = data.reply as CoachReply;
    return {
      question: data.question,
      askedAt: formatDateTimeIn(data.created_at, timeZone),
      reply,
      sources: replySources(reply, data.evidence as TrainingEvidence),
    };
  } catch {
    return null;
  }
}

export default async function CoachPage() {
  const profile = await getProfile();
  const consented = hasCoachConsent(profile);
  const lastAnswer = consented && profile ? await getLastAnswer(profile.id, profile.timezone) : null;

  return (
    <main className="px-4 pt-6 md:px-8 md:pt-10">
      <PageHeader
        title="Coach"
        subtitle="Explains what your training records show. It doesn't give advice or help with pain or injuries."
        back={{ href: "/", label: "Today" }}
      />
      {consented ? <CoachChat lastAnswer={lastAnswer} /> : <CoachConsentPrompt />}
    </main>
  );
}
