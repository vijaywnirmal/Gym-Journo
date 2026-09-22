import { describe, expect, it } from "vitest";
import type { CoachReply, CoachStatement } from "./contract";
import { validateCoachReply } from "./validate";
import { buildCoachPrompt } from "./prompt";
import { BENCH_ID, coachEvidence } from "./testFixtures";

// Fixture: target 4 days a week; the completed week Sep 13–19 has 2 performed days (Sep 15, 18), so
// the difference is 2 fewer. Body weight 70 kg (Jul 2) → 72 kg (Sep 18), target 75 kg.
const evidence = coachEvidence();

const fact = (text: string, ...cites: string[]): CoachStatement => ({
  kind: "fact",
  text,
  cites: cites.length ? cites : ["training.weekly"],
});
const reply = (...statements: CoachStatement[]): CoachReply => ({ statements, questions: [] });
const codes = (text: string, ...cites: string[]) =>
  validateCoachReply(reply(fact(text, ...cites)), evidence).issues.map((i) => i.code);

describe("a negative number is not a way to state a fact", () => {
  it.each([
    "You recorded 2 workout days, which is -2 days relative to your target of 4.",
    "The difference from the target of 4 was −2 days.",
    "The difference from the target of 4 was –2 days.",
    "The difference was (-2) against the target of 4.",
    "-2 days against a target of 4.",
  ])("drops: %s", (text) => {
    expect(codes(text)).toContain("signed_number");
  });

  it("the number is still grounded by magnitude, so the phrase is what gets rejected", () => {
    expect(codes("The difference was -2 days against a target of 4.")).toEqual(["signed_number"]);
  });

  it("does not touch ISO dates, ranges, written date spans or hyphenated words", () => {
    for (const text of [
      "The week is 2026-09-13 to 2026-09-19 against a target of 4.",
      "The week of Sep 13, 2026 – Sep 19, 2026 had 2 workout days against a target of 4.",
      "Target of 4 days, 2-4 days in recent weeks.",
      "A week-long window with 2 workout days against a target of 4.",
    ]) {
      expect(codes(text)).not.toContain("signed_number");
    }
  });
});

describe("the wording the evidence supplies passes as written", () => {
  it("a week's difference, quoted from differenceFromTargetWords", () => {
    const text = "In the week of Sep 13, 2026 to Sep 19, 2026 there were 2 workout days, which is 2 fewer workout days than the target.";
    expect(validateCoachReply(reply(fact(text)), evidence)).toMatchObject({ status: "accepted", issues: [] });
  });

  it("body weight's change and distance to the target, quoted from the evidence", () => {
    expect(
      validateCoachReply(
        reply(fact("The latest weight of 72 kg is 3 kg below the target weight.", "body.weight")),
        evidence
      )
    ).toMatchObject({ status: "accepted", issues: [] });
    expect(
      validateCoachReply(
        reply(fact("The latest weight is 2 kg higher than the earliest recorded weight.", "body.weight")),
        evidence
      )
    ).toMatchObject({ status: "accepted", issues: [] });
  });

  it("the fixture's own wording really is what the tests quote", () => {
    const weekly = evidence.training.weekly.completedWeeks[0];
    expect(weekly.differenceFromTargetWords).toBe("2 fewer workout days than the target");
    expect(evidence.bodyWeight?.distanceToTargetWords).toBe("3 kg below the target weight");
    expect(evidence.bodyWeight?.changeWords).toBe("2 kg higher than the earliest recorded weight");
  });
});

describe("the prompt", () => {
  const prompt = buildCoachPrompt(evidence, "How am I doing against my target?");

  it("forbids minus signs and points to the supplied wording", () => {
    expect(prompt).toMatch(/Never write a minus sign or a negative number/);
    expect(prompt).toMatch(/a field whose name ends in "Words"/);
  });

  it("gives the model the wording inside the evidence it receives", () => {
    expect(prompt).toContain('"differenceFromTargetWords":"2 fewer workout days than the target"');
    expect(prompt).toContain('"distanceToTargetWords":"3 kg below the target weight"');
  });

  it("still cites the bench exercise id somewhere in the evidence (sanity)", () => {
    expect(prompt).toContain(BENCH_ID);
  });
});
