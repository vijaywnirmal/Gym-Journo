import type { TrainingEvidence } from "@/lib/analyze/evidence";
import type { CoachReply, CoachStatement } from "./contract";

// Deterministic checks of a parsed Coach reply against the evidence it was given. The model is
// never trusted: a statement survives only if every check passes, and a reply survives only if at
// least one statement does. These are code, not prompt instructions — they hold whatever the model
// does. They are a best-effort screen for language, not a proof of truth; the number and citation
// checks are exact.

export type IssueCode =
  | "unknown_citation"
  | "ungrounded_number"
  | "evaluative"
  | "raw_value"
  | "ungrounded_date"
  | "advice"
  | "medical"
  | "blocked_question"
  | "generation_failed"
  | "unparseable";

export type CoachIssue = { code: IssueCode; statementIndex: number | null; detail: string };

export type ValidationResult = {
  status: "accepted" | "rejected";
  reply: CoachReply | null;
  issues: CoachIssue[];
};

// Every citable section of the evidence, by id.
export function evidenceSections(evidence: TrainingEvidence): Map<string, unknown> {
  const sections = new Map<string, unknown>();
  sections.set(evidence.goal.id, evidence.goal);
  sections.set(evidence.training.recent.id, evidence.training.recent);
  sections.set(evidence.training.weekly.id, evidence.training.weekly);
  if (evidence.bodyWeight) sections.set(evidence.bodyWeight.id, evidence.bodyWeight);
  for (const exercise of evidence.exercises) sections.set(exercise.id, exercise);
  // An absence can be cited too: `absent:<id>` is valid only for sections the evidence lists as not recorded.
  for (const id of evidence.notRecorded) sections.set(`absent:${id}`, { notRecorded: id });
  return sections;
}

const round = (n: number) => Number(Math.abs(n).toFixed(4));

// Every number a statement citing `value` may legitimately mention: its numeric leaves (sign
// ignored) and the year, month and day of any ISO date it contains.
function collectNumbers(value: unknown, into: Set<number>): void {
  if (typeof value === "number") {
    into.add(round(value));
  } else if (typeof value === "string") {
    const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (date) for (const part of date.slice(1)) into.add(Number(part));
  } else if (Array.isArray(value)) {
    for (const item of value) collectNumbers(item, into);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectNumbers(item, into);
  }
}

// Every ISO date (yyyy-MM-dd) anywhere in a cited section.
function collectIsoDates(value: unknown, into: Set<string>): void {
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) into.add(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectIsoDates(item, into);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectIsoDates(item, into);
  }
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
// "Sep 21", "September 21, 2026", "Sep 21st" — a written month with a day, and optionally a year.
const MONTH_DAY =
  /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/gi;

// Values that leaked from the JSON instead of being said in words.
const RAW_VALUE = /\b(null|undefined|nan)\b/i;

const EVALUATIVE =
  /\b(progress\w*|improv\w*|regress\w*|plateau\w*|declin\w*|stronger|weaker|on track|off track|behind|ahead of|good|great|excellent|poor|bad|consistent\w*|inconsistent\w*|adheren\w*|success\w*|fail\w*|strong|weak|solid|impressive|disappoint\w*|better|worse|best|worst)\b/i;

// A number written as a word next to a unit ("eight reps") can't be checked against the evidence,
// so it is treated as ungrounded. The prompt asks for digits.
const SPELLED_NUMBER =
  /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|half|double|triple)\s+(kg|kgs|lb|lbs|kilograms?|pounds?|reps?|sets?|days?|sessions?|weeks?|times)\b/i;

const ADVICE =
  /\b(you should|should|recommend\w*|suggest\w*|advis\w*|consider|need to|must|deload\w*|train more|rest more|next step)\b/i;
