import { describe, expect, it, vi, beforeEach } from "vitest";

const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } });
const maybeSingle = vi.fn();
const limit = vi.fn().mockReturnValue({ maybeSingle });
const order = vi.fn().mockReturnValue({ limit });
const not = vi.fn().mockReturnValue({ order });
const eq = vi.fn().mockReturnValue({ not });
const select = vi.fn().mockReturnValue({ eq });
const from = vi.fn().mockReturnValue({ select });

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from,
  }),
}));

const { getLastCompletedLog } = await import("./queries");

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
