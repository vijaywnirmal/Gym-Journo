import { describe, expect, it } from "vitest";
import { trainerPlanMessage, trainerProgramMessage } from "./trainerMessage";

describe("trainerPlanMessage", () => {
  const base = { trainerName: "Ravi", today: "2026-10-23", title: "Legs", dayType: "workout" as const };

  it("names the day and opens it", () => {
    expect(trainerPlanMessage({ ...base, date: "2026-10-23" })).toEqual({
      title: "Ravi planned your workout",
      body: "Today: Legs",
      url: "/",
      tag: "trainer-plan-today",
    });
    expect(trainerPlanMessage({ ...base, date: "2026-10-24" })).toMatchObject({
      body: "Tomorrow: Legs",
      url: "/schedule/2026-10-24",
      tag: "trainer-plan",
    });
    expect(trainerPlanMessage({ ...base, date: "2026-10-27", title: " " })).toMatchObject({ body: "Tue, Oct 27: Workout" });
  });

  it("words days off", () => {
    expect(trainerPlanMessage({ ...base, date: "2026-10-24", dayType: "rest", title: "" })).toMatchObject({
      title: "Ravi planned a rest day",
      body: "Tomorrow",
    });
    expect(trainerPlanMessage({ ...base, date: "2026-10-24", dayType: "absence", title: "Travel" })).toMatchObject({
      title: "Ravi marked a day off",
      body: "Tomorrow: Travel",
    });
  });
});

describe("trainerProgramMessage", () => {
  it("counts the workouts and says when they start", () => {
    expect(trainerProgramMessage({ trainerName: "Ravi", created: 12, firstDate: "2026-10-24", today: "2026-10-23" })).toEqual({
      title: "Ravi added a program to your plan",
      body: "12 workouts, starting tomorrow",
      url: "/calendar?week=2026-10-24",
      tag: "trainer-plan",
    });
    expect(trainerProgramMessage({ trainerName: "Ravi", created: 1, firstDate: "2026-10-27", today: "2026-10-23" }).body).toBe(
      "1 workout, starting Tue, Oct 27"
    );
  });
});
