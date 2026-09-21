import { describe, expect, it, vi } from "vitest";
import { describeGenerationFailure, QUOTA_MESSAGE, REJECTED_MESSAGE, runCoach, UNAVAILABLE_MESSAGE } from "./run";
import { BLOCKED_MESSAGES } from "./screen";
import { BENCH_ID, coachEvidence } from "./testFixtures";

const evidence = coachEvidence();

const goodReply = JSON.stringify({
  statements: [
    { kind: "fact", text: "Bench Press was last performed on Sep 18, 7 days after Sep 11.", cites: [BENCH_ID] },
    { kind: "fact", text: "Set 1 was 80 kg for 8 reps on Sep 18 and 80 kg for 6 reps on Sep 11.", cites: [BENCH_ID] },
  ],
  questions: [],
});

const run = (generate: (p: string) => Promise<string>, question = "What changed in Bench Press?") =>
  runCoach({ question, evidence, generate, model: "test-model" });

describe("runCoach", () => {
  it("accepts a verified reply and records everything needed to replay it", async () => {
    const generate = vi.fn().mockResolvedValue(goodReply);
    const result = await run(generate);

    expect(result.status).toBe("accepted");
    expect(result.message).toBeNull();
    expect(result.reply?.statements).toHaveLength(2);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate.mock.calls[0][0]).toContain(JSON.stringify(evidence));

    expect(result.record).toMatchObject({
      question: "What changed in Bench Press?",
      status: "accepted",
      rawReply: goodReply,
      issues: [],
      model: "test-model",
    });
    expect(result.record.evidence).toEqual(evidence);
    expect(result.record.reply).toEqual(result.reply);
  });

  it("blocks a recommendation request without calling the model", async () => {
    const generate = vi.fn();
    const result = await run(generate, "Should I increase the weight?");
    expect(generate).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: "blocked", reply: null, message: BLOCKED_MESSAGES.recommendation_request });
    expect(result.record.issues).toEqual([{ code: "blocked_question", statementIndex: null, detail: "recommendation_request" }]);
    expect(result.record.rawReply).toBeNull();
  });

  it("blocks a pain question with the fixed safe message and no model call", async () => {
    const generate = vi.fn();
    const result = await run(generate, "My elbow hurts on bench");
    expect(generate).not.toHaveBeenCalled();
    expect(result.status).toBe("blocked");
    expect(result.message).toBe(BLOCKED_MESSAGES.pain_or_injury);
  });

  it("a failed model call is rejected with a generic message — the provider's error is never surfaced or stored", async () => {
    const result = await run(async () => {
      throw new Error("Gemini request failed (500): {\"secret\":\"key=AIza-123\"}");
    });
    // A provider failure is not told to the person as "couldn't verify your records".
    expect(result).toMatchObject({ status: "rejected", reply: null, message: UNAVAILABLE_MESSAGE });
    expect(UNAVAILABLE_MESSAGE).not.toBe(REJECTED_MESSAGE);
    expect(JSON.stringify(result)).not.toContain("AIza-123");
    // Only a coarse category is kept (here the HTTP status) — never the provider's text or the key.
    expect(result.record.issues).toEqual([
      { code: "generation_failed", statementIndex: null, detail: "the model call failed (http 500)" },
    ]);
    expect(result.record.rawReply).toBeNull();
  });

  it("a provider quota error (429) says the limit is used up, not 'try again in a minute'", async () => {
    const result = await run(async () => {
      throw new Error('Gemini request failed (429): {"message":"You exceeded your current quota"}');
    });
    expect(result).toMatchObject({ status: "rejected", reply: null, message: QUOTA_MESSAGE });
    expect(QUOTA_MESSAGE).not.toMatch(/minute/);
    expect(result.record.issues[0].detail).toBe("the model call failed (http 429)");
    expect(JSON.stringify(result)).not.toContain("exceeded your current quota");
  });

  it("records a coarse failure category: timeout, HTTP status, or generic — and nothing else", async () => {
    const detail = async (error: Error) =>
      (await run(async () => {
        throw error;
      })).record.issues[0].detail;

    const timeout = new Error("The operation was aborted due to timeout");
    timeout.name = "TimeoutError";
    expect(await detail(timeout)).toBe("the model call timed out");
    expect(await detail(new Error("Gemini request failed (503): {\"message\":\"high demand\"}"))).toBe(
      "the model call failed (http 503)"
    );
    expect(await detail(new Error("something else entirely, key=AIza-secret"))).toBe("the model call failed");
    expect(describeGenerationFailure("not an error")).toBe("the model call failed");
  });

  it("unparseable output is rejected and the raw text is kept for diagnosis", async () => {
    const result = await run(async () => "Your bench is improving nicely!");
    expect(result).toMatchObject({ status: "rejected", reply: null, message: REJECTED_MESSAGE });
    expect(result.record.rawReply).toBe("Your bench is improving nicely!");
    expect(result.record.issues[0].code).toBe("unparseable");
  });

  it("a reply that breaks the contract (extra key) is rejected", async () => {
    const withExtra = JSON.stringify({ ...JSON.parse(goodReply), recommendations: ["add weight"] });
    const result = await run(async () => withExtra);
    expect(result.status).toBe("rejected");
    expect(result.reply).toBeNull();
  });

  it("drops the bad statements of a partly good reply, and records the issues", async () => {
    const mixed = JSON.stringify({
      statements: [
        { kind: "fact", text: "Your bench is improving.", cites: [BENCH_ID] },
        { kind: "fact", text: "Set 1 was 80 kg for 8 reps on Sep 18.", cites: [BENCH_ID] },
        { kind: "fact", text: "Set 1 was 90 kg on Sep 18.", cites: [BENCH_ID] },
      ],
    });
    const result = await run(async () => mixed);
    expect(result.status).toBe("accepted");
    expect(result.reply?.statements.map((s) => s.text)).toEqual(["Set 1 was 80 kg for 8 reps on Sep 18."]);
    expect(result.record.issues.map((i) => [i.code, i.statementIndex])).toEqual([
      ["evaluative", 0],
      ["ungrounded_number", 2],
    ]);
    expect(result.record.reply).toEqual(result.reply);
  });

  it("a reply that fails every check is rejected, with the issues and raw reply recorded", async () => {
    const bad = JSON.stringify({
      statements: [{ kind: "fact", text: "You should add 5 kg.", cites: [BENCH_ID] }],
    });
    const result = await run(async () => bad);
    expect(result).toMatchObject({ status: "rejected", reply: null, message: REJECTED_MESSAGE });
    expect(result.record.issues.length).toBeGreaterThan(0);
    expect(result.record.rawReply).toBe(bad);
  });

  it("medical content rejects the whole reply, even alongside valid statements", async () => {
    const medical = JSON.stringify({
      statements: [
        { kind: "fact", text: "Set 1 was 80 kg for 8 reps on Sep 18.", cites: [BENCH_ID] },
        { kind: "interpretation", text: "The drop may point to an injury.", cites: [BENCH_ID] },
      ],
    });
    const result = await run(async () => medical);
    expect(result.status).toBe("rejected");
    expect(result.record.issues.map((i) => i.code)).toContain("medical");
  });

  it("the message shown for a rejection never exposes validation detail", async () => {
    const result = await run(async () => "not json");
    expect(result.message).toBe(REJECTED_MESSAGE);
    expect(result.message).not.toMatch(/schema|json|number|citation/i);
  });

  it("trims the question in the stored record and prompt", async () => {
    const generate = vi.fn().mockResolvedValue(goodReply);
    const result = await run(generate, "   What changed?   ");
    expect(result.record.question).toBe("What changed?");
    expect(generate.mock.calls[0][0].endsWith('"What changed?"')).toBe(true);
  });
});
