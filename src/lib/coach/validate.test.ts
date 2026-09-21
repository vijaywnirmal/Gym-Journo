import { describe, expect, it } from "vitest";
import type { CoachReply, CoachStatement } from "./contract";
import { evidenceSections, validateCoachReply } from "./validate";
import { BENCH_ID, coachEvidence } from "./testFixtures";

const evidence = coachEvidence();

const fact = (text: string, ...cites: string[]): CoachStatement => ({ kind: "fact", text, cites: cites.length ? cites : [BENCH_ID] });
const reply = (statements: CoachStatement[], questions: string[] = []): CoachReply => ({ statements, questions });
const validate = (r: CoachReply) => validateCoachReply(r, evidence);
const codes = (r: CoachReply) => validate(r).issues.map((i) => i.code);

describe("evidenceSections", () => {
  it("exposes every citable section by id", () => {
    expect([...evidenceSections(evidence).keys()].sort()).toEqual(
      ["body.weight", BENCH_ID, "goal", "training.recent", "training.weekly"].sort()
    );
  });
});

describe("validateCoachReply — accepted statements", () => {
  it("accepts grounded facts and interpretations", () => {
    const result = validate(
      reply([
        fact("Bench Press was last performed on Sep 18, 7 days after Sep 11.", BENCH_ID),
        fact("Set 1 was 80 kg for 8 reps on Sep 18 and 80 kg for 6 reps on Sep 11.", BENCH_ID),
        { kind: "interpretation", text: "Set 1 reps differ by 2 between Sep 11 and Sep 18.", cites: [BENCH_ID] },
      ])
    );
    expect(result.status).toBe("accepted");
    expect(result.issues).toEqual([]);
    expect(result.reply?.statements).toHaveLength(3);
  });

  it("numbers may come from dates in the cited section (year, month, day)", () => {
    expect(codes(reply([fact("Body weight was recorded on 2026-09-18.", "body.weight")]))).toEqual([]);
    expect(codes(reply([fact("The latest weight was recorded on Sep 18, 2026.", "body.weight")]))).toEqual([]);
  });

  it("the sign of a number is ignored: a −1 in the evidence grounds '1'", () => {
    // weekly: the week of Sep 13–19 has 1 performed day against a target of 4 (difference −3)
    expect(codes(reply([fact("The week of Sep 13 to 19 had a difference of 3 days from the target of 4.", "training.weekly")]))).toEqual([]);
  });

  it("'in progress' is a status, not a verdict", () => {
    expect(codes(reply([fact("The current week is in progress.", "training.weekly")]))).toEqual([]);
  });

  it("a statement may cite several sections and use numbers from any of them", () => {
    expect(
      codes(reply([fact("The target is 4 days per week and the latest weight is 72 kg.", "training.weekly", "body.weight")]))
    ).toEqual([]);
  });
});

describe("validateCoachReply — citations and numbers", () => {
  it("drops a statement that cites an unknown section", () => {
    const result = validate(reply([fact("Bench Press was performed.", "exercise.ex-nope"), fact("Set 1 was 8 reps on Sep 18.", BENCH_ID)]));
    expect(result.issues[0]).toMatchObject({ code: "unknown_citation", statementIndex: 0 });
    expect(result.reply?.statements).toHaveLength(1);
  });

  it("drops a statement with a number that is not in the cited evidence", () => {
    const result = validate(reply([fact("Set 1 was 85 kg for 8 reps on Sep 18.", BENCH_ID), fact("Set 1 was 80 kg for 8 reps.", BENCH_ID)]));
    expect(result.issues).toEqual([expect.objectContaining({ code: "ungrounded_number", statementIndex: 0 })]);
    expect(result.reply?.statements.map((s) => s.text)).toEqual(["Set 1 was 80 kg for 8 reps."]);
  });

  it("a number that exists only in a section that was NOT cited is ungrounded", () => {
    // 72 is the latest body weight, but this statement cites only the exercise.
    expect(codes(reply([fact("The latest weight was 72 kg.", BENCH_ID)]))).toContain("ungrounded_number");
  });

  it("computed numbers the evidence doesn't contain are rejected", () => {
    // 80 + 80 = 160 is not in the evidence.
    expect(codes(reply([fact("The two sets total 160 kg.", BENCH_ID)]))).toContain("ungrounded_number");
  });
});

