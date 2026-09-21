import { describe, expect, it } from "vitest";
import { buildTrainingEvidence } from "@/lib/analyze/evidence";
import type { CoachReply, CoachStatement } from "./contract";
import { evidenceSections, validateCoachReply } from "./validate";
import { citationLabels, replySources } from "./presentation";
import { BENCH_ID, coachEvidence } from "./testFixtures";

// Fixture evidence: Bench sessions on Sep 18 and Sep 11 (2026); body weight on Jul 2 and Sep 18;
// current week Sep 20–26.
const evidence = coachEvidence();
const noWeight = () =>
  buildTrainingEvidence({
    todayStr: "2026-09-21",
    profile: null,
    performedDates: ["2026-09-18"],
    lastPerformedWorkoutDate: "2026-09-18",
    bodyMeasurements: [],
    exercises: [],
    exercisesTruncated: false,
  });

const fact = (text: string, ...cites: string[]): CoachStatement => ({
  kind: "fact",
  text,
  cites: cites.length ? cites : [BENCH_ID],
});
const reply = (...statements: CoachStatement[]): CoachReply => ({ statements, questions: [] });
const codes = (r: CoachReply, ev = evidence) => validateCoachReply(r, ev).issues.map((i) => i.code);

describe("raw values are said in words", () => {
  it.each([
    "The target weight is null.",
    "The target weight was undefined for this account.",
    "The difference was NaN days.",
    "Set 1 was 80 kg for 8 reps on Sep 18 with a null comparison.",
  ])("drops a statement containing a raw value: %s", (text) => {
    expect(codes(reply(fact(text, "goal", BENCH_ID)))).toContain("raw_value");
  });

  it("does not flag words that merely contain those letters", () => {
    expect(codes(reply(fact("The annulled session was on Sep 18.", BENCH_ID)))).not.toContain("raw_value");
  });
});

describe("written dates must be real dates in the cited evidence", () => {
  it.each([
    "Bench Press was performed on Sep 18.",
    "Bench Press was performed on Sep 18, 2026.",
    "Bench Press was performed on September 18.",
    "Bench Press was performed on Sep 18th, 2026.",
    "Bench Press was performed on Sep 18 and again on Sep 11.",
    "Bench Press was performed on 2026-09-18.",
  ])("accepts: %s", (text) => {
    expect(codes(reply(fact(text, BENCH_ID)))).toEqual([]);
  });

  it("rejects a date whose day isn't in the cited evidence", () => {
    expect(codes(reply(fact("Bench Press was performed on Sep 12.", BENCH_ID)))).toContain("ungrounded_date");
  });

  it("rejects a real day with the wrong month — the numbers alone would pass", () => {
    const r = reply(fact("Bench Press was performed on Oct 18.", BENCH_ID));
    expect(codes(r)).toEqual(["ungrounded_date"]);
  });

  it("rejects a month and day paired wrongly (Sep 18 and Sep 11 exist, Sep 6 does not)", () => {
    expect(codes(reply(fact("Bench Press was performed on Sep 6.", BENCH_ID)))).toContain("ungrounded_date");
  });

  it("rejects the wrong year when a year is written", () => {
    expect(codes(reply(fact("Bench Press was performed on Sep 18, 2025.", BENCH_ID)))).toContain("ungrounded_date");
  });

  it("a date that exists only in a section that was not cited is not grounded", () => {
    // Jul 2 is a body-weight date; this statement cites only Bench Press.
    expect(codes(reply(fact("Bench Press was performed on Jul 2.", BENCH_ID)))).toContain("ungrounded_date");
    expect(codes(reply(fact("Weight was recorded on Jul 2, 2026.", "body.weight")))).toEqual([]);
  });

  it("accepts the week range dates of the cited week", () => {
    expect(codes(reply(fact("The current week runs Sep 20 to Sep 26.", "training.weekly")))).toEqual([]);
  });

  it("checks every date in a statement, not just the first", () => {
    expect(codes(reply(fact("Bench Press was performed on Sep 18 and on Sep 9.", BENCH_ID)))).toContain("ungrounded_date");
  });
});

describe("absences can be cited and are checked", () => {
  it("the evidence offers absent:<section> for exactly the sections with no records", () => {
    const keys = [...evidenceSections(noWeight()).keys()];
    expect(keys).toContain("absent:body.weight");
    expect(keys).toContain("absent:exercises.recent");
    expect([...evidenceSections(evidence).keys()].some((k) => k.startsWith("absent:"))).toBe(false);
  });

  it("accepts 'no body weight is recorded' citing the absence", () => {
    const r = reply(fact("No body weight is recorded.", "absent:body.weight"));
    expect(validateCoachReply(r, noWeight()).status).toBe("accepted");
  });

  it("rejects an absence claim when the records DO exist — the citation isn't valid", () => {
    const r = reply(fact("No body weight is recorded.", "absent:body.weight"));
    const result = validateCoachReply(r, evidence);
    expect(result.status).toBe("rejected");
    expect(result.issues.map((i) => i.code)).toContain("unknown_citation");
  });

  it("an absence citation can't back up a number", () => {
    const r = reply(fact("There are 3 body-weight records.", "absent:body.weight"));
    expect(codes(r, noWeight())).toContain("ungrounded_number");
  });

  it("an absence can be mixed with a present section", () => {
    const r = reply(fact("The last performed workout day was Sep 18, and no body weight is recorded.", "training.recent", "absent:body.weight"));
    expect(validateCoachReply(r, noWeight()).status).toBe("accepted");
  });

  it("absences get plain labels for the person", () => {
    const labels = citationLabels(noWeight());
    expect(labels.get("absent:body.weight")).toBe("No body-weight records");
    expect(labels.get("absent:exercises.recent")).toBe("No recent exercises");
    expect(
      replySources(reply(fact("No body weight is recorded.", "absent:body.weight")), noWeight()).map((s) => s.label)
    ).toEqual(["No body-weight records"]);
  });
});
