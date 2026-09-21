import { describe, expect, it } from "vitest";
import {
  buildExerciseSessions,
  buildSessionViews,
  pageSessionViews,
  performedSetsOf,
  type SessionSourceLog,
} from "./exerciseSessions";

const TODAY = "2026-09-21";
const BENCH = "ex-bench";

type SetInput = [reps: number | null, weight: number | null, unit?: string];

function sets(...values: SetInput[]) {
  return values.map(([reps, weight, unit], i) => ({
    set_number: i + 1,
    reps,
    weight,
    weight_unit: unit ?? "kg",
  }));
}

function log(date: string, ...occurrences: ReturnType<typeof sets>[]): SessionSourceLog {
  return {
    date,
    logged_exercises: occurrences.map((logged_sets, position) => ({
      exercise_id: BENCH,
      position,
      logged_sets,
    })),
  };
}

const build = (logs: SessionSourceLog[]) => buildExerciseSessions(logs, BENCH, TODAY);

describe("buildExerciseSessions — canonical performed sessions", () => {
  it("1. builds performed sessions newest-first, one per date, with their sets", () => {
    const result = build([
      log("2026-09-04", sets([8, 80], [7, 80])),
      log("2026-09-18", sets([8, 82.5], [7, 82.5])),
      log("2026-09-11", sets([6, 80])),
    ]);
    expect(result.map((s) => s.date)).toEqual(["2026-09-18", "2026-09-11", "2026-09-04"]);
    expect(result[0].sets).toEqual([
      { setNumber: 1, reps: 8, weight: 82.5, weightUnit: "kg" },
      { setNumber: 2, reps: 7, weight: 82.5, weightUnit: "kg" },
    ]);
  });

  it("2. a session containing only blank set rows is excluded", () => {
    const result = build([log("2026-09-18", sets([null, null], [null, null])), log("2026-09-11", sets([6, 80]))]);
    expect(result.map((s) => s.date)).toEqual(["2026-09-11"]);
  });

  it("3. a session with performed and blank rows keeps only the performed sets, with their own set numbers", () => {
    const [session] = build([log("2026-09-18", sets([8, 80], [null, null], [6, 80]))]);
    expect(session.sets.map((s) => s.setNumber)).toEqual([1, 3]);
  });

  it("4./5. multiple and repeated sessions on different dates are all kept", () => {
    const result = build([
      log("2026-09-18", sets([5, 80])),
      log("2026-09-11", sets([5, 80])),
      log("2026-09-04", sets([5, 80])),
      log("2026-08-28", sets([5, 80])),
    ]);
    expect(result).toHaveLength(4);
  });

  it("6. a future-dated log is not a session (today itself is)", () => {
    const result = build([
      log("2026-09-22", sets([5, 100])),
      log(TODAY, sets([5, 85])),
      log("2026-09-18", sets([5, 80])),
    ]);
    expect(result.map((s) => s.date)).toEqual([TODAY, "2026-09-18"]);
  });

  it("7. partial sets (reps only / weight only) are performed and keep their missing value as null", () => {
    const [session] = build([log("2026-09-18", sets([12, null], [null, 20]))]);
    expect(session.sets).toEqual([
      { setNumber: 1, reps: 12, weight: null, weightUnit: "kg" },
      { setNumber: 2, reps: null, weight: 20, weightUnit: "kg" },
    ]);
  });

  it("8. zero reps or zero weight are performed sets", () => {
    const [session] = build([log("2026-09-18", sets([0, 60], [5, 0]))]);
    expect(session.sets).toHaveLength(2);
  });

  it("duplicate occurrences on one date make one session, sets read in position order", () => {
    const result = build([log("2026-09-18", sets([5, 80]), sets([6, 82.5]))]);
    expect(result).toHaveLength(1);
    expect(result[0].sets.map((s) => s.weight)).toEqual([80, 82.5]);
  });

  it("the same date supplied twice is one session", () => {
    expect(build([log("2026-09-18", sets([5, 80])), log("2026-09-18", sets([5, 80]))])).toHaveLength(1);
  });

  it("13. an exercise with no performed sessions yields an empty history", () => {
    expect(build([])).toEqual([]);
    expect(build([log("2026-09-18", sets([null, null]))])).toEqual([]);
  });

  it("ignores a same-day sibling exercise's sets", () => {
    const withSibling: SessionSourceLog = {
      date: "2026-09-18",
      logged_exercises: [
        { exercise_id: "ex-row", position: 1, logged_sets: sets([8, 60]) },
        { exercise_id: BENCH, position: 0, logged_sets: sets([null, null]) },
      ],
    };
    expect(build([withSibling])).toEqual([]);
    expect(performedSetsOf(withSibling, "ex-row")).toHaveLength(1);
  });
});

