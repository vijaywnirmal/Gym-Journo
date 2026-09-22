import { describe, expect, it } from "vitest";
import {
  isValidEmail,
  safeRedirectPath,
  validateDateOfBirth,
  validateExerciseName,
  validateExperienceLevel,
  validateMeasurementDate,
  validateMeasurementNote,
  validatePassword,
  validatePrimaryGoal,
  validateTargetWeight,
  validateTargetWeightKg,
  validateTrainingDaysPerWeek,
  validateWeightKg,
  WEIGHT_UNITS,
  MAX_EXERCISE_NAME_LENGTH,
  MAX_MEASUREMENT_NOTE_LENGTH,
  MIN_PASSWORD_LENGTH,
} from "./validation";
import { today } from "./date";

describe("safeRedirectPath", () => {
  it("allows a normal relative path", () => {
    expect(safeRedirectPath("/schedule/2026-01-01")).toBe("/schedule/2026-01-01");
  });

  it("falls back for a missing value", () => {
    expect(safeRedirectPath(null)).toBe("/");
    expect(safeRedirectPath(undefined, "/login")).toBe("/login");
  });

  it("rejects protocol-relative URLs used for open redirects", () => {
    expect(safeRedirectPath("//evil.com")).toBe("/");
  });

  it("rejects absolute URLs to other origins", () => {
    expect(safeRedirectPath("https://evil.com")).toBe("/");
    expect(safeRedirectPath("http://evil.com/path")).toBe("/");
  });

  it("rejects paths not starting with a slash", () => {
    expect(safeRedirectPath("evil.com")).toBe("/");
  });

  it("rejects backslash-based redirect tricks", () => {
    expect(safeRedirectPath("/\\evil.com")).toBe("/");
  });
});

describe("isValidEmail", () => {
  it("accepts a normal email", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
  });

  it("rejects strings without an @ or domain", () => {
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("user@")).toBe(false);
    expect(isValidEmail("@example.com")).toBe(false);
  });
});

describe("validateDateOfBirth", () => {
  it("accepts a reasonable past date", () => {
    expect(validateDateOfBirth("1990-05-15")).toBeNull();
  });

  it("rejects an unparseable date", () => {
    expect(validateDateOfBirth("not-a-date")).not.toBeNull();
  });

  it("rejects a future date", () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    expect(validateDateOfBirth(future.toISOString().slice(0, 10))).not.toBeNull();
  });

  it("rejects an implausibly old date", () => {
    expect(validateDateOfBirth("1800-01-01")).not.toBeNull();
  });
});

describe("validatePrimaryGoal", () => {
  it("accepts each allowed value", () => {
    for (const v of ["build_muscle", "lose_fat", "maintain", "general_fitness"]) {
      expect(validatePrimaryGoal(v)).toBeNull();
    }
  });

  it("rejects an invalid value", () => {
    expect(validatePrimaryGoal("improve_performance")).not.toBeNull();
    expect(validatePrimaryGoal("")).not.toBeNull();
  });
});

describe("validateExperienceLevel", () => {
  it("accepts each allowed value", () => {
    for (const v of ["beginner", "intermediate", "advanced"]) {
      expect(validateExperienceLevel(v)).toBeNull();
    }
  });

  it("rejects an invalid value", () => {
    expect(validateExperienceLevel("expert")).not.toBeNull();
    expect(validateExperienceLevel("")).not.toBeNull();
  });
});

describe("validateTrainingDaysPerWeek", () => {
  it("accepts values from 1 through 7", () => {
    for (let n = 1; n <= 7; n++) {
      expect(validateTrainingDaysPerWeek(n)).toBeNull();
    }
  });

  it("rejects 0", () => {
    expect(validateTrainingDaysPerWeek(0)).not.toBeNull();
  });

  it("rejects 8", () => {
    expect(validateTrainingDaysPerWeek(8)).not.toBeNull();
  });

  it("rejects non-integers", () => {
    expect(validateTrainingDaysPerWeek(3.5)).not.toBeNull();
  });
});

describe("validateTargetWeightKg", () => {
  it("rejects zero, negative, and unreasonably large values", () => {
    expect(validateTargetWeightKg(0)).not.toBeNull();
    expect(validateTargetWeightKg(-10)).not.toBeNull();
    expect(validateTargetWeightKg(1000)).not.toBeNull();
  });

  it("accepts a reasonable value", () => {
    expect(validateTargetWeightKg(70)).toBeNull();
  });
});

