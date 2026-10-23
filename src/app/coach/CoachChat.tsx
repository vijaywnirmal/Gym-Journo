"use client";

import { useState, useTransition } from "react";
import { MAX_COACH_QUESTION_LENGTH } from "@/lib/coach/screen";
import { askCoach, type AskCoachResult } from "./actions";
import CoachReplyView from "./CoachReplyView";
import type { CoachReply } from "@/lib/coach/contract";
import type { CoachSource } from "@/lib/coach/presentation";

// The person's most recent verified answer, so it is still there after a reload.
// askedAt is formatted on the server in the person's time zone (see formatDateTimeIn).
export type LastCoachAnswer = { question: string; askedAt: string; reply: CoachReply; sources: CoachSource[] };

const SUGGESTIONS = [
  "What changed in the last two weeks?",
  "How many days did I train each week recently?",
  "What do my records show for my body weight?",
];

// One question, one answer — no conversation memory. Every answer comes back already verified
// against the person's records by the server.
export default function CoachChat({ lastAnswer = null }: { lastAnswer?: LastCoachAnswer | null }) {
  const [pending, startTransition] = useTransition();
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  const [result, setResult] = useState<AskCoachResult | null>(
    lastAnswer ? { status: "accepted", reply: lastAnswer.reply, sources: lastAnswer.sources } : null
  );
  // Shown above the answer until a new question replaces it.
  const [answerFor, setAnswerFor] = useState<{ question: string; askedAt: string | null } | null>(
    lastAnswer ? { question: lastAnswer.question, askedAt: lastAnswer.askedAt } : null
  );

  function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setResult(null);
    setAsked(trimmed);
    setAnswerFor({ question: trimmed, askedAt: null });
    startTransition(async () => {
      setResult(await askCoach(trimmed));
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="flex flex-col gap-2"
      >
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={MAX_COACH_QUESTION_LENGTH}
          rows={3}
          aria-label="Your question for Coach"
          placeholder="Ask about what your records show…"
          className="field w-full rounded-lg px-3 py-2.5 text-base"
        />
        <button
          type="submit"
          disabled={pending || question.trim() === ""}
          className="h-10 rounded-[10px] bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-50"
        >
          {pending ? "Checking your records…" : "Ask Coach"}
        </button>
        {pending && (
          <p className="text-xs text-label-2">
            Coach checks every statement against your records, so this can take up to about 30 seconds.
          </p>
        )}
      </form>

      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            disabled={pending}
            onClick={() => {
              setQuestion(suggestion);
              ask(suggestion);
            }}
            className="rounded-full bg-fill px-3 py-1.5 text-xs text-label disabled:opacity-50"
          >
            {suggestion}
          </button>
        ))}
      </div>

      <div aria-live="polite">
        {result && answerFor && (
          <p className="mb-2 text-xs text-label-2">
            You asked: &ldquo;{answerFor.question}&rdquo;
            {answerFor.askedAt ? ` · ${answerFor.askedAt}` : ""}
          </p>
        )}
        {result?.status === "accepted" ? (
          <CoachReplyView reply={result.reply} sources={result.sources} />
        ) : result ? (
          result.status === "blocked" || result.status === "empty" ? (
            <p className="card p-4 text-sm text-label">{result.message}</p>
          ) : (
            // Coach failed (or refused for a reason that may pass): shown as an error, with a retry.
            <div role="alert" className="card flex flex-wrap items-center gap-3 border-red/30 bg-red/5 p-4 text-sm">
              <p className="min-w-0 flex-1 text-red">{result.message}</p>
              {asked && result.status !== "needs_consent" && (
                <button
                  type="button"
                  onClick={() => ask(asked)}
                  disabled={pending}
                  className="h-8 rounded-lg border border-separator px-3 font-medium text-label hover:bg-fill disabled:opacity-50"
                >
                  Try again
                </button>
              )}
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}
