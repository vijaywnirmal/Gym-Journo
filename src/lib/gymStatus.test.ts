import { describe, expect, it } from "vitest";
import { filterMembers, isQuiet, lastWorkoutLabel, needsTrainer, trainerLabel } from "./gymStatus";
import type { GymMemberRow } from "./types";

const row = (over: Partial<GymMemberRow>): GymMemberRow => ({
  member_id: "m",
  first_name: "Mina",
  last_name: null,
  joined_at: "2026-10-01T00:00:00Z",
  trainer_id: null,
  trainer_name: null,
  offered_trainer_id: null,
  offered_trainer_name: null,
  has_own_trainer: false,
  workouts_this_week: 0,
  days_since_last_workout: null,
  ...over,
});

describe("gym member status", () => {
  it("calls a member quiet after 7 days without a workout, or with none", () => {
    expect(isQuiet(row({ days_since_last_workout: 6 }))).toBe(false);
    expect(isQuiet(row({ days_since_last_workout: 7 }))).toBe(true);
    expect(isQuiet(row({ days_since_last_workout: null }))).toBe(true);
  });

  it("needs a trainer only without the gym's, a suggested one, or their own", () => {
    expect(needsTrainer(row({}))).toBe(true);
    expect(needsTrainer(row({ trainer_id: "t", trainer_name: "Tara" }))).toBe(false);
    expect(needsTrainer(row({ offered_trainer_id: "t", offered_trainer_name: "Tara" }))).toBe(false);
    expect(needsTrainer(row({ has_own_trainer: true }))).toBe(false);
    expect(trainerLabel(row({ trainer_name: "Tara", trainer_id: "t" }))).toBe("Tara");
    expect(trainerLabel(row({ offered_trainer_id: "t", offered_trainer_name: "Tara" }))).toBe("Suggested Tara");
    expect(trainerLabel(row({ has_own_trainer: true }))).toBe("Own trainer");
    expect(trainerLabel(row({}))).toBe("Needs a trainer");
  });

  it("filters and labels", () => {
    const rows = [
      row({ member_id: "a", trainer_id: "t", trainer_name: "Tara", days_since_last_workout: 0 }),
      row({ member_id: "b", days_since_last_workout: 23 }),
      row({ member_id: "c", has_own_trainer: true, days_since_last_workout: 1 }),
    ];
    expect(filterMembers(rows, "needs-trainer").map((r) => r.member_id)).toEqual(["b"]);
    expect(filterMembers(rows, "quiet").map((r) => r.member_id)).toEqual(["b"]);
    expect(filterMembers(rows, "all")).toHaveLength(3);
    expect(lastWorkoutLabel(rows[0])).toBe("Last workout today");
    expect(lastWorkoutLabel(rows[2])).toBe("Last workout yesterday");
    expect(lastWorkoutLabel(rows[1])).toBe("Last workout 23 days ago");
    expect(lastWorkoutLabel(row({}))).toBe("No workouts yet");
  });
});
