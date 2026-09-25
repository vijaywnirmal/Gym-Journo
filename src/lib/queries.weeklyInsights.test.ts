import { describe, expect, it, vi, beforeEach } from "vitest";
import { shiftDate, today, weekDates } from "./date";

const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } });

type QueryResult = { data: unknown; error: unknown };

// getWeeklyInsights runs several queries in parallel, so results are routed by table and by the
// select string rather than by call order.
let resultFor: (table: string, select: string) => QueryResult = () => ({ data: [], error: null });

function makeBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  for (const name of ["eq", "gte", "lte", "lt", "order", "limit", "in"]) builder[name] = () => builder;
  builder.then = (resolve: (v: QueryResult) => unknown) => Promise.resolve(result).then(resolve);
  return builder;
}

const from = vi.fn((table: string) => ({
  select: (arg: string) => makeBuilder(resultFor(table, arg)),
}));

vi.mock("@/lib/userDate", async () => {
  const { today } = await import("./date");
  return { getToday: async () => today(), getUserTimeZone: async () => ({ signedIn: true, timeZone: null }) };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from }),
}));

const { getWeeklyInsights } = await import("./queries");

const todayStr = today();
const thisWeekStart = weekDates(todayStr)[0];
const lastWeekDay = shiftDate(thisWeekStart, -3);

const chest = { muscle_group: { id: "c", name: "Chest" } };
const exercise = { exercise_muscle_groups: [chest] };

describe("getWeeklyInsights", () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  it("maps muscle tags through the exercise join and splits this week from last week", async () => {
    resultFor = (table, select) => {
      if (table === "workout_plans") return { data: [{ date: todayStr }], error: null };
      if (select.includes("muscle_groups")) {
        return {
          data: [
            { date: todayStr, logged_exercises: [{ exercise, logged_sets: [{ reps: 5, weight: 100, set_type: "working" }] }] },
            {
              date: lastWeekDay,
              logged_exercises: [
                {
                  exercise,
                  logged_sets: [
                    { reps: 5, weight: 100, set_type: "working" },
                    { reps: 5, weight: 50, set_type: "warmup" },
                  ],
                },
              ],
            },
          ],
          error: null,
        };
      }
      // Performed-dates and weekly-days queries.
      return { data: [{ date: todayStr, logged_exercises: [{ logged_sets: [{ reps: 5, weight: 100 }] }] }], error: null };
    };

    const insights = await getWeeklyInsights();
    expect(insights?.thisWeek).toEqual([{ muscleGroupId: "c", name: "Chest", sets: 1 }]);
    expect(insights?.lastWeek).toEqual([{ muscleGroupId: "c", name: "Chest", sets: 1 }]);
    expect(insights?.adherence).toEqual({ planned: 1, performed: 1 });
  });

  it("is null when the history can't be read", async () => {
    resultFor = (table, select) =>
      select.includes("muscle_groups") ? { data: null, error: { message: "boom" } } : { data: [], error: null };
    expect(await getWeeklyInsights()).toBeNull();
  });

  it("is null when signed out", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await getWeeklyInsights()).toBeNull();
  });

  it("has no adherence when the plans query fails", async () => {
    resultFor = (table) =>
      table === "workout_plans" ? { data: null, error: { message: "boom" } } : { data: [], error: null };
    const insights = await getWeeklyInsights();
    expect(insights?.adherence).toBeNull();
    expect(insights?.thisWeek).toEqual([]);
  });
});
