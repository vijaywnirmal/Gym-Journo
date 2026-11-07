import { describe, expect, it } from "vitest";
import {
  distanceProblem,
  durationProblem,
  formatDistance,
  formatDuration,
  formatPace,
  formatSetValue,
  parseDuration,
  toMeasure,
} from "./measure";

describe("toMeasure", () => {
  it("reads unknown or missing values as weight and reps", () => {
    expect(toMeasure("time")).toBe("time");
    expect(toMeasure("distance")).toBe("distance");
    expect(toMeasure(undefined)).toBe("weight_reps");
    expect(toMeasure("laps")).toBe("weight_reps");
  });
});

describe("parseDuration", () => {
  it("reads plain seconds and clock times", () => {
    expect(parseDuration("45")).toBe(45);
    expect(parseDuration("1:30")).toBe(90);
    expect(parseDuration("1:02:30")).toBe(3750);
    expect(parseDuration(" 0:05 ")).toBe(5);
  });

  it("is null when blank and NaN when it isn't a time", () => {
    expect(parseDuration("")).toBeNull();
    expect(parseDuration("1.5")).toBeNaN();
    expect(parseDuration("1:75")).toBeNaN();
    expect(parseDuration("a:b")).toBeNaN();
    expect(parseDuration("1:2:3:4")).toBeNaN();
  });
});

describe("formatDuration", () => {
  it("shows minutes and seconds, and hours when there are any", () => {
    expect(formatDuration(45)).toBe("0:45");
    expect(formatDuration(90)).toBe("1:30");
    expect(formatDuration(3750)).toBe("1:02:30");
  });
});

describe("problems", () => {
  it("accepts blanks and sensible values", () => {
    expect(durationProblem("")).toBeNull();
    expect(durationProblem("1:30")).toBeNull();
    expect(distanceProblem("5.2")).toBeNull();
  });

  it("explains times and distances it can't save", () => {
    expect(durationProblem("1.5")).toMatch(/like 45/);
    expect(durationProblem("2:00:01")).toMatch(/2 hours or less/);
    expect(distanceProblem("-1")).toMatch(/between 0 and 1000/);
    expect(distanceProblem("1001")).toMatch(/between 0 and 1000/);
  });
});

describe("formatting", () => {
  it("formats distance and pace", () => {
    expect(formatDistance(5, "km")).toBe("5 km");
    expect(formatDistance(3.105, "mi")).toBe("3.1 mi");
    expect(formatPace(5, 1710, "km")).toBe("5:42 /km");
    expect(formatPace(5, null, "km")).toBeNull();
    expect(formatPace(0, 600, "km")).toBeNull();
  });

  it("describes any kind of set", () => {
    expect(formatSetValue({ reps: 8, weight: 60, weight_unit: "kg" })).toBe("60kg × 8");
    expect(formatSetValue({ reps: null, weight: null, duration_seconds: 90 })).toBe("1:30");
    expect(formatSetValue({ reps: null, weight: null, distance: 5, duration_seconds: 1710, distance_unit: "km" })).toBe("5 km in 28:30");
    expect(formatSetValue({ reps: null, weight: null, distance: 2, distanceUnit: "mi" })).toBe("2 mi");
  });
});
