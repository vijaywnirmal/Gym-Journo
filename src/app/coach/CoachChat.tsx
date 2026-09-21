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
          className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-base text-neutral-100"
        />
        <button
          type="submit"
          disabled={pending || question.trim() === ""}
          className="rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 disabled:opacity-50"
        >
          {pending ? "Checking your records…" : "Ask Coach"}
        </button>
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
            className="rounded-full border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 disabled:opacity-50"
          >
            {suggestion}
          </button>
        ))}
      </div>

      {result?.status === "accepted" ? (
        <CoachReplyView reply={result.reply} sources={result.sources} />
      ) : result ? (
        <p
          className={`rounded-xl border border-neutral-800 p-4 text-sm ${
            result.status === "blocked" || result.status === "empty" ? "text-neutral-300" : "text-neutral-400"
          }`}
        >
          {result.message}
        </p>
      ) : null}
    </div>
  );
}
