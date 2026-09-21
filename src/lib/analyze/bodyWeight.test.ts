import { describe, expect, it } from "vitest";
import { distanceToTargetKg, summarizeBodyWeight } from "./bodyWeight";

const TODAY = "2026-09-21";
const m = (date: string, weight_kg: number, updated_at?: string) => ({ date, weight_kg, updated_at });

describe("summarizeBodyWeight", () => {
  it("1. no measurements: nothing to report", () => {
    expect(summarizeBodyWeight([], TODAY)).toBeNull();
  });

  it("2. one measurement: earliest and latest are that record, with no change to compute", () => {
    expect(summarizeBodyWeight([m("2026-09-18", 72)], TODAY)).toEqual({
      measurementCount: 1,
      earliest: { date: "2026-09-18", weightKg: 72 },
      latest: { date: "2026-09-18", weightKg: 72 },
      changeKg: null,
    });
  });

  it("3./4./5. multiple records: earliest and latest are chosen by date, with their own dates and values", () => {
    const facts = summarizeBodyWeight(
      [m("2026-08-10", 71.2), m("2026-09-18", 72), m("2026-07-02", 70), m("2026-08-25", 70.5)],
      TODAY
    );
    expect(facts?.measurementCount).toBe(4);
    expect(facts?.earliest).toEqual({ date: "2026-07-02", weightKg: 70 });
    expect(facts?.latest).toEqual({ date: "2026-09-18", weightKg: 72 });
  });

  it("selection doesn't depend on input order (newest-first, oldest-first, shuffled)", () => {
    const rows = [m("2026-07-02", 70), m("2026-08-10", 71), m("2026-09-18", 72)];
    const a = summarizeBodyWeight(rows, TODAY);
    expect(summarizeBodyWeight([...rows].reverse(), TODAY)).toEqual(a);
    expect(summarizeBodyWeight([rows[1], rows[2], rows[0]], TODAY)).toEqual(a);
  });

  it("6. the change is the raw signed difference latest − earliest", () => {
    expect(summarizeBodyWeight([m("2026-07-02", 70), m("2026-09-18", 72)], TODAY)?.changeKg).toBe(2);
    expect(summarizeBodyWeight([m("2026-07-02", 72), m("2026-09-18", 70)], TODAY)?.changeKg).toBe(-2);
    expect(summarizeBodyWeight([m("2026-07-02", 70), m("2026-09-18", 70)], TODAY)?.changeKg).toBe(0);
  });

  it("the change uses only the earliest and latest records, not the ones between", () => {
    const facts = summarizeBodyWeight([m("2026-07-02", 70), m("2026-08-01", 80), m("2026-09-18", 72)], TODAY);
    expect(facts?.changeKg).toBe(2);
  });

  it("7. a future-dated measurement is never the latest", () => {
    const facts = summarizeBodyWeight([m("2026-07-02", 70), m("2026-09-18", 72), m("2026-09-25", 90)], TODAY);
    expect(facts?.latest).toEqual({ date: "2026-09-18", weightKg: 72 });
    expect(facts?.measurementCount).toBe(2);
    expect(facts?.changeKg).toBe(2);
  });

  it("7. a measurement dated today counts; only future dates are excluded", () => {
    expect(summarizeBodyWeight([m("2026-09-18", 72), m(TODAY, 71.5)], TODAY)?.latest.date).toBe(TODAY);
  });

  it("7. if every measurement is in the future there is nothing to report", () => {
    expect(summarizeBodyWeight([m("2026-09-22", 72), m("2026-10-01", 73)], TODAY)).toBeNull();
  });

  it("a future record can't become the only comparison — one real record leaves no change", () => {
    const facts = summarizeBodyWeight([m("2026-09-18", 72), m("2026-09-30", 80)], TODAY);
    expect(facts?.measurementCount).toBe(1);
    expect(facts?.changeKg).toBeNull();
  });

  it("duplicate rows for one date follow the one-row-per-date rule: the most recently updated wins", () => {
    const facts = summarizeBodyWeight(
      [
        m("2026-09-18", 72, "2026-09-18T08:00:00Z"),
        m("2026-09-18", 71.4, "2026-09-18T20:00:00Z"),
        m("2026-07-02", 70, "2026-07-02T08:00:00Z"),
      ],
      TODAY
    );
    expect(facts?.measurementCount).toBe(2);
    expect(facts?.latest.weightKg).toBe(71.4);
  });

  it("crosses month and year boundaries", () => {
    const facts = summarizeBodyWeight([m("2025-12-31", 70), m("2026-01-01", 70.4)], "2026-01-05");
    expect(facts?.earliest.date).toBe("2025-12-31");
    expect(facts?.latest.date).toBe("2026-01-01");
  });
});

describe("distanceToTargetKg", () => {
  it("10. is latest − target: positive above the target", () => {
    expect(distanceToTargetKg(72, 68)).toBe(4);
  });

  it("10. negative below the target", () => {
    expect(distanceToTargetKg(65, 68)).toBe(-3);
  });

  it("10. zero at the target", () => {
    expect(distanceToTargetKg(68, 68)).toBe(0);
  });
});