describe("validateCoachReply — spelled-out numbers", () => {
  it.each(["Set 1 was eight reps at 80 kg.", "The two sessions were seven days apart.", "Bench Press was performed two times."])(
    "drops a number written as a word next to a unit: %s",
    (text) => {
      expect(codes(reply([fact(text, BENCH_ID)]))).toContain("ungrounded_number");
    }
  );

  it("does not flag ordinary words that merely contain number words", () => {
    expect(codes(reply([fact("Bench Press was performed on Sep 18.", BENCH_ID)]))).toEqual([]);
  });
});

describe("validateCoachReply — language", () => {
  it.each([
    "Your bench press is improving.",
    "Reps show good progress on set 1.",
    "You are on track with 4 days per week.",
    "Training was consistent in the last 7 days.",
    "The weight hit a plateau at 80 kg.",
    "You are behind your target of 4 days.",
  ])("drops evaluative wording: %s", (text) => {
    expect(codes(reply([fact(text, BENCH_ID, "training.weekly", "training.recent")]))).toContain("evaluative");
  });

  it.each([
    "That was a strong session.",
    "Set 1 was solid at 80 kg.",
    "8 reps is better than 6 reps.",
    "The second session was worse.",
  ])("drops other verdict words: %s", (text) => {
    expect(codes(reply([fact(text, BENCH_ID)]))).toContain("evaluative");
  });

  it("applies to interpretations too — C1 makes no judgments", () => {
    const r = reply([{ kind: "interpretation", text: "This looks like strong progress.", cites: [BENCH_ID] }]);
    expect(codes(r)).toContain("evaluative");
  });

  it.each([
    "You should increase the weight to 85 kg.",
    "I recommend adding a set.",
    "Consider a deload week.",
    "Increase the weight next session.",
    "Try to reach 10 reps.",
    "You need to train more.",
    "The next step is 82.5 kg.",
  ])("drops advice and instructions: %s", (text) => {
    expect(codes(reply([fact(text, BENCH_ID)]))).toContain("advice");
  });

  it("rejects the WHOLE reply if any statement mentions medical or injury content", () => {
    const result = validate(
      reply([fact("Set 1 was 80 kg for 8 reps on Sep 18.", BENCH_ID), fact("Reps fell, which may mean an injury.", BENCH_ID)])
    );
    expect(result.status).toBe("rejected");
    expect(result.reply).toBeNull();
    expect(result.issues.map((i) => i.code)).toContain("medical");
  });

  it("rejects the whole reply if a clarifying question mentions pain", () => {
    const result = validate(reply([fact("Set 1 was 80 kg for 8 reps.", BENCH_ID)], ["Does your shoulder hurt during Bench Press?"]));
    expect(result.status).toBe("rejected");
  });

  it("keeps ordinary clarifying questions", () => {
    const result = validate(reply([fact("Set 1 was 80 kg for 8 reps.", BENCH_ID)], ["Was Sep 11 a lighter session?"]));
    expect(result.reply?.questions).toEqual(["Was Sep 11 a lighter session?"]);
  });

  it("drops a question phrased as an instruction", () => {
    const result = validate(reply([fact("Set 1 was 80 kg for 8 reps.", BENCH_ID)], ["You should add weight."]));
    expect(result.reply?.questions).toEqual([]);
    expect(result.issues.map((i) => i.code)).toContain("advice");
  });
});

describe("validateCoachReply — overall outcome", () => {
  it("is rejected when no statement survives", () => {
    const result = validate(reply([fact("Your bench is improving.", BENCH_ID), fact("Add weight.", BENCH_ID)]));
    expect(result.status).toBe("rejected");
    expect(result.reply).toBeNull();
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("is accepted when at least one statement survives, and reports what was dropped", () => {
    const result = validate(reply([fact("Your bench is improving.", BENCH_ID), fact("Set 1 was 80 kg for 8 reps.", BENCH_ID)]));
    expect(result.status).toBe("accepted");
    expect(result.reply?.statements).toHaveLength(1);
    expect(result.issues).toEqual([expect.objectContaining({ code: "evaluative", statementIndex: 0 })]);
  });

  it("does not mutate the reply it was given", () => {
    const r = reply([fact("Your bench is improving.", BENCH_ID), fact("Set 1 was 80 kg for 8 reps.", BENCH_ID)]);
    const before = JSON.stringify(r);
    validate(r);
    expect(JSON.stringify(r)).toBe(before);
  });
});
