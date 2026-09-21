import { describe, expect, it } from "vitest";
import { formatExerciseRecurrence, summarizeExerciseRecurrence } from "./exerciseRecurrence";
import { formatSessionSummary, summarizeVisibleSessions } from "./sessionSummary";

describe("summarizeExerciseRecurrence", () => {
  it("1. zero sessions: returns null (no recurrence lines)", () => {
    expect(summarizeExerciseRecurrence([])).toBeNull();
  });

  it("2. one session: count 1 with that date as both first and last", () => {
    expect(summarizeExerciseRecurrence(["2026-09-17"])).toEqual({
      count: 1,
      firstDate: "2026-09-17",
      lastDate: "2026-09-17",
    });
  });

  it("3. multiple sessions: count is the number of distinct dates, with first and last", () => {
    expect(summarizeExerciseRecurrence(["2026-09-17", "2026-09-10", "2026-08-12"])).toEqual({
      count: 3,
      firstDate: "2026-08-12",
      lastDate: "2026-09-17",
    });
  });

  it("4. duplicate dates (same exercise twice on one log) count as ONE session", () => {
    expect(summarizeExerciseRecurrence(["2026-09-17", "2026-09-17", "2026-09-10"])).toEqual({
      count: 2,
      firstDate: "2026-09-10",
      lastDate: "2026-09-17",
    });
  });

  it("5. first and last are the minimum and maximum, independent of input order", () => {
    const shuffled = summarizeExerciseRecurrence(["2026-08-12", "2026-09-17", "2026-09-10"]);
    expect(shuffled?.firstDate).toBe("2026-08-12");
    expect(shuffled?.lastDate).toBe("2026-09-17");
    const newestFirst = summarizeExerciseRecurrence(["2026-09-17", "2026-09-10", "2026-08-12"]);
    expect(newestFirst).toEqual(shuffled);
  });

  it("6. pagination does not affect the full recurrence facts — the function describes every supplied date, not a page slice", () => {
    const allSessions = ["2026-09-17", "2026-09-10", "2026-08-12", "2026-07-01"];
    const onePage = allSessions.slice(0, 2);
    expect(summarizeExerciseRecurrence(allSessions)?.count).toBe(4);
    expect(summarizeExerciseRecurrence(allSessions)?.firstDate).toBe("2026-07-01");
    expect(summarizeVisibleSessions(onePage)?.count).toBe(2);
    expect(summarizeVisibleSessions(onePage)?.earliestDate).toBe("2026-09-10");
  });

  it("7. recurrence and the page-local 'shown' summary remain semantically distinct", () => {
    const pageDates = ["2026-09-17", "2026-09-10"];
    const allDates = ["2026-09-17", "2026-09-10", "2026-08-12"];
    const shown = formatSessionSummary(summarizeVisibleSessions(pageDates));
    const lines = formatExerciseRecurrence(summarizeExerciseRecurrence(allDates));
    expect(shown).toBe("2 sessions shown · Thu, Sep 10 – Thu, Sep 17");
    expect(lines?.countLine).toBe("3 sessions performed");
    expect(shown).toContain("shown");
    expect(lines?.countLine).not.toContain("shown");
  });
});

describe("formatExerciseRecurrence", () => {
  it("returns null when there is nothing to report", () => {
    expect(formatExerciseRecurrence(null)).toBeNull();
  });

  it("singular wording for one session", () => {
    expect(
      formatExerciseRecurrence({ count: 1, firstDate: "2026-09-17", lastDate: "2026-09-17" })
    ).toEqual({
      countLine: "1 session performed",
      firstLine: "First performed: Sep 17, 2026",
      lastLine: "Last performed: Sep 17, 2026",
    });
  });

  it("plural wording, with the year on first and last so multi-year history is unambiguous", () => {
    expect(
      formatExerciseRecurrence({ count: 12, firstDate: "2025-06-12", lastDate: "2026-09-18" })
    ).toEqual({
      countLine: "12 sessions performed",
      firstLine: "First performed: Jun 12, 2025",
      lastLine: "Last performed: Sep 18, 2026",
    });
  });

  it("never contains evaluative, streak, score, or coaching language", () => {
    const lines = formatExerciseRecurrence({ count: 8, firstDate: "2026-06-12", lastDate: "2026-09-17" });
    const text = Object.values(lines ?? {}).join(" ").toLowerCase();
    for (const forbidden of [
      "trained frequently",
      "consistent",
      "progress",
      "falling behind",
      "overdue",
      "needs more work",
      "improv",
      "stronger",
      "streak",
      "volume",
      "1rm",
      "adherence",
      "score",
      "recommend",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });
});
