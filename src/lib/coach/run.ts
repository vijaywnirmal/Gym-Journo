import type { TrainingEvidence } from "@/lib/analyze/evidence";
import { parseCoachReply, type CoachReply } from "./contract";
import { buildCoachPrompt } from "./prompt";
import { screenQuestion } from "./screen";
import { validateCoachReply, type CoachIssue } from "./validate";

// One Coach exchange, end to end: screen the question, build the prompt from the evidence, call
// the injected model, parse against the strict contract, verify against the evidence. The model
// call is injected so this is provider-independent and testable without a network. Nothing here
// talks to a database or a provider.

export type CoachStatus = "accepted" | "rejected" | "blocked";

// Everything worth keeping about the exchange, so a bad answer can be replayed and audited.
export type CoachRecord = {
  question: string;
  evidence: TrainingEvidence;
  status: CoachStatus;
  reply: CoachReply | null;
  rawReply: string | null;
  issues: CoachIssue[];
  model: string | null;
};

export type CoachRunResult = {
  status: CoachStatus;
  reply: CoachReply | null;
  // Set when there is no reply to show: a fixed, safe message (never provider or validation detail).
  message: string | null;
  record: CoachRecord;
};

// 429 is a provider's rate/quota limit; 402 means prepaid credits or a budget are used up (Gemini's
// prepay billing and gateways both answer this way).
function isQuotaError(error: unknown): boolean {
  return error instanceof Error && /failed \((429|402)\)/.test(error.message);
}

// "timed out", "http 503", or a generic fallback — never the provider's own message.
export function describeGenerationFailure(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") return "the model call timed out";
    const status = /failed \((\d{3})\)/.exec(error.message)?.[1];
    if (status) return `the model call failed (http ${status})`;
  }
  return "the model call failed";
}

// Shown when the model could not be reached or refused (quota, overload, timeout) — distinct from a
// reply that failed verification, so the person isn't told their records couldn't be checked.
// The provider refused because a usage quota or prepaid credit is used up (HTTP 429 or 402). Unlike a
// busy spell this doesn't clear in a minute — a daily quota can take hours, and credits need topping up
// — so it says so.
export const QUOTA_MESSAGE =
  "Coach's language model has reached its usage limit or run out of credits. Please try again later.";

export const UNAVAILABLE_MESSAGE = "Coach couldn't get an answer just now. Please try again in a minute.";

export const REJECTED_MESSAGE =
  "Coach couldn't produce an answer it could verify against your records. Please try again.";

export async function runCoach(args: {
  question: string;
  evidence: TrainingEvidence;
  generate: (prompt: string) => Promise<string>;
  model?: string | null;
}): Promise<CoachRunResult> {
  const { evidence, generate } = args;
  const model = args.model ?? null;
  const base = { evidence, model };

  const screened = screenQuestion(args.question);
  if (!screened.allowed) {
    return {
      status: "blocked",
      reply: null,
      message: screened.message,
      record: {
        ...base,
        question: args.question,
        status: "blocked",
        reply: null,
        rawReply: null,
        issues: [{ code: "blocked_question", statementIndex: null, detail: screened.reason }],
      },
    };
  }

  const rejected = (
    rawReply: string | null,
    issues: CoachIssue[],
    message: string = REJECTED_MESSAGE
  ): CoachRunResult => ({
    status: "rejected",
    reply: null,
    message,
    record: { ...base, question: screened.question, status: "rejected", reply: null, rawReply, issues },
  });

  let raw: string;
  try {
    raw = await generate(buildCoachPrompt(evidence, screened.question));
  } catch (error) {
    // The provider's error text is deliberately not surfaced or stored — only a coarse category, so
    // a failure can still be diagnosed from the record.
    return rejected(
      null,
      [{ code: "generation_failed", statementIndex: null, detail: describeGenerationFailure(error) }],
      isQuotaError(error) ? QUOTA_MESSAGE : UNAVAILABLE_MESSAGE
    );
  }

  const parsed = parseCoachReply(raw);
  if (!parsed.ok) {
    return rejected(raw, [{ code: "unparseable", statementIndex: null, detail: parsed.error }]);
  }

  const validation = validateCoachReply(parsed.reply, evidence);
  if (validation.status === "rejected") return rejected(raw, validation.issues);

  return {
    status: "accepted",
    reply: validation.reply,
    message: null,
    record: {
      ...base,
      question: screened.question,
      status: "accepted",
      reply: validation.reply,
      rawReply: raw,
      issues: validation.issues,
    },
  };
}
