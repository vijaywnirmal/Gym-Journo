import { describe, expect, it, vi, beforeEach } from "vitest";

const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } });

type QueryResult = { data: unknown; error: unknown };

// getLogHistory awaits the query builder directly (no .single()/.maybeSingle()), so the builder
// itself must be thenable. getLogForDate still terminates with .maybeSingle(). This mock
// supports both shapes and records every filter call so tests can assert on them.
function makeBuilder(result: QueryResult) {
  const calls: Record<string, unknown[][]> = { eq: [], order: [], limit: [], lt: [] };
  const builder = {
    calls,
    eq: vi.fn((...args: unknown[]) => {
      calls.eq.push(args);
      return builder;
    }),
    order: vi.fn((...args: unknown[]) => {
      calls.order.push(args);
      return builder;
    }),
    limit: vi.fn((...args: unknown[]) => {
      calls.limit.push(args);
      return builder;
    }),
    lt: vi.fn((...args: unknown[]) => {
      calls.lt.push(args);
      return builder;
    }),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then: (resolve: (v: QueryResult) => unknown) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

let nextResult: QueryResult = { data: [], error: null };
let lastBuilder: ReturnType<typeof makeBuilder> | null = null;
let lastSelectArg = "";
const select = vi.fn((arg: string) => {
  lastSelectArg = arg;
  lastBuilder = makeBuilder(nextResult);
  return lastBuilder;
});
const from = vi.fn(() => ({ select }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from }),
}));

const { getLogHistory, getLogForDate } = await import("./queries");

function loggedLog(overrides: Partial<{ id: string; date: string; notes: string | null; plan: { title: string | null } | null }> = {}) {
  return {
    id: overrides.id ?? "log-1",
    date: overrides.date ?? "2026-09-10",
    notes: overrides.notes ?? null,
    completed_at: null,
    plan: overrides.plan ?? null,
    logged_exercises: [],
  };
}

describe("getLogHistory pagination", () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  it("requests pageSize + 1 rows and reports hasMore when the extra row comes back", async () => {
    nextResult = {
      data: [loggedLog({ id: "1", date: "2026-09-10" }), loggedLog({ id: "2", date: "2026-09-09" }), loggedLog({ id: "3", date: "2026-09-08" })],
      error: null,
    };
    const result = await getLogHistory({ pageSize: 2 });
    expect(result.logs).toHaveLength(2);
    expect(result.hasMore).toBe(true);
    expect(lastBuilder!.calls.limit).toEqual([[3]]);
    expect(lastBuilder!.calls.order).toEqual([["date", { ascending: false }]]);
  });

  it("reports hasMore=false when there is no extra row beyond the page", async () => {
    nextResult = { data: [loggedLog({ id: "1" }), loggedLog({ id: "2" })], error: null };
    const result = await getLogHistory({ pageSize: 2 });
    expect(result.logs).toHaveLength(2);
    expect(result.hasMore).toBe(false);
  });

  it("applies a before cursor via lt(date, before)", async () => {
    nextResult = { data: [], error: null };
    await getLogHistory({ before: "2026-09-01" });
    expect(lastBuilder!.calls.lt).toEqual([["date", "2026-09-01"]]);
  });

  it("does not filter by date when no cursor is given", async () => {
    nextResult = { data: [], error: null };
    await getLogHistory({});
    expect(lastBuilder!.calls.lt).toEqual([]);
  });
});

describe("getLogHistory exercise filter + pagination interaction", () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  it("filters at the query level (inner-joins logged_exercises) rather than post-fetch", async () => {
    nextResult = { data: [], error: null };
    await getLogHistory({ exerciseId: "ex-1", pageSize: 30 });
    expect(lastSelectArg).toContain("logged_exercises!inner");
    expect(lastBuilder!.calls.eq).toContainEqual(["logged_exercises.exercise_id", "ex-1"]);
  });

  it("uses a plain (non-inner) embed when no exercise filter is set", async () => {
    nextResult = { data: [], error: null };
    await getLogHistory({});
    expect(lastSelectArg).not.toContain("logged_exercises!inner");
  });

  it("combines the exercise filter with a before cursor correctly", async () => {
    nextResult = { data: [], error: null };
    await getLogHistory({ exerciseId: "ex-1", before: "2026-09-05", pageSize: 30 });
    expect(lastBuilder!.calls.eq).toContainEqual(["logged_exercises.exercise_id", "ex-1"]);
    expect(lastBuilder!.calls.lt).toEqual([["date", "2026-09-05"]]);
    // The limit(pageSize + 1) trick must still be used for accurate hasMore under a filter.
    expect(lastBuilder!.calls.limit).toEqual([[31]]);
  });
});

describe("getLogHistory workout title / freeform context", () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  it("attaches the joined plan's title as planTitle", async () => {
    nextResult = { data: [loggedLog({ plan: { title: "Push Day" } })], error: null };
    const result = await getLogHistory({});
    expect(result.logs[0].planTitle).toBe("Push Day");
  });

  it("falls back to null planTitle for a freeform (planless) log", async () => {
    nextResult = { data: [loggedLog({ plan: null })], error: null };
    const result = await getLogHistory({});
    expect(result.logs[0].planTitle).toBeNull();
  });
});

describe("getLogHistory notes visibility", () => {
  it("passes non-empty notes through unchanged", async () => {
    nextResult = { data: [loggedLog({ notes: "Felt strong today" })], error: null };
    const result = await getLogHistory({});
    expect(result.logs[0].notes).toBe("Felt strong today");
  });

  it("returns an empty page with hasMore=false when signed out", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await getLogHistory({});
    expect(result).toEqual({ logs: [], hasMore: false });
  });
});

describe("getLogForDate plan title (for the historical day-summary view)", () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  it("returns planTitle from the log's own plan join", async () => {
    nextResult = { data: { ...loggedLog({ plan: { title: "Leg Day" } }) }, error: null };
    const result = await getLogForDate("2026-09-10");
    expect(result?.planTitle).toBe("Leg Day");
  });

  it("returns null planTitle for a freeform log", async () => {
    nextResult = { data: { ...loggedLog({ plan: null }) }, error: null };
    const result = await getLogForDate("2026-09-10");
    expect(result?.planTitle).toBeNull();
  });
});
