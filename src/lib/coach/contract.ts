import { z } from "zod";

// The Coach output contract (stage C1 — explain only).
//
// The model must answer with JSON in exactly this shape. Anything else — extra keys, missing
// citations, oversized text — fails parsing and is never shown. Free text is deliberately narrow:
// short statements, each classed as a `fact` (restates the evidence) or an `interpretation` (a
// cautious reading of it) and each citing the evidence section ids it rests on, so the checks in
// validate.ts can verify it against the evidence bundle.

export const MAX_STATEMENTS = 12;
export const MAX_STATEMENT_LENGTH = 400;
export const MAX_CITES = 6;
export const MAX_QUESTIONS = 3;
export const MAX_QUESTION_LENGTH = 200;

export const CoachReplySchema = z.strictObject({
  statements: z
    .array(
      z.strictObject({
        kind: z.enum(["fact", "interpretation"]),
        text: z.string().trim().min(1).max(MAX_STATEMENT_LENGTH),
        cites: z.array(z.string().min(1)).min(1).max(MAX_CITES),
      })
    )
    .min(1)
    .max(MAX_STATEMENTS),
  questions: z.array(z.string().trim().min(1).max(MAX_QUESTION_LENGTH)).max(MAX_QUESTIONS).default([]),
});

export type CoachReply = z.output<typeof CoachReplySchema>;
export type CoachStatement = CoachReply["statements"][number];

export type ParseResult = { ok: true; reply: CoachReply } | { ok: false; error: "not_json" | "schema" };

// Models often wrap JSON in a code fence or a sentence of prose; tolerate exactly that, nothing
// more. What comes out must still pass the strict schema.
function extractJson(raw: string): unknown {
  const text = raw.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text);
  const candidates = [text];
  if (fenced) candidates.push(fenced[1]);
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) candidates.push(text.slice(start, end + 1));

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try the next form
    }
  }
  throw new Error("not json");
}

export function parseCoachReply(raw: string): ParseResult {
  let json: unknown;
  try {
    json = extractJson(raw);
  } catch {
    return { ok: false, error: "not_json" };
  }
  const parsed = CoachReplySchema.safeParse(json);
  return parsed.success ? { ok: true, reply: parsed.data } : { ok: false, error: "schema" };
}