describe("validateExerciseName", () => {
  it("rejects an empty name", () => {
    expect(validateExerciseName("")).not.toBeNull();
  });

  it("rejects a whitespace-only name", () => {
    expect(validateExerciseName("   ")).not.toBeNull();
  });

  it("accepts a valid name with surrounding whitespace trimmed", () => {
    expect(validateExerciseName("  Bench Press  ")).toBeNull();
  });

  it("rejects a name longer than the maximum length", () => {
    expect(validateExerciseName("a".repeat(MAX_EXERCISE_NAME_LENGTH + 1))).not.toBeNull();
  });

  it("accepts a name at exactly the maximum length", () => {
    expect(validateExerciseName("a".repeat(MAX_EXERCISE_NAME_LENGTH))).toBeNull();
  });
});

describe("validatePassword", () => {
  it("rejects passwords shorter than the minimum length", () => {
    expect(validatePassword("a".repeat(MIN_PASSWORD_LENGTH - 1))).not.toBeNull();
  });

  it("accepts passwords at or above the minimum length", () => {
    expect(validatePassword("a".repeat(MIN_PASSWORD_LENGTH))).toBeNull();
  });
});

describe("validateWeightKg", () => {
  it("accepts a normal weight", () => {
    expect(validateWeightKg(72.5)).toBeNull();
  });

  it("rejects zero", () => {
    expect(validateWeightKg(0)).not.toBeNull();
  });

  it("rejects negative values", () => {
    expect(validateWeightKg(-10)).not.toBeNull();
  });

  it("rejects NaN/non-finite values", () => {
    expect(validateWeightKg(NaN)).not.toBeNull();
    expect(validateWeightKg(Infinity)).not.toBeNull();
  });

  it("rejects an unreasonably large value", () => {
    expect(validateWeightKg(5000)).not.toBeNull();
  });
});

describe("WEIGHT_UNITS", () => {
  it("is exactly kg and lb", () => {
    expect(WEIGHT_UNITS).toEqual(new Set(["kg", "lb"]));
  });
});

describe("validateTargetWeight", () => {
  it("accepts a normal target weight", () => {
    expect(validateTargetWeight(82.5)).toBeNull();
  });

  it("accepts exactly 0 — a bodyweight exercise's target is 'no added weight', unlike a body-weight goal", () => {
    expect(validateTargetWeight(0)).toBeNull();
    // The distinction from validateWeightKg (a body measurement) that this exists to make:
    expect(validateWeightKg(0)).not.toBeNull();
  });

  it("rejects negative values", () => {
    expect(validateTargetWeight(-10)).not.toBeNull();
  });

  it("rejects NaN/non-finite values", () => {
    expect(validateTargetWeight(NaN)).not.toBeNull();
    expect(validateTargetWeight(Infinity)).not.toBeNull();
  });

  it("rejects an unreasonably large value", () => {
    expect(validateTargetWeight(501)).not.toBeNull();
    expect(validateTargetWeight(500)).toBeNull();
  });
});

describe("validateMeasurementDate", () => {
  // Regression test for the exact bug found during live Phase 8 verification: comparing the
  // input against a UTC-derived "today" (e.g. `new Date().toISOString().slice(0, 10)`) instead
  // of the app's canonical local-time `today()` could disagree near local midnight and wrongly
  // reject the current day's own date. This must always accept whatever `today()` itself returns.
  it("accepts the app's own canonical today() value, regardless of local timezone offset", () => {
    expect(validateMeasurementDate(today(), today())).toBeNull();
  });

  it("rejects a date one year in the future", () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    expect(validateMeasurementDate(future.toISOString().slice(0, 10), today())).not.toBeNull();
  });

  it("rejects a malformed date string", () => {
    expect(validateMeasurementDate("not-a-date", today())).not.toBeNull();
  });

  it("accepts a past date", () => {
    expect(validateMeasurementDate("2020-01-01", today())).toBeNull();
  });
});

describe("validateMeasurementNote", () => {
  it("accepts a normal note", () => {
    expect(validateMeasurementNote("Feeling good today")).toBeNull();
  });

  it("accepts an empty note", () => {
    expect(validateMeasurementNote("")).toBeNull();
  });

  it("rejects a note longer than the maximum length", () => {
    expect(validateMeasurementNote("a".repeat(MAX_MEASUREMENT_NOTE_LENGTH + 1))).not.toBeNull();
  });

  it("accepts a note at exactly the maximum length", () => {
    expect(validateMeasurementNote("a".repeat(MAX_MEASUREMENT_NOTE_LENGTH))).toBeNull();
  });
});
