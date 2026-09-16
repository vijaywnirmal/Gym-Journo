import { describe, expect, it } from "vitest";
import { calculateAge } from "./date";

describe("calculateAge", () => {
  it("computes whole years elapsed since the date of birth", () => {
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 30);
    const dobStr = dob.toISOString().slice(0, 10);
    expect(calculateAge(dobStr)).toBe(30);
  });

  it("does not round up before the birthday has occurred this year", () => {
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 30);
    dob.setDate(dob.getDate() + 1); // birthday is tomorrow
    const dobStr = dob.toISOString().slice(0, 10);
    expect(calculateAge(dobStr)).toBe(29);
  });
});
