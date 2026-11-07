import { beforeEach, describe, expect, it, vi } from "vitest";

type Result = { data: unknown; error: unknown };

const USER = "11111111-1111-4111-8111-111111111111";
const getUser = vi.fn();
// Per table: the batches to return in turn, and the filters and ranges asked for.
let batches: Record<string, Result[]> = {};
const calls: { table: string; eq: [string, unknown][]; range: [number, number] | null }[] = [];

function query(table: string) {
  const call = { table, eq: [] as [string, unknown][], range: null as [number, number] | null };
  calls.push(call);
  const next = async () => batches[table]?.shift() ?? { data: [], error: null };
  const chain = {
    select: () => chain,
    eq: (column: string, value: unknown) => (call.eq.push([column, value]), chain),
    order: () => chain,
    range: (from: number, to: number) => ((call.range = [from, to]), next()),
    maybeSingle: () => next(),
  };
  return chain;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from: (table: string) => query(table) }),
}));

const route = await import("./route");

beforeEach(() => {
  getUser.mockResolvedValue({ data: { user: { id: USER } } });
  batches = {};
  calls.length = 0;
});

describe("GET /api/export", () => {
  it("is 401 when signed out", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await route.GET()).status).toBe(401);
  });

  it("downloads a PDF of only this person's data, reading every batch", async () => {
    const weights = (n: number, start: number) =>
      Array.from({ length: n }, (_, i) => ({ id: `${start + i}`, user_id: USER, date: "2026-11-01", weight_kg: 70, notes: null }));
    batches = {
      body_measurements: [{ data: weights(200, 0), error: null }, { data: weights(3, 200), error: null }],
      profiles: [{ data: { full_name: "Robin Tester", first_name: "Robin" }, error: null }],
    };
    const response = await route.GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toMatch(/^attachment; filename="gymjourno-data-\d{4}-\d{2}-\d{2}\.pdf"$/);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(new TextDecoder().decode((await response.arrayBuffer()).slice(0, 5))).toBe("%PDF-");

    const weightCalls = calls.filter((c) => c.table === "body_measurements");
    expect(weightCalls.map((c) => c.range)).toEqual([[0, 199], [200, 399]]);
    for (const table of ["workout_logs", "workout_plans", "body_measurements"]) {
      expect(calls.filter((c) => c.table === table).every((c) => c.eq.some(([col, v]) => col === "user_id" && v === USER))).toBe(true);
    }
  });

  it("is 500 when a read fails", async () => {
    batches = { workout_logs: [{ data: null, error: { message: "boom" } }] };
    expect((await route.GET()).status).toBe(500);
  });
});
