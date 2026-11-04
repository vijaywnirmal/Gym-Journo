import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));

const afterCallbacks: (() => Promise<void>)[] = [];
vi.mock("next/server", () => ({ after: (fn: () => Promise<void>) => afterCallbacks.push(fn) }));
const runAfter = async () => {
  for (const fn of afterCallbacks.splice(0)) await fn();
};
const tellPeople = vi.fn();
vi.mock("@/lib/tellPeople", () => ({ tellPeople: (...args: unknown[]) => tellPeople(...args) }));
vi.mock("@/lib/trainers", () => ({
  getMyActiveClientIds: async () => ["c1", "c2"],
  getMyTrainerProfile: async () => ({ display_name: "Ravi" }),
}));

const { stopTraining } = await import("./trainerActions");

describe("stopTraining", () => {
  beforeEach(() => {
    rpc.mockReset();
    tellPeople.mockClear();
    afterCallbacks.length = 0;
  });

  it("stops training clients through the database", async () => {
    rpc.mockResolvedValue({ data: 2, error: null });
    expect(await stopTraining()).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("stop_training");
    await runAfter();
    expect(tellPeople).toHaveBeenCalledWith(["c1", "c2"], expect.objectContaining({ title: "Ravi is no longer your trainer" }));
  });

  it("returns a safe error", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Not a trainer" } });
    expect((await stopTraining()).error).toBe("Couldn't stop training clients. Please try again.");
    await runAfter();
    expect(tellPeople).not.toHaveBeenCalled();
  });
});
