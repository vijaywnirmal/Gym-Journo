import { beforeEach, describe, expect, it, vi } from "vitest";

type Result = { data: unknown; error: unknown };

// Each from().select() records its filters and resolves to the queued result for that table.
const calls: { table: string; select: string; filters: [string, ...unknown[]][] }[] = [];
let tableResult: (table: string) => Result = () => ({ data: [], error: null });

function builder(table: string, select: string) {
  const call = { table, select, filters: [] as [string, ...unknown[]][] };
  calls.push(call);
  const chain: Record<string, unknown> = {};
  for (const name of ["in", "ilike", "limit", "eq"]) {
    chain[name] = (...args: unknown[]) => {
      call.filters.push([name, ...args]);
      return chain;
    };
  }
  chain.then = (resolve: (value: Result) => unknown) => Promise.resolve(tableResult(table)).then(resolve);
  return chain;
}

const rpc = vi.fn();
const from = vi.fn((table: string) => ({ select: (select: string) => builder(table, select) }));

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from, rpc }) }));

const { findVisibleExerciseIds, visibleExerciseNamed, getExerciseNames, getExerciseFilterOptions } = await import(
  "./queries"
);

beforeEach(() => {
  calls.length = 0;
  from.mockClear();
  rpc.mockReset();
  tableResult = () => ({ data: [], error: null });
});

describe("findVisibleExerciseIds", () => {
  it("asks only for the given ids, once each, and returns those that come back", async () => {
    tableResult = () => ({ data: [{ id: "a" }], error: null });
    expect(await findVisibleExerciseIds(["a", "b", "a"])).toEqual(new Set(["a"]));
    expect(calls[0].filters).toEqual([["in", "id", ["a", "b"]]]);
  });

  it("doesn't query for no ids, and is null on a query error", async () => {
    expect(await findVisibleExerciseIds([])).toEqual(new Set());
    expect(from).not.toHaveBeenCalled();
    tableResult = () => ({ data: null, error: { message: "boom" } });
    expect(await findVisibleExerciseIds(["a"])).toBeNull();
  });
});

describe("visibleExerciseNamed", () => {
  it("matches the trimmed name case-insensitively, one row at most", async () => {
    tableResult = () => ({ data: [{ id: "x" }], error: null });
    expect(await visibleExerciseNamed("  Bench Press ")).toBe(true);
    expect(calls[0].filters).toEqual([
      ["ilike", "name", "Bench Press"],
      ["limit", 1],
    ]);
  });

  it("escapes LIKE wildcards so they match literally", async () => {
    await visibleExerciseNamed("100% Effort_Row\\");
    expect(calls[0].filters[0]).toEqual(["ilike", "name", "100\\% Effort\\_Row\\\\"]);
  });

  it("is false when nothing matches and null on a query error", async () => {
    expect(await visibleExerciseNamed("New Lift")).toBe(false);
    tableResult = () => ({ data: null, error: { message: "boom" } });
    expect(await visibleExerciseNamed("New Lift")).toBeNull();
  });
});

describe("getExerciseNames", () => {
  it("maps ids to names and skips the query for no ids", async () => {
    tableResult = () => ({ data: [{ id: "a", name: "Deadlift" }], error: null });
    expect(await getExerciseNames(["a"])).toEqual(new Map([["a", "Deadlift"]]));
    expect(await getExerciseNames([])).toEqual(new Map());
    expect(from).toHaveBeenCalledTimes(1);
  });
});

describe("getExerciseFilterOptions", () => {
  const logged = [
    { id: "a", name: "Back Squat" },
    { id: "b", name: "Deadlift" },
  ];

  it("lists the logged exercises", async () => {
    rpc.mockResolvedValue({ data: logged, error: null });
    expect(await getExerciseFilterOptions()).toEqual(logged);
    expect(rpc).toHaveBeenCalledWith("logged_exercise_options");
  });

  it("adds a selected exercise that hasn't been logged, first", async () => {
    rpc.mockResolvedValue({ data: logged, error: null });
    tableResult = () => ({ data: [{ id: "c", name: "Zercher Squat" }], error: null });
    expect(await getExerciseFilterOptions("c")).toEqual([{ id: "c", name: "Zercher Squat" }, ...logged]);
  });

  it("doesn't duplicate a selected exercise that's already logged, or add one that isn't visible", async () => {
    rpc.mockResolvedValue({ data: logged, error: null });
    tableResult = () => ({ data: [{ id: "a", name: "Back Squat" }], error: null });
    expect(await getExerciseFilterOptions("a")).toEqual(logged);
    tableResult = () => ({ data: [], error: null });
    expect(await getExerciseFilterOptions("hidden")).toEqual(logged);
  });

  it("falls back to no options when the logged list can't be read", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await getExerciseFilterOptions()).toEqual([]);
  });
});
