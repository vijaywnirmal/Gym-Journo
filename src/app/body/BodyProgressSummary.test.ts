import { describe, expect, it } from "vitest";
import { getGoalDirection, formatWeightKg, formatDeltaKg } from "./BodyProgressSummary";

describe("getGoalDirection", () => {
  it("lose_fat: a weight decrease moves toward the target", () => {
    expect(getGoalDirection("lose_fat", -1.5, 75)).toBe("toward");
  });

  it("lose_fat: a weight increase moves away from the target", () => {
    expect(getGoalDirection("lose_fat", 1.5, 75)).toBe("away");
  });

  it("build_muscle: a weight increase moves toward the target", () => {
    expect(getGoalDirection("build_muscle", 1.5, 85)).toBe("toward");
  });

  it("build_muscle: a weight decrease moves away from the target", () => {
    expect(getGoalDirection("build_muscle", -1.5, 85)).toBe("away");
  });

  it("maintain never receives a directional interpretation", () => {
    expect(getGoalDirection("maintain", -1.5, 75)).toBeNull();
    expect(getGoalDirection("maintain", 1.5, 75)).toBeNull();
  });

  it("general_fitness never receives a directional interpretation", () => {
    expect(getGoalDirection("general_fitness", -1.5, 75)).toBeNull();
    expect(getGoalDirection("general_fitness", 1.5, 75)).toBeNull();
  });

  it("returns null when there is no target weight, regardless of goal", () => {
    expect(getGoalDirection("lose_fat", -1.5, null)).toBeNull();
    expect(getGoalDirection("build_muscle", 1.5, null)).toBeNull();
  });

  it("returns null when there is no goal at all", () => {
    expect(getGoalDirection(null, -1.5, 75)).toBeNull();
  });

  it("makes no directional claim for a zero delta, even with a goal and target set", () => {
    expect(getGoalDirection("lose_fat", 0, 75)).toBeNull();
    expect(getGoalDirection("build_muscle", 0, 85)).toBeNull();
  });
});

describe("formatWeightKg", () => {
  it("formats to one decimal place", () => {
    expect(formatWeightKg(80)).toBe("80.0 kg");
    expect(formatWeightKg(78.5)).toBe("78.5 kg");
  });
});

describe("formatDeltaKg", () => {
  it("formats a decrease with a minus sign", () => {
    expect(formatDeltaKg(-1.5)).toBe("−1.5 kg");
  });

  it("formats an increase with a plus sign", () => {
    expect(formatDeltaKg(1.5)).toBe("+1.5 kg");
  });

  it("formats no change with no sign", () => {
    expect(formatDeltaKg(0)).toBe("0.0 kg");
  });
});
