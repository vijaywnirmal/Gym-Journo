import { describe, expect, it } from "vitest";
import { buildTrainingEvidence } from "@/lib/analyze/evidence";
import { citationLabels, evidenceIsEmpty, replySources } from "./presentation";
import { hasCoachConsent, COACH_CONSENT } from "./consent";
import { BENCH_ID, coachEvidence } from "./testFixtures";

const evidence = coachEvidence();

describe("citationLabels / replySources", () => {
  it("labels every citable section for the person", () => {
    const labels = citationLabels(evidence);
    expect(labels.get("goal")).toBe("Goal settings");
    expect(labels.get("training.recent")).toBe("Recent training");
    expect(labels.get("training.weekly")).toBe("Weekly training");
    expect(labels.get("body.weight")).toBe("Body weight");
    expect(labels.get(BENCH_ID)).toBe("Bench Press");
  });

  it("lists the distinct cited sections in order of first use", () => {
    const sources = replySources(
      {
        statements: [
          { kind: "fact", text: "a", cites: ["body.weight", BENCH_ID] },
          { kind: "fact", text: "b", cites: [BENCH_ID, "goal"] },
        ],
        questions: [],
      },
      evidence
    );
    expect(sources.map((s) => s.label)).toEqual(["Body weight", "Bench Press", "Goal settings"]);
  });

  it("never shows a section that doesn't exist", () => {
    const sources = replySources(
      { statements: [{ kind: "fact", text: "a", cites: ["exercise.ex-nope", "goal"] }], questions: [] },
      evidence
    );
    expect(sources).toEqual([{ id: "goal", label: "Goal settings" }]);
  });
});

describe("evidenceIsEmpty", () => {
  const empty = () =>
    buildTrainingEvidence({
      todayStr: "2026-09-21",
      profile: null,
      performedDates: [],
      lastPerformedWorkoutDate: null,
      bodyMeasurements: [],
      exercises: [],
      exercisesTruncated: false,
    });

  it("is true with no workouts, exercises or weights", () => {
    expect(evidenceIsEmpty(empty())).toBe(true);
  });

  it("is false with any workout day, exercise, or weight", () => {
    expect(evidenceIsEmpty(evidence)).toBe(false);
    const onlyWeight = buildTrainingEvidence({
      todayStr: "2026-09-21",
      profile: null,
      performedDates: [],
      lastPerformedWorkoutDate: null,
      bodyMeasurements: [{ date: "2026-09-18", weight_kg: 72 }],
      exercises: [],
      exercisesTruncated: false,
    });
    expect(evidenceIsEmpty(onlyWeight)).toBe(false);
    const onlyOldWorkout = buildTrainingEvidence({
      todayStr: "2026-09-21",
      profile: null,
      performedDates: [],
      lastPerformedWorkoutDate: "2025-01-01",
      bodyMeasurements: [],
      exercises: [],
      exercisesTruncated: false,
    });
    expect(evidenceIsEmpty(onlyOldWorkout)).toBe(false);
  });
});

describe("hasCoachConsent", () => {
  it("is true only when a consent timestamp exists", () => {
    expect(hasCoachConsent({ coach_consent_at: "2026-09-01T10:00:00Z" })).toBe(true);
    expect(hasCoachConsent({ coach_consent_at: null })).toBe(false);
    expect(hasCoachConsent({})).toBe(false);
    expect(hasCoachConsent(null)).toBe(false);
  });
});

describe("COACH_CONSENT wording matches what is really sent", () => {
  const sent = JSON.stringify(evidence);

  it("the evidence carries none of the fields the wording says are not sent", () => {
    for (const field of ["full_name", "fullName", "first_name", "last_name", "email", "date_of_birth", "height", "gender", "notes", "meals"]) {
      expect(sent.toLowerCase()).not.toContain(field.toLowerCase());
    }
    expect(COACH_CONSENT.notShared.join(" ")).toMatch(/name.*email.*date of birth.*height.*gender/i);
  });

  it("the evidence does carry the kinds of data the wording says are sent", () => {
    expect(sent).toContain("trainingDaysPerWeek");
    expect(sent).toContain("targetWeightKg");
    expect(sent).toContain("Bench Press");
    expect(sent).toContain("body.weight");
    expect(COACH_CONSENT.shared.join(" ")).toMatch(/goal settings/i);
    expect(COACH_CONSENT.shared.join(" ")).toMatch(/exercise names/i);
    expect(COACH_CONSENT.shared.join(" ")).toMatch(/body-weight/i);
  });

  it("names the recipient, retention, withdrawal and Coach's limits", () => {
    expect(COACH_CONSENT.summary).toMatch(/Gemini/);
    expect(COACH_CONSENT.kept).toMatch(/deleted if you delete your account/);
    expect(COACH_CONSENT.withdraw).toMatch(/withdraw at any time/i);
    expect(COACH_CONSENT.limits).toMatch(/pain or injuries/);
  });

  it("says data on the paid tier isn't used to improve Google's products — true only because Coach runs on Gemini's paid tier", () => {
    expect(COACH_CONSENT.dataUse).toMatch(/not used.*to improve its products/i);
    expect(COACH_CONSENT.dataUse).toMatch(/Google/);
  });
});
