import { describe, expect, it } from "vitest";
import { BLOCKED_MESSAGES, MAX_COACH_QUESTION_LENGTH, screenQuestion } from "./screen";

describe("screenQuestion", () => {
  it.each([
    "What changed in the last two weeks?",
    "What do my records show for Bench Press?",
    "How many days did I train last week?",
    "When did I last do squats?",
  ])("allows an explain-style question: %s", (q) => {
    expect(screenQuestion(q)).toEqual({ allowed: true, question: q });
  });

  it("trims the question", () => {
    expect(screenQuestion("  What changed?  ")).toEqual({ allowed: true, question: "What changed?" });
  });

  it("blocks an empty question", () => {
    expect(screenQuestion("   ")).toMatchObject({ allowed: false, reason: "empty" });
  });

  it("blocks an over-long question", () => {
    const result = screenQuestion("a".repeat(MAX_COACH_QUESTION_LENGTH + 1));
    expect(result).toMatchObject({ allowed: false, reason: "too_long", message: BLOCKED_MESSAGES.too_long });
  });

  it.each([
    "My shoulder hurts when I bench, what changed?",
    "I have pain in my knee",
    "Is this injury related to my squats?",
    "I think I strained my back",
    "My wrist is swollen after training",
  ])("blocks pain and injury topics with the fixed safe message: %s", (q) => {
    expect(screenQuestion(q)).toEqual({
      allowed: false,
      reason: "pain_or_injury",
      message: BLOCKED_MESSAGES.pain_or_injury,
    });
  });

  it.each([
    "Should I increase the weight?",
    "What should I do next week?",
    "How much should I lift on bench?",
    "Can you recommend a program?",
    "Write me a plan for next week",
    "What do you suggest for my squat?",
  ])("blocks recommendation requests in C1: %s", (q) => {
    expect(screenQuestion(q)).toMatchObject({ allowed: false, reason: "recommendation_request" });
  });

  it("safety wins when a question is both a recommendation request and about pain", () => {
    expect(screenQuestion("My knee hurts, should I keep squatting?")).toMatchObject({
      allowed: false,
      reason: "pain_or_injury",
    });
  });

  it("the blocked messages contain no evaluation and no medical advice beyond referral", () => {
    expect(BLOCKED_MESSAGES.pain_or_injury).toMatch(/doctor or physiotherapist/);
    for (const message of Object.values(BLOCKED_MESSAGES)) {
      expect(message.toLowerCase()).not.toMatch(/progress|improv|plateau/);
    }
  });
});
