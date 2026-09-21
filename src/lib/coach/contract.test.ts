import { describe, expect, it } from "vitest";
import { MAX_STATEMENTS, MAX_STATEMENT_LENGTH, parseCoachReply } from "./contract";

const valid = {
  statements: [{ kind: "fact", text: "Bench Press was performed on Sep 18.", cites: ["exercise.ex-bench"] }],
  questions: ["Was Sep 11 a heavier session?"],
};

describe("parseCoachReply", () => {
  it("accepts a well-formed reply", () => {
    const result = parseCoachReply(JSON.stringify(valid));
    expect(result).toEqual({ ok: true, reply: valid });
  });

  it("defaults questions to an empty list", () => {
    const { questions: _q, ...noQuestions } = valid;
    void _q;
    const result = parseCoachReply(JSON.stringify(noQuestions));
    expect(result.ok && result.reply.questions).toEqual([]);
  });

  it("tolerates a code fence around the JSON", () => {
    expect(parseCoachReply("```json\n" + JSON.stringify(valid) + "\n```").ok).toBe(true);
    expect(parseCoachReply("```\n" + JSON.stringify(valid) + "\n```").ok).toBe(true);
  });

  it("tolerates a sentence of prose around the JSON", () => {
    expect(parseCoachReply("Here you go: " + JSON.stringify(valid) + " Hope that helps!").ok).toBe(true);
  });

  it("rejects text that is not JSON", () => {
    expect(parseCoachReply("Your bench is improving!")).toEqual({ ok: false, error: "not_json" });
    expect(parseCoachReply("")).toEqual({ ok: false, error: "not_json" });
  });

  it("rejects extra keys anywhere — a model cannot smuggle in a 'recommendations' field", () => {
    expect(parseCoachReply(JSON.stringify({ ...valid, recommendations: ["add weight"] }))).toEqual({
      ok: false,
      error: "schema",
    });
    const nested = { statements: [{ ...valid.statements[0], severity: "high" }] };
    expect(parseCoachReply(JSON.stringify(nested))).toEqual({ ok: false, error: "schema" });
  });

  it("requires at least one citation on every statement", () => {
    const noCites = { statements: [{ kind: "fact", text: "x", cites: [] }] };
    expect(parseCoachReply(JSON.stringify(noCites)).ok).toBe(false);
    const missingCites = { statements: [{ kind: "fact", text: "x" }] };
    expect(parseCoachReply(JSON.stringify(missingCites)).ok).toBe(false);
  });

  it("only allows the kinds fact and interpretation", () => {
    const bad = { statements: [{ kind: "recommendation", text: "x", cites: ["goal"] }] };
    expect(parseCoachReply(JSON.stringify(bad)).ok).toBe(false);
  });

  it("requires at least one statement and caps how many", () => {
    expect(parseCoachReply(JSON.stringify({ statements: [] })).ok).toBe(false);
    const many = { statements: Array.from({ length: MAX_STATEMENTS + 1 }, () => valid.statements[0]) };
    expect(parseCoachReply(JSON.stringify(many)).ok).toBe(false);
  });

  it("caps statement length and the number of questions", () => {
    const long = { statements: [{ ...valid.statements[0], text: "x".repeat(MAX_STATEMENT_LENGTH + 1) }] };
    expect(parseCoachReply(JSON.stringify(long)).ok).toBe(false);
    expect(parseCoachReply(JSON.stringify({ ...valid, questions: ["a?", "b?", "c?", "d?"] })).ok).toBe(false);
  });
});
