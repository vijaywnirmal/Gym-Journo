import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));

const { stopTraining } = await import("./trainerActions");

describe("stopTraining", () => {
  beforeEach(() => rpc.mockReset());

  it("stops training clients through the database", async () => {
    rpc.mockResolvedValue({ data: 2, error: null });
    expect(await stopTraining()).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("stop_training");
  });

  it("returns a safe error", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Not a trainer" } });
    expect((await stopTraining()).error).toBe("Couldn't stop training clients. Please try again.");
  });
});
