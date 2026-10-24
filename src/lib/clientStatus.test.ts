import { describe, expect, it } from "vitest";
import {
  clientName,
  clientSummary,
  dayStatus,
  isQuietClient,
  lastWorkoutLine,
  mondayOf,
  todayStatus,
  toWorkoutPlan,
  trainerToday,
  weekFrom,
} from "./clientStatus";
import type { ClientLog, ClientOverview, ClientPlan } from "./types";

const plan = (over: Partial<ClientPlan> = {}): ClientPlan => ({
  id: "p1",
  date: "2026-10-22",
  title: "Legs",
  is_rest_day: false,
  off_kind: null,
  off_marked_late: false,
  created_by: "t1",
  updated_by: "t1",
  muscle_group_ids: ["mg-b", "mg-a"],
  exercises: [
    { id: "pe1", exercise_id: "e1", name: "Squat", equipment: "Barbell", position: 0, target_sets: 3, target_reps: 5, target_weight: 60, target_weight_unit: "kg" },
  ],
  ...over,
});
const log = (reps: number | null, weight: number | null): ClientLog => ({
  id: "l1",
  date: "2026-10-22",
  plan_id: null,
  notes: null,
  completed_at: null,
  exercises: [{ exercise_id: "e1", name: "Squat", position: 0, notes: null, sets: [{ set_number: 1, reps, weight, weight_unit: "kg", set_type: "working", rpe: null, notes: null }] }],
});

describe("dayStatus", () => {
  it("counts a day as done only with a performed set", () => {
    expect(dayStatus(plan(), log(5, 60), "2026-10-20", "2026-10-22")).toBe("done");
    expect(dayStatus(null, log(0, null), "2026-10-22", "2026-10-22")).toBe("done");
    expect(dayStatus(plan(), log(null, null), "2026-10-20", "2026-10-22")).toBe("missed");
  });

  it("tells planned, today, missed and days off apart", () => {
    expect(dayStatus(plan(), null, "2026-10-21", "2026-10-22")).toBe("missed");
    expect(dayStatus(plan(), null, "2026-10-22", "2026-10-22")).toBe("today");
    expect(dayStatus(plan(), null, "2026-10-23", "2026-10-22")).toBe("planned");
    expect(dayStatus(plan({ is_rest_day: true, off_kind: "rest" }), null, "2026-10-21", "2026-10-22")).toBe("rest");
    expect(dayStatus(plan({ is_rest_day: true, off_kind: "absence" }), null, "2026-10-21", "2026-10-22")).toBe("absence");
    expect(dayStatus(null, null, "2026-10-21", "2026-10-22")).toBe("none");
  });
});

describe("todayStatus", () => {
  it("reads the dashboard row", () => {
    expect(todayStatus({ today_plan: "workout", today_done: true })).toBe("done");
    expect(todayStatus({ today_plan: null, today_done: true })).toBe("done");
    expect(todayStatus({ today_plan: "workout", today_done: false })).toBe("today");
    expect(todayStatus({ today_plan: "rest", today_done: false })).toBe("rest");
    expect(todayStatus({ today_plan: null, today_done: false })).toBe("none");
  });
});

describe("names and summaries", () => {
  it("joins what the client filled in", () => {
    expect(clientName({ first_name: "Priya", last_name: "S" })).toBe("Priya S");
    expect(clientName({ first_name: null, last_name: null })).toBe("Client");
    expect(clientSummary({ primary_goal: "build_muscle", experience_level: "beginner", training_days_per_week: 3 })).toBe(
      "Build muscle · Beginner · 3 days a week"
    );
    expect(clientSummary({ primary_goal: null, experience_level: null, training_days_per_week: null })).toBe("");
  });
});

describe("weeks", () => {
  it("run Monday to Sunday", () => {
    expect(mondayOf("2026-10-22")).toBe("2026-10-19"); // a Thursday
    expect(mondayOf("2026-10-19")).toBe("2026-10-19");
    expect(mondayOf("2026-10-25")).toBe("2026-10-19"); // a Sunday
    expect(weekFrom("2026-10-19")).toEqual([
      "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25",
    ]);
  });
});

describe("toWorkoutPlan", () => {
  it("maps a client plan for the schedule form", () => {
    const result = toWorkoutPlan(plan(), "c1", [
      { id: "mg-a", name: "Quads" },
      { id: "mg-b", name: "Glutes" },
      { id: "mg-c", name: "Chest" },
    ]);
    expect(result.user_id).toBe("c1");
    expect(result.muscle_groups?.map((m) => m.name)).toEqual(["Glutes", "Quads"]);
    expect(result.planned_exercises?.[0]).toMatchObject({ exercise_id: "e1", target_weight: 60, exercise: { name: "Squat" } });
  });
});

const overview = (over: Partial<ClientOverview>): ClientOverview => ({
  link_id: "l",
  client_id: "c",
  first_name: "Priya",
  last_name: null,
  primary_goal: null,
  experience_level: null,
  training_days_per_week: null,
  started_at: "2026-10-01T00:00:00Z",
  client_today: "2026-10-24",
  today_plan: null,
  today_done: false,
  planned_this_week: 0,
  done_this_week: 0,
  last_workout_on: null,
  latest_weight_kg: null,
  latest_weight_on: null,
  ...over,
});

describe("trainer's Today", () => {
  it("calls a client quiet after 7 days without a workout, or with none", () => {
    expect(isQuietClient(overview({ last_workout_on: "2026-10-18" }))).toBe(false);
    expect(isQuietClient(overview({ last_workout_on: "2026-10-17" }))).toBe(true);
    expect(isQuietClient(overview({}))).toBe(true);
    expect(lastWorkoutLine(overview({ last_workout_on: "2026-10-23" }))).toBe("Last workout yesterday");
  });

  it("sorts clients into today's sessions, who needs a plan, and who has gone quiet", () => {
    const done = overview({ client_id: "a", today_plan: "workout", today_done: true, planned_this_week: 3, done_this_week: 2, last_workout_on: "2026-10-24" });
    const due = overview({ client_id: "b", today_plan: "workout", planned_this_week: 2, done_this_week: 1, last_workout_on: "2026-10-22" });
    const unplanned = overview({ client_id: "c", last_workout_on: "2026-10-10" });
    const view = trainerToday([done, due, unplanned]);
    expect(view.today.map((r) => r.client_id)).toEqual(["b", "a"]);
    expect(view.needPlan.map((r) => r.client_id)).toEqual(["c"]);
    expect(view.quiet.map((r) => r.client_id)).toEqual(["c"]);
    expect([view.doneThisWeek, view.plannedThisWeek]).toEqual([3, 5]);
  });
});
