import { describe, expect, it } from "vitest";
import { formatSessionSummary, summarizePerformedSessions } from "./sessionSummary";
import { summarizeExerciseRecurrence } from "./exerciseRecurrence";
import { isPerformedExerciseSession } from "@/lib/analyze/definitions";

const TODAY = "2026-09-21";
const BENCH = "ex-bench";
const performed = [{ reps: 5, weight: 80 }];
const blank = [{ reps: null, weight: null }];

function log(date: string, ...occurrences: { logged_sets: { reps: number | null; weight: number | null }[] }[]) {
  return { date, logged_exercises: occurrences.map((o) => ({ exercise_id: BENCH, ...o })) };
}

describe("summarizePerformedSessions (Phase 16, canonical performed semantics)", () => {
  it("1. a blank-only session is excluded from the visible count", () => {
    const summary = summarizePerformedSessions(
      [log("2026-09-17", { logged_sets: performed }), log("2026-09-14", { logged_sets: blank })],
      BENCH,
      TODAY
    );
    expect(summary?.count).toBe(1);
  });

  it("2. a future-dated session is excluded", () => {
    const summary = summarizePerformedSessions(
      [log("2026-09-25", { logged_sets: performed }), log("2026-09-17", { logged_sets: performed })],
      BENCH,
      TODAY
    );
    expect(summary).toEqual({ count: 1, earliestDate: "2026-09-17", latestDate: "2026-09-17" });
  });

  it("3. duplicate exercise occurrences on one date count once", () => {
    const summary = summarizePerformedSessions(
      [log("2026-09-17", { logged_sets: performed }, { logged_sets: performed })],
      BENCH,
      TODAY
    );
    expect(summary?.count).toBe(1);
  });

  it("3. the same date supplied twice still counts once", () => {
    const summary = summarizePerformedSessions(
      [log("2026-09-17", { logged_sets: performed }), log("2026-09-17", { logged_sets: performed })],
      BENCH,
      TODAY
    );
    expect(summary?.count).toBe(1);
  });

  it("4. the visible date range comes from performed sessions only, not blank or future ones", () => {
    const summary = summarizePerformedSessions(
      [
        log("2026-09-30", { logged_sets: performed }), // future
        log("2026-09-19", { logged_sets: performed }),
        log("2026-09-15", { logged_sets: blank }), // blank
        log("2026-09-10", { logged_sets: performed }),
        log("2026-09-02", { logged_sets: blank }), // blank
      ],
      BENCH,
      TODAY
    );
    expect(summary).toEqual({ count: 2, earliestDate: "2026-09-10", latestDate: "2026-09-19" });
    expect(formatSessionSummary(summary)).toBe("2 sessions shown · Thu, Sep 10 – Sat, Sep 19");
  });

  it("returns null (no line) when the page has no performed session", () => {
    expect(summarizePerformedSessions([log("2026-09-14", { logged_sets: blank })], BENCH, TODAY)).toBeNull();
    expect(summarizePerformedSessions([], BENCH, TODAY)).toBeNull();
  });

  it("5. page-local and full-history counts use the same performed semantics", () => {
    const allLogs = [
      log("2026-09-30", { logged_sets: performed }), // future
      log("2026-09-19", { logged_sets: performed }),
      log("2026-09-15", { logged_sets: blank }), // blank
      log("2026-09-12", { logged_sets: performed }, { logged_sets: performed }), // duplicate rows
      log("2026-09-01", { logged_sets: performed }),
    ];
    // "Full history" (Phase 17) over every log vs "shown" (Phase 16) over the same logs.
    const shown = summarizePerformedSessions(allLogs, BENCH, TODAY);
    const performedDates = allLogs
      .filter((l) => isPerformedExerciseSession(l, BENCH, TODAY))
      .map((l) => l.date);
    const full = summarizeExerciseRecurrence(performedDates);
    expect(shown?.count).toBe(3);
    expect(full?.count).toBe(shown?.count);
    expect(full?.lastDate).toBe(shown?.latestDate);
  });

  it("6. 'shown' (page) and 'performed' (full history) remain distinct when the page is a subset", () => {
    const fullLogs = [
      log("2026-09-19", { logged_sets: performed }),
      log("2026-09-12", { logged_sets: performed }),
      log("2026-09-01", { logged_sets: performed }),
    ];
    const page = fullLogs.slice(0, 2);
    expect(summarizePerformedSessions(page, BENCH, TODAY)?.count).toBe(2);
    expect(
      summarizeExerciseRecurrence(
        fullLogs.filter((l) => isPerformedExerciseSession(l, BENCH, TODAY)).map((l) => l.date)
      )?.count
    ).toBe(3);
  });
});
