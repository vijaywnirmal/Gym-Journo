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

  const rejected = (rawReply: string | null, issues: CoachIssue[]): CoachRunResult => ({
    status: "rejected",
    reply: null,
    message: REJECTED_MESSAGE,
    record: { ...base, question: screened.question, status: "rejected", reply: null, rawReply, issues },
  });

  let raw: string;
  try {
    raw = await generate(buildCoachPrompt(evidence, screened.question));
  } catch {
    // The provider's error text is deliberately not surfaced or stored.
    return rejected(null, [{ code: "generation_failed", statementIndex: null, detail: "the model call failed" }]);
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
