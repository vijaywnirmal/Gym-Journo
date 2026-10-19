"use client";

import { useState, useTransition } from "react";
import { MAX_COACH_QUESTION_LENGTH } from "@/lib/coach/screen";
import { askCoach, type AskCoachResult } from "./actions";
import CoachReplyView from "./CoachReplyView";

const SUGGESTIONS = [
  "What changed in the last two weeks?",
  "How many days did I train each week recently?",
  "What do my records show for my body weight?",
];

// One question, one answer — no conversation memory. Every answer comes back already verified
// against the person's records by the server.
export default function CoachChat() {
  const [pending, startTransition] = useTransition();
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AskCoachResult | null>(null);

  function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setResult(null);
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

      {result?.status === "accepted" ? (
        <CoachReplyView reply={result.reply} sources={result.sources} />
      ) : result ? (
        <p
          className={`card p-4 text-sm ${
            result.status === "blocked" || result.status === "empty" ? "text-label" : "text-label-2"
          }`}
        >
          {result.message}
        </p>
      ) : null}
    </div>
  );
}