const IMPERATIVE_START =
  /^(increase|decrease|reduce|add|lower|raise|try|keep|continue|aim|make sure|stick|focus|start|stop|avoid|take|use|do|don't|dont|ensure|be sure)\b/i;

const MEDICAL =
  /\b(diagnos\w*|injur\w*|pain\w*|hurt\w*|strain\w*|sprain\w*|medicat\w*|doctor|physician|physio\w*|disease|syndrome|overtrain\w*)\b/i;

// "in progress" is the status of the current week, not a verdict.
const withoutStatusPhrases = (text: string) => text.replace(/\bin progress\b/gi, "");

function hasAdvice(text: string): boolean {
  if (ADVICE.test(text)) return true;
  return text
    .split(/(?<=[.!?])\s+/)
    .some((sentence) => IMPERATIVE_START.test(sentence.trim()));
}

function checkStatement(
  statement: CoachStatement,
  index: number,
  sections: Map<string, unknown>
): CoachIssue[] {
  const issues: CoachIssue[] = [];
  const at = (code: IssueCode, detail: string) => issues.push({ code, statementIndex: index, detail });

  const unknown = statement.cites.filter((id) => !sections.has(id));
  if (unknown.length > 0) at("unknown_citation", `cites unknown section(s): ${unknown.join(", ")}`);

  if (unknown.length === 0) {
    const allowed = new Set<number>();
    const isoDates = new Set<string>();
    for (const id of statement.cites) {
      collectNumbers(sections.get(id), allowed);
      collectIsoDates(sections.get(id), isoDates);
    }
    const ungrounded = (statement.text.match(/\d+(?:\.\d+)?/g) ?? []).filter(
      (token) => !allowed.has(round(Number(token)))
    );
    if (ungrounded.length > 0) {
      at("ungrounded_number", `not in the cited evidence: ${[...new Set(ungrounded)].join(", ")}`);
    }

    // A written date ("Sep 21") must be a real date in the cited sections — month and day (and year,
    // if given) together, not just numbers that happen to be present.
    const badDates = [...statement.text.matchAll(MONTH_DAY)].filter((match) => {
      const month = MONTHS[match[1].slice(0, 3).toLowerCase()];
      const day = Number(match[2]);
      const year = match[3] ? Number(match[3]) : null;
      return ![...isoDates].some((iso) => {
        const [y, m, d] = iso.split("-").map(Number);
        return m === month && d === day && (year === null || y === year);
      });
    });
    if (badDates.length > 0) {
      at("ungrounded_date", `not a date in the cited evidence: ${badDates.map((m) => m[0]).join(", ")}`);
    }
  }

  if (SPELLED_NUMBER.test(statement.text)) at("ungrounded_number", "a number is written as a word and cannot be checked");

  if (RAW_VALUE.test(statement.text)) at("raw_value", "contains a raw value (null/undefined) instead of words");

  const plain = withoutStatusPhrases(statement.text);
  if (EVALUATIVE.test(plain)) at("evaluative", "contains an evaluative verdict");
  if (hasAdvice(statement.text)) at("advice", "contains a recommendation or instruction");
  if (MEDICAL.test(statement.text)) at("medical", "mentions medical, injury or pain content");

  return issues;
}

// Statement-level problems drop that statement; medical content anywhere rejects the whole reply.
export function validateCoachReply(reply: CoachReply, evidence: TrainingEvidence): ValidationResult {
  const sections = evidenceSections(evidence);
  const issues: CoachIssue[] = [];
  const kept: CoachStatement[] = [];

  reply.statements.forEach((statement, index) => {
    const found = checkStatement(statement, index, sections);
    issues.push(...found);
    if (found.length === 0) kept.push(statement);
  });

  const questions: string[] = [];
  reply.questions.forEach((question) => {
    if (MEDICAL.test(question)) {
      issues.push({ code: "medical", statementIndex: null, detail: "a question mentions medical, injury or pain content" });
    } else if (hasAdvice(question) && !question.trim().endsWith("?")) {
      issues.push({ code: "advice", statementIndex: null, detail: "a question is phrased as an instruction" });
    } else {
      questions.push(question);
    }
  });

  if (issues.some((i) => i.code === "medical") || kept.length === 0) {
    return { status: "rejected", reply: null, issues };
  }
  return { status: "accepted", reply: { statements: kept, questions }, issues };
}
