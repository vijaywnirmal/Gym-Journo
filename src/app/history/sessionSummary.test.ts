import { describe, expect, it } from "vitest";
import { formatSessionSummary, summarizeVisibleSessions } from "./sessionSummary";

describe("summarizeVisibleSessions (Phase 16)", () => {
  it("1. zero sessions: returns null (no orientation output)", () => {
    expect(summarizeVisibleSessions([])).toBeNull();
  });

  it("2. one session: earliest and latest are the same date", () => {
    expect(summarizeVisibleSessions(["2026-09-17"])).toEqual({
      count: 1,
      earliestDate: "2026-09-17",
      latestDate: "2026-09-17",
    });
  });

  it("3. multiple sessions: correct count and earliest/latest dates", () => {
    expect(summarizeVisibleSessions(["2026-09-17", "2026-09-10", "2026-08-12"])).toEqual({
      count: 3,
      earliestDate: "2026-08-12",
      latestDate: "2026-09-17",
    });
  });

  it("4. dates supplied newest-first: still correctly ordered (min/max, not array position)", () => {
    // getLogHistory always returns logs newest-first — this must not matter to the summary.
    const newestFirst = summarizeVisibleSessions(["2026-09-17", "2026-09-10", "2026-08-12"]);
    const oldestFirst = summarizeVisibleSessions(["2026-08-12", "2026-09-10", "2026-09-17"]);
    const shuffled = summarizeVisibleSessions(["2026-09-10", "2026-08-12", "2026-09-17"]);
    expect(newestFirst).toEqual(oldestFirst);
    expect(newestFirst).toEqual(shuffled);
  });

  it("7. describes only the supplied sessions, not a lifetime total — a smaller supplied list yields a smaller count", () => {
    const fullList = summarizeVisibleSessions(["2026-09-17", "2026-09-10", "2026-08-12", "2026-07-01"]);
    const onePageOfIt = summarizeVisibleSessions(["2026-09-17", "2026-09-10"]);
    expect(fullList?.count).toBe(4);
    expect(onePageOfIt?.count).toBe(2);
    expect(onePageOfIt?.earliestDate).toBe("2026-09-10");
    expect(onePageOfIt?.latestDate).toBe("2026-09-17");
  });

  it("8. does not produce malformed output for duplicate/unusual date input", () => {
    expect(summarizeVisibleSessions(["2026-09-17", "2026-09-17"])).toEqual({
      count: 2,
      earliestDate: "2026-09-17",
      latestDate: "2026-09-17",
    });
  });
});

describe("formatSessionSummary (Phase 16)", () => {
  it("returns null when there's nothing to summarize", () => {
    expect(formatSessionSummary(null)).toBeNull();
  });

  it("2. singular wording + same date for a single session", () => {
    const summary = summarizeVisibleSessions(["2026-09-17"]);
    expect(formatSessionSummary(summary)).toBe("1 session shown · Thu, Sep 17");
  });

  it("3. plural wording + date range for multiple sessions", () => {
    const summary = summarizeVisibleSessions(["2026-09-17", "2026-08-12"]);
    expect(formatSessionSummary(summary)).toBe("2 sessions shown · Wed, Aug 12 – Thu, Sep 17");
  });

  it("never contains evaluative, trend, score, or comparison language", () => {
    const summary = summarizeVisibleSessions(["2026-09-17", "2026-09-10", "2026-08-12"]);
    const text = (formatSessionSummary(summary) ?? "").toLowerCase();
    for (const forbidden of [
      "progress",
      "improv",
      "regress",
      "stronger",
      "weaker",
      "trend",
      "consisten",
      "adherence",
      "score",
      "pr",
      "volume",
      "1rm",
      "%",
      "vs",
      "recommend",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });
});
