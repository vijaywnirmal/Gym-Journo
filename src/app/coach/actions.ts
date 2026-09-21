"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateWithGemini, GEMINI_MODEL } from "@/lib/gemini";
import { getProfile, getTrainingEvidence } from "@/lib/queries";
import { hasCoachConsent } from "@/lib/coach/consent";
import { COACH_LIMIT_PER_DAY, COACH_WINDOW_MS } from "@/lib/coach/limits";
import { evidenceIsEmpty, replySources, type CoachSource } from "@/lib/coach/presentation";
import { runCoach } from "@/lib/coach/run";
import { screenQuestion } from "@/lib/coach/screen";
import { saveCoachRecord } from "@/lib/coach/store";
import type { CoachReply } from "@/lib/coach/contract";

// Per attempt. The model's speed varies with provider load (about 4-13 seconds in testing) and it
// sometimes returns a transient 503, so give it room and retry twice after a short pause. Minimal
// thinking is enough for a strict, evidence-bound JSON answer and still passes verification.
const GEMINI_TIMEOUT_MS = 40_000;

export type AskCoachResult =
  | { status: "accepted"; reply: CoachReply; sources: CoachSource[] }
  | {
      status: "blocked" | "rejected" | "needs_consent" | "rate_limited" | "empty" | "error";
      message: string;
    };

const UNAVAILABLE = "Coach isn't available right now. Please try again later.";

export async function askCoach(question: string): Promise<AskCoachResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Not signed in" };

  // Consent is enforced here, on the server, not only in the UI.
  const profile = await getProfile();
  if (!hasCoachConsent(profile)) {
    return {
      status: "needs_consent",
      message: "Allow Coach to use your training data in Profile to ask questions.",
    };
  }

  // Questions Coach won't answer are turned away before anything is fetched or sent.
  const screened = screenQuestion(question);
  if (!screened.allowed) return { status: "blocked", message: screened.message };

  // Fail closed: if the exchange can't be counted (and so can't be recorded either), Coach is off.
  const since = new Date(Date.now() - COACH_WINDOW_MS).toISOString();
  const { count, error: countError } = await supabase
    .from("coach_replies")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .in("status", ["accepted", "rejected"])
    .gte("created_at", since);
  if (countError || count === null) return { status: "error", message: UNAVAILABLE };
  if (count >= COACH_LIMIT_PER_DAY) {
    return {
      status: "rate_limited",
      message: `You've reached today's limit of ${COACH_LIMIT_PER_DAY} Coach questions. Try again later.`,
    };
  }

  const evidence = await getTrainingEvidence();
  if (!evidence) return { status: "error", message: UNAVAILABLE };
  if (evidenceIsEmpty(evidence)) {
    return {
      status: "empty",
      message: "There are no training records to explain yet. Log a workout or a weight first.",
    };
  }

  const result = await runCoach({
    question: screened.question,
    evidence,
    model: GEMINI_MODEL,
    generate: (prompt) => generateWithGemini(prompt, {
        json: true,
        timeoutMs: GEMINI_TIMEOUT_MS,
        thinkingLevel: "minimal",
        retries: 2,
        retryDelayMs: 1500,
      }),
  });

  // The record is an audit trail. Failing to write it must not hide a verified answer.
  await saveCoachRecord(result.record);
  revalidatePath("/coach");

  if (result.status === "accepted" && result.reply) {
    return { status: "accepted", reply: result.reply, sources: replySources(result.reply, evidence) };
  }
  return { status: "rejected", message: result.message ?? UNAVAILABLE };
}
