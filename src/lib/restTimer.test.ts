import { describe, expect, it } from "vitest";
import {
  adjustEndAt,
  DEFAULT_REST_SEC,
  formatClock,
  isValidRestSeconds,
  MAX_REST_SEC,
  readRestSeconds,
  remainingSeconds,
  writeRestSeconds,
} from "./restTimer";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

describe("remainingSeconds", () => {
  it("rounds partial seconds up so 0 only shows when time is truly up", () => {
    expect(remainingSeconds(10_000, 9_001)).toBe(1);
    expect(remainingSeconds(10_000, 10_000)).toBe(0);
  });
  it("never goes negative", () => {
    expect(remainingSeconds(10_000, 20_000)).toBe(0);
  });
});

describe("formatClock", () => {
  it("formats minutes and zero-padded seconds", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(5)).toBe("0:05");
    expect(formatClock(90)).toBe("1:30");
    expect(formatClock(600)).toBe("10:00");
  });
  it("clamps negatives to 0:00", () => {
    expect(formatClock(-3)).toBe("0:00");
  });
});

describe("adjustEndAt", () => {
  it("adds and subtracts time", () => {
    expect(adjustEndAt(60_000, 0, 15)).toBe(75_000);
    expect(adjustEndAt(60_000, 0, -15)).toBe(45_000);
  });
  it("never moves the end into the past", () => {
    expect(adjustEndAt(10_000, 5_000, -15)).toBe(5_000);
  });
  it("caps at the maximum rest", () => {
    expect(adjustEndAt(MAX_REST_SEC * 1000, 0, 15)).toBe(MAX_REST_SEC * 1000);
  });
});

describe("isValidRestSeconds", () => {
  it("accepts whole seconds in range only", () => {
    expect(isValidRestSeconds(90)).toBe(true);
    expect(isValidRestSeconds(5)).toBe(false);
    expect(isValidRestSeconds(601)).toBe(false);
    expect(isValidRestSeconds(90.5)).toBe(false);
    expect(isValidRestSeconds("90")).toBe(false);
  });
});

describe("rest preference storage", () => {
  it("defaults when nothing is stored or storage is missing", () => {
    expect(readRestSeconds(memoryStorage(), "ex-1")).toBe(DEFAULT_REST_SEC);
    expect(readRestSeconds(null, "ex-1")).toBe(DEFAULT_REST_SEC);
  });

  it("round-trips a preference per exercise", () => {
    const storage = memoryStorage();
    writeRestSeconds(storage, "ex-1", 180);
    writeRestSeconds(storage, "ex-2", 60);
    expect(readRestSeconds(storage, "ex-1")).toBe(180);
    expect(readRestSeconds(storage, "ex-2")).toBe(60);
  });

  it("ignores corrupt or invalid stored data", () => {
    const storage = memoryStorage({ "gym-journo:rest-seconds": "not json" });
    expect(readRestSeconds(storage, "ex-1")).toBe(DEFAULT_REST_SEC);
    storage.data.set("gym-journo:rest-seconds", JSON.stringify({ "ex-1": 9999 }));
    expect(readRestSeconds(storage, "ex-1")).toBe(DEFAULT_REST_SEC);
    storage.data.set("gym-journo:rest-seconds", "[1,2]");
    expect(readRestSeconds(storage, "ex-1")).toBe(DEFAULT_REST_SEC);
  });

  it("does not write invalid values and survives a throwing storage", () => {
    const storage = memoryStorage();
    writeRestSeconds(storage, "ex-1", 3);
    expect(storage.data.size).toBe(0);
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(() => writeRestSeconds(throwing, "ex-1", 90)).not.toThrow();
    expect(readRestSeconds(throwing, "ex-1")).toBe(DEFAULT_REST_SEC);
  });
});