describe("buildSessionViews — comparison with the previous performed session", () => {
  it("9. a blank-only log between two performed sessions is skipped: the gap is between real sessions", () => {
    const views = buildSessionViews(
      build([
        log("2026-09-18", sets([8, 80])),
        log("2026-09-15", sets([null, null])), // blank — not a session
        log("2026-09-11", sets([6, 80])),
      ])
    );
    expect(views.map((v) => v.date)).toEqual(["2026-09-18", "2026-09-11"]);
    expect(views[0].previousDate).toBe("2026-09-11");
    expect(views[0].daysSincePrevious).toBe(7);
  });

  it("the oldest performed session has no previous session, gap or comparisons", () => {
    const views = buildSessionViews(build([log("2026-09-18", sets([8, 80])), log("2026-09-11", sets([6, 80]))]));
    const oldest = views[1];
    expect(oldest.previousDate).toBeNull();
    expect(oldest.daysSincePrevious).toBeNull();
    expect(oldest.sets.every((s) => s.comparison === null)).toBe(true);
  });

  it("10. compares each set with the same-numbered set in the previous performed session", () => {
    const [latest] = buildSessionViews(
      build([
        log("2026-09-18", sets([10, 80], [7, 80], [8, 75])),
        log("2026-09-11", sets([8, 80], [7, 80], [8, 80])),
      ])
    );
    expect(latest.sets[0].comparison).toEqual({
      weight: { type: "same" },
      reps: { type: "delta", delta: 2 },
    });
    expect(latest.sets[1].comparison).toEqual({ weight: { type: "same" }, reps: { type: "same" } });
    expect(latest.sets[2].comparison).toEqual({
      weight: { type: "delta", delta: -5, unit: "kg" },
      reps: { type: "same" },
    });
  });

  it("11. a set with no same-numbered previous set has no comparison; extra previous sets are not shown", () => {
    const [moreSets] = buildSessionViews(
      build([log("2026-09-18", sets([8, 80], [8, 80], [8, 80])), log("2026-09-11", sets([8, 80]))])
    );
    expect(moreSets.sets.map((s) => s.comparison === null)).toEqual([false, true, true]);

    const [fewerSets] = buildSessionViews(
      build([log("2026-09-18", sets([8, 80])), log("2026-09-11", sets([8, 80], [8, 80], [8, 80], [8, 80]))])
    );
    expect(fewerSets.sets).toHaveLength(1);
  });

  it("matches by set number, not position, when blank sets were dropped", () => {
    const [latest] = buildSessionViews(
      build([
        log("2026-09-18", sets([8, 82.5], [null, null], [6, 82.5])), // performed sets are #1 and #3
        log("2026-09-11", sets([8, 80], [8, 80], [6, 80])),
      ])
    );
    expect(latest.sets.map((s) => s.set.setNumber)).toEqual([1, 3]);
    expect(latest.sets[1].comparison?.weight).toEqual({ type: "delta", delta: 2.5, unit: "kg" });
  });

  it("19. mixed units keep the weight comparison unavailable, but reps still compare", () => {
    const [latest] = buildSessionViews(
      build([log("2026-09-18", sets([8, 176, "lb"])), log("2026-09-11", sets([6, 80, "kg"]))])
    );
    expect(latest.sets[0].comparison).toEqual({
      weight: { type: "unavailable" },
      reps: { type: "delta", delta: 2 },
    });
  });

  it("missing values leave that one value unavailable without hiding the other", () => {
    const [latest] = buildSessionViews(
      build([log("2026-09-18", sets([8, null])), log("2026-09-11", sets([6, 80]))])
    );
    expect(latest.sets[0].comparison).toEqual({
      weight: { type: "unavailable" },
      reps: { type: "delta", delta: 2 },
    });
  });
});

describe("pageSessionViews — pagination over the full history", () => {
  const dates = ["2026-09-18", "2026-09-11", "2026-09-04", "2026-08-28", "2026-08-21"];
  const allViews = () => buildSessionViews(build(dates.map((d, i) => log(d, sets([5 + i, 80])))));

  it("12. the first page is the newest sessions, with hasMore when older ones remain", () => {
    const page = pageSessionViews(allViews(), { pageSize: 2 });
    expect(page.views.map((v) => v.date)).toEqual(["2026-09-18", "2026-09-11"]);
    expect(page.hasMore).toBe(true);
  });

  it("12. `before` is an exclusive date cursor; the last page has no more", () => {
    const page = pageSessionViews(allViews(), { before: "2026-09-04", pageSize: 5 });
    expect(page.views.map((v) => v.date)).toEqual(["2026-08-28", "2026-08-21"]);
    expect(page.hasMore).toBe(false);
  });

  it("12. exactly a full final page reports no more", () => {
    expect(pageSessionViews(allViews(), { before: "2026-09-04", pageSize: 2 }).hasMore).toBe(false);
  });

  it("the oldest card on a page is compared with its real predecessor on the next page", () => {
    const page = pageSessionViews(allViews(), { pageSize: 2 });
    const oldestOnPage = page.views[1]; // Sep 11
    expect(oldestOnPage.previousDate).toBe("2026-09-04");
    expect(oldestOnPage.daysSincePrevious).toBe(7);
    expect(oldestOnPage.sets[0].comparison?.reps).toEqual({ type: "delta", delta: -1 });
  });

  it("the comparisons don't change with the page they are viewed on", () => {
    const first = pageSessionViews(allViews(), { pageSize: 2 }).views[1];
    const second = pageSessionViews(allViews(), { before: "2026-09-18", pageSize: 2 }).views[0];
    expect(second).toEqual(first);
  });

  it("13. no performed sessions: an empty page", () => {
    expect(pageSessionViews([], { pageSize: 30 })).toEqual({ views: [], hasMore: false });
  });
});
