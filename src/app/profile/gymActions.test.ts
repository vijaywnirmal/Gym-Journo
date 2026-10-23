import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/currentUser", () => ({ getCurrentUser: async () => ({ id: "me" }) }));
const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));

const { answerTrainerOffer, leaveGym, leaveGymStaff } = await import("./gymActions");

describe("gym actions on Profile", () => {
  beforeEach(() => rpc.mockReset());

  it("leaves as the signed-in person", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await leaveGym("gym-1")).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("end_gym_membership", { p_gym_id: "gym-1", p_user_id: "me" });
    expect(await leaveGymStaff("gym-1", "trainer")).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("end_gym_staff", { p_gym_id: "gym-1", p_user_id: "me", p_role: "trainer" });
  });

  it("answers an offer, and says when it's gone", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await answerTrainerOffer("offer-1", true)).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("respond_gym_trainer_offer", { p_offer_id: "offer-1", p_accept: true });
    rpc.mockResolvedValue({ data: false, error: null });
    expect((await answerTrainerOffer("offer-1", true)).error).toMatch(/own trainer/);
    rpc.mockResolvedValue({ data: null, error: { message: "This offer is no longer open" } });
    expect((await answerTrainerOffer("offer-1", false)).error).toBe("This suggestion is no longer open.");
  });
});
