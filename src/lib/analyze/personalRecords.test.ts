import { describe, expect, it } from "vitest";
import {
  bestSessionVolume,
  buildRecordHistory,
  describePersonalRecord,
  detectPersonalRecords,
} from "./personalRecords";
import type { ExerciseSession, PerformedSet } from "./exerciseSessions";

const sets = (...rows: [number | null, number | null, string?][]): PerformedSet[] =>
  rows.map(([reps, weight, unit], i) => ({ setNumber: i + 1, reps, weight, weightUnit: unit ?? "kg" }));

const session = (date: string, ...rows: [number | null, number | null, string?][]): ExerciseSession => ({
  date,
  sets: sets(...rows),
});

describe("detectPersonalRecords", () => {
  it("never reports a record for the first-ever session", () => {
    expect(detectPersonalRecords([], sets([5, 100]))).toEqual([]);
  });

  it("returns nothing when the current session has no performed sets", () => {
    expect(detectPersonalRecords([session("2026-09-01", [5, 80])], sets([null, null]))).toEqual([]);
  });

  it("reports weight, e1rm and volume records when all are beaten", () => {
    const records = detectPersonalRecords([session("2026-09-01", [5, 80])], sets([5, 90]));
    expect(records.map((r) => r.kind)).toEqual(["weight", "e1rm", "volume"]);
    const weight = records[0];
    expect(weight).toMatchObject({ valueKg: 90, previousKg: 80, reps: 5 });
  });

  it("does not count matching the previous best as a record", () => {
    expect(detectPersonalRecords([session("2026-09-01", [5, 80])], sets([5, 80]))).toEqual([]);
  });

  it("compares against the best of all earlier sessions, not just the last one", () => {
    const previous = [session("2026-09-08", [5, 70]), session("2026-09-01", [5, 100])];
    expect(detectPersonalRecords(previous, sets([5, 90]))).toEqual([]);
  });

  it("reports an e1rm record from more reps at the same weight without a weight record", () => {
    const records = detectPersonalRecords([session("2026-09-01", [5, 100])], sets([8, 100]));
    expect(records.map((r) => r.kind)).toEqual(["e1rm", "volume"]);
  });

  it("reports a volume record from more sets without weight or e1rm records", () => {
    const records = detectPersonalRecords([session("2026-09-01", [5, 100])], sets([5, 100], [5, 100]));
    expect(records.map((r) => r.kind)).toEqual(["volume"]);
    expect(records[0]).toMatchObject({ valueKg: 1000, previousKg: 500 });
  });

  it("treats the same weight in lb and kg as equal, not a record", () => {
    const records = detectPersonalRecords([session("2026-09-01", [5, 100])], sets([5, 220.46226218, "lb"]));
    expect(records).toEqual([]);
  });

  it("converts lb to kg before comparing", () => {
    const records = detectPersonalRecords([session("2026-09-01", [5, 100, "lb"])], sets([5, 50]));
    expect(records.map((r) => r.kind)).toEqual(["weight", "e1rm", "volume"]);
    expect(records[0].previousKg).toBeCloseTo(45.36, 2);
  });

  it("ignores sets missing reps or weight on either side", () => {
    const previous = [session("2026-09-01", [null, 200], [5, 60])];
    const records = detectPersonalRecords(previous, sets([5, null], [5, 70]));
    expect(records.map((r) => r.kind)).toEqual(["weight", "e1rm", "volume"]);
  });

  it("reports nothing when history has no set with both reps and weight", () => {
    expect(detectPersonalRecords([session("2026-09-01", [10, null])], sets([5, 50]))).toEqual([]);
  });
});

describe("describePersonalRecord", () => {
  it("formats a weight record with reps in kg", () => {
    expect(describePersonalRecord({ kind: "weight", valueKg: 90, previousKg: 80, reps: 5 }, "kg")).toBe(
      "Heaviest weight: 90 kg × 5 (was 80 kg)"
    );
  });

  it("converts to lb and rounds to one decimal", () => {
    expect(describePersonalRecord({ kind: "e1rm", valueKg: 100, previousKg: 95, reps: null }, "lb")).toBe(
      "Best estimated 1RM: 220.5 lb (was 209.4 lb)"
    );
  });

  it("uses thousands separators for volume", () => {
    expect(describePersonalRecord({ kind: "volume", valueKg: 1250, previousKg: 1000, reps: null }, "kg")).toBe(
      "Best session volume: 1,250 kg (was 1,000 kg)"
    );
  });
});

describe("detectPersonalRecords — warm-ups (M4)", () => {
  it("never counts a warm-up set as a record", () => {
    const current: PerformedSet[] = [{ setNumber: 1, reps: 5, weight: 200, weightUnit: "kg", setType: "warmup" }];
    expect(detectPersonalRecords([session("2026-09-01", [5, 100])], current)).toEqual([]);
  });

  it("ignores earlier warm-ups when finding the best to beat", () => {
    const previous: ExerciseSession[] = [
      {
        date: "2026-09-01",
        sets: [
          { setNumber: 1, reps: 5, weight: 200, weightUnit: "kg", setType: "warmup" },
          { setNumber: 2, reps: 5, weight: 100, weightUnit: "kg", setType: "working" },
        ],
      },
    ];
    const records = detectPersonalRecords(previous, sets([5, 110]));
    expect(records.map((r) => r.kind)).toEqual(["weight", "e1rm", "volume"]);
    expect(records[0].previousKg).toBe(100);
  });
});

describe("buildRecordHistory (M8)", () => {
  it("replays the history and lists record sessions newest first, skipping the first session", () => {
    const history = [
      session("2026-09-15", [5, 95]),
      session("2026-09-01", [5, 80]),
      session("2026-09-08", [5, 70]),
      session("2026-09-22", [5, 90]),
    ];
    const events = buildRecordHistory(history);
    expect(events.map((e) => e.date)).toEqual(["2026-09-15"]);
    expect(events[0].records.map((r) => r.kind)).toEqual(["weight", "e1rm", "volume"]);
    expect(events[0].records[0].previousKg).toBe(80);
  });

  it("is empty for zero or one session", () => {
    expect(buildRecordHistory([])).toEqual([]);
    expect(buildRecordHistory([session("2026-09-01", [5, 80])])).toEqual([]);
  });

  it("agrees with the logger's detection for each session", () => {
    const history = [session("2026-09-01", [5, 80]), session("2026-09-08", [5, 85]), session("2026-09-15", [5, 85], [5, 85])];
    const events = buildRecordHistory(history);
    expect(events.map((e) => [e.date, e.records.map((r) => r.kind)])).toEqual([
      ["2026-09-15", ["volume"]],
      ["2026-09-08", ["weight", "e1rm", "volume"]],
    ]);
  });
});

describe("bestSessionVolume (M8)", () => {
  it("finds the highest-volume session, ignoring warm-ups", () => {
    const withWarmup: ExerciseSession = {
      date: "2026-09-08",
      sets: [
        { setNumber: 1, reps: 10, weight: 100, weightUnit: "kg", setType: "warmup" },
        { setNumber: 2, reps: 5, weight: 50, weightUnit: "kg" },
      ],
    };
    expect(bestSessionVolume([session("2026-09-01", [5, 80]), withWarmup])).toEqual({ volumeKg: 400, date: "2026-09-01" });
    expect(bestSessionVolume([session("2026-09-01", [null, 80])])).toBeNull();
  });
});
