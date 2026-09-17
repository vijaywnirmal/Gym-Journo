import { describe, expect, it } from "vitest";
import { formatExerciseRecurrence, summarizeExerciseRecurrence } from "./exerciseRecurrence";
import { formatSessionSummary, summarizeVisibleSessions } from "./sessionSummary";

describe("summarizeExerciseRecurrence (Phase 17)", () => {
  it("1. zero sessions: returns null (no recurrence line)", () => {
    expect(summarizeExerciseRecurrence([])).toBeNull();
  });

  it("2. one session: count 1 and that date as last", () => {
    expect(summarizeExerciseRecurrence(["2026-09-17"])).toEqual({
      count: 1,
      lastDate: "2026-09-17",
    });
  });

  it("3. multiple sessions: count is the number of distinct dates", () => {
    expect(summarizeExerciseRecurrence(["2026-09-17", "2026-09-10", "2026-08-12"])).toEqual({
      count: 3,
      lastDate: "2026-09-17",
    });
  });

  it("4. duplicate dates (same exercise twice on one log) count as ONE session", () => {
    expect(summarizeExerciseRecurrence(["2026-09-17", "2026-09-17", "2026-09-10"])).toEqual({
      count: 2,
      lastDate: "2026-09-17",
    });
  });

  it("5. latest date is the maximum, independent of input order", () => {
    expect(summarizeExerciseRecurrence(["2026-08-12", "2026-09-17", "2026-09-10"])?.lastDate).toBe(
      "2026-09-17"
    );
    expect(summarizeExerciseRecurrence(["2026-09-10", "2026-08-12"])?.lastDate).toBe("2026-09-10");
  });

  it("6. pagination does not affect the full recurrence count — the function describes every supplied date, not a page slice", () => {
    const allSessions = ["2026-09-17", "2026-09-10", "2026-08-12", "2026-07-01"];
    const onePage = allSessions.slice(0, 2);
    expect(summarizeExerciseRecurrence(allSessions)?.count).toBe(4);
    expect(summarizeVisibleSessions(onePage)?.count).toBe(2);
    expect(summarizeExerciseRecurrence(allSessions)?.count).not.toBe(
      summarizeVisibleSessions(onePage)?.count
    );
  });

  it("7. recurrence and Phase 16 visible-page summaries remain semantically distinct", () => {
    const pageDates = ["2026-09-17", "2026-09-10"];
    const allDates = ["2026-09-17", "2026-09-10", "2026-08-12"];
    const shown = formatSessionSummary(summarizeVisibleSessions(pageDates));
    const logged = formatExerciseRecurrence(summarizeExerciseRecurrence(allDates));
    expect(shown).toBe("2 sessions shown · Thu, Sep 10 – Thu, Sep 17");
    expect(logged).toBe("3 sessions logged · last on Thu, Sep 17");
    expect(shown).not.toEqual(logged);
    expect(shown).toContain("shown");
    expect(shown).not.toContain("logged");
    expect(logged).toContain("logged");
    expect(logged).not.toContain("shown");
  });
});

describe("formatExerciseRecurrence (Phase 17)", () => {
  it("returns null when there is nothing to report", () => {
    expect(formatExerciseRecurrence(null)).toBeNull();
  });

  it("2. singular wording for one session", () => {
    expect(formatExerciseRecurrence({ count: 1, lastDate: "2026-09-17" })).toBe(
      "1 session logged · last on Thu, Sep 17"
    );
  });

  it("3. plural wording for multiple sessions", () => {
    expect(formatExerciseRecurrence({ count: 8, lastDate: "2026-09-17" })).toBe(
      "8 sessions logged · last on Thu, Sep 17"
    );
  });

  it("never contains evaluative, streak, score, or coaching language", () => {
    const text = (formatExerciseRecurrence({ count: 8, lastDate: "2026-09-17" }) ?? "").toLowerCase();
    for (const forbidden of [
      "trained frequently",
      "consistent",
      "progress",
      "falling behind",
      "overdue",
      "needs more work",
      "improv",
      "stronger",
      "pr",
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
