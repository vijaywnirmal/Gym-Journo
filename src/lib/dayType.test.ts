import { describe, expect, it } from "vitest";
import { dayTypeOf, isDayType, offKindOf } from "./dayType";

describe("dayTypeOf", () => {
  it("reads workout, rest and absence days", () => {
    expect(dayTypeOf({ is_rest_day: false, off_kind: null })).toBe("workout");
    expect(dayTypeOf({ is_rest_day: true, off_kind: "rest" })).toBe("rest");
    expect(dayTypeOf({ is_rest_day: true, off_kind: "absence" })).toBe("absence");
  });

  it("treats a day off saved before off_kind existed as rest", () => {
    expect(dayTypeOf({ is_rest_day: true })).toBe("rest");
    expect(dayTypeOf({ is_rest_day: true, off_kind: null })).toBe("rest");
  });
});

describe("offKindOf", () => {
  it("is null for a workout day and the kind otherwise", () => {
    expect(offKindOf("workout")).toBeNull();
    expect(offKindOf("rest")).toBe("rest");
    expect(offKindOf("absence")).toBe("absence");
  });
});

describe("isDayType", () => {
  it("accepts only the three day types", () => {
    expect(isDayType("absence")).toBe(true);
    expect(isDayType("holiday")).toBe(false);
    expect(isDayType(true)).toBe(false);
  });
});
