import { describe, expect, it, vi, beforeEach } from "vitest";

const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } });
const maybeSingle = vi.fn();

// A single reusable chainable mock: every intermediate call (eq/not/lt/order/limit) returns the
// same chain object, and maybeSingle is the one terminal call whose resolved value each test
// configures. This supports both getLastCompletedLog's chain (eq→not→order→limit→maybeSingle)
// and getPreviousPerformance's (eq→eq→lt→order→limit→maybeSingle) without separate mocks.
const chain: Record<string, ReturnType<typeof vi.fn>> = {};
const eq = vi.fn(() => chain);
const not = vi.fn(() => chain);
const lt = vi.fn(() => chain);
const order = vi.fn(() => chain);
const limit = vi.fn(() => chain);
Object.assign(chain, { eq, not, lt, order, limit, maybeSingle });

const select = vi.fn(() => chain);
const from = vi.fn(() => ({ select }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from,
  }),
}));

const { getLastCompletedLog, getPreviousPerformance } = await import("./queries");

describe("getLastCompletedLog", () => {
  beforeEach(() => {
    maybeSingle.mockReset();
  });

  it("returns the most recent completed log with its plan title", async () => {
    maybeSingle.mockResolvedValue({
      data: { date: "2026-09-14", plan: { title: "Push Day" } },
      error: null,
    });
    const result = await getLastCompletedLog();
    expect(result).toEqual({ date: "2026-09-14", title: "Push Day" });
    expect(not).toHaveBeenCalledWith("completed_at", "is", null);
  });

  it("falls back to a null title for a freeform (planless) log", async () => {
    maybeSingle.mockResolvedValue({ data: { date: "2026-09-14", plan: null }, error: null });
    const result = await getLastCompletedLog();
    expect(result).toEqual({ date: "2026-09-14", title: null });
  });

  it("returns null when no completed log exists", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const result = await getLastCompletedLog();
    expect(result).toBeNull();
  });
});

describe("getPreviousPerformance", () => {
  beforeEach(() => {
    maybeSingle.mockReset();
    eq.mockClear();
    lt.mockClear();
    order.mockClear();
  });

  it("returns the most recent prior log's sets for that exercise, in set-number order", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        date: "2026-09-10",
        logged_exercises: [
          {
            logged_sets: [
              { set_number: 2, reps: 9, weight: 60, weight_unit: "kg" },
              { set_number: 1, reps: 10, weight: 60, weight_unit: "kg" },
            ],
          },
        ],
      },
      error: null,
    });
    const result = await getPreviousPerformance("ex-1", "2026-09-16");
    expect(result).toEqual({
      date: "2026-09-10",
      sets: [
        { reps: 10, weight: 60, weightUnit: "kg" },
        { reps: 9, weight: 60, weightUnit: "kg" },
      ],
    });
    expect(eq).toHaveBeenCalledWith("logged_exercises.exercise_id", "ex-1");
    expect(lt).toHaveBeenCalledWith("date", "2026-09-16");
    expect(order).toHaveBeenCalledWith("date", { ascending: false });
  });

  it("returns null when there is no prior log for that exercise", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const result = await getPreviousPerformance("ex-1", "2026-09-16");
    expect(result).toBeNull();
  });

  it("returns null when signed out", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await getPreviousPerformance("ex-1", "2026-09-16");
    expect(result).toBeNull();
  });
});
