// Screens a question before any model is called. Stage C1 explains what the records show; it does
// not recommend, and it never handles pain or injury. Blocked questions get a fixed, honest reply
// and no model call is made.

export const MAX_COACH_QUESTION_LENGTH = 500;

export type ScreenResult =
  | { allowed: true; question: string }
  | {
      allowed: false;
      reason: "empty" | "too_long" | "pain_or_injury" | "recommendation_request";
      message: string;
    };

const PAIN_OR_INJURY =
  /\b(pain\w*|hurt\w*|injur\w*|strain\w*|sprain\w*|torn|swollen|swelling|numb\w*|dizzy|faint\w*|chest pain)\b/i;

const RECOMMENDATION_REQUEST =
  /\b(should i|what should|how (much|many|often|long) should|recommend\w*|advise|advice|what do you suggest|suggest\w* (a|an|some|me)|tell me what to|plan for me|write me|program for me)\b/i;

export const BLOCKED_MESSAGES = {
  empty: "Ask a question about your training records.",
  too_long: `Please keep your question under ${MAX_COACH_QUESTION_LENGTH} characters.`,
  pain_or_injury:
    "I can't help with pain or injuries. If something hurts or worries you, please talk to a doctor or physiotherapist.",
  recommendation_request:
    "Coach can explain what your records show, but it doesn't make recommendations yet. Try asking what changed or what your records show.",
} as const;

export function screenQuestion(raw: string): ScreenResult {
  const question = raw.trim();
  if (question.length === 0) return { allowed: false, reason: "empty", message: BLOCKED_MESSAGES.empty };
  if (question.length > MAX_COACH_QUESTION_LENGTH) {
    return { allowed: false, reason: "too_long", message: BLOCKED_MESSAGES.too_long };
  }
  // Safety first: pain/injury wins over a recommendation request.
  if (PAIN_OR_INJURY.test(question)) {
    return { allowed: false, reason: "pain_or_injury", message: BLOCKED_MESSAGES.pain_or_injury };
  }
  if (RECOMMENDATION_REQUEST.test(question)) {
    return {
      allowed: false,
      reason: "recommendation_request",
      message: BLOCKED_MESSAGES.recommendation_request,
    };
  }
  return { allowed: true, question };
}
