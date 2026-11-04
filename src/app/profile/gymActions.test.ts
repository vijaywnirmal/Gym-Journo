import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/currentUser", () => ({ getCurrentUser: async () => ({ id: "me" }) }));
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
  getMyActiveClientIds: async (gymId?: string) => (gymId === "gym-1" ? ["c1", "c2"] : []),
  getMyTrainerProfile: async () => ({ display_name: "Ravi" }),
}));

const { answerTrainerOffer, leaveGym, leaveGymStaff } = await import("./gymActions");

describe("gym actions on Profile", () => {
  beforeEach(() => {
    rpc.mockReset();
    tellPeople.mockClear();
    afterCallbacks.length = 0;
  });

  it("leaves as the signed-in person", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await leaveGym("gym-1")).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("end_gym_membership", { p_gym_id: "gym-1", p_user_id: "me" });
    expect(await leaveGymStaff("gym-1", "trainer")).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("end_gym_staff", { p_gym_id: "gym-1", p_user_id: "me", p_role: "trainer" });
  });

  it("tells a leaving trainer's clients from that gym, but not when it failed", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await leaveGymStaff("gym-1", "trainer");
    await runAfter();
    expect(tellPeople).toHaveBeenCalledWith(["c1", "c2"], expect.objectContaining({ title: "Ravi is no longer your trainer" }));
    tellPeople.mockClear();
    await leaveGymStaff("gym-1", "admin");
    await runAfter();
    rpc.mockResolvedValue({ data: null, error: { message: "nope" } });
    await leaveGymStaff("gym-1", "trainer");
    await runAfter();
    expect(tellPeople).not.toHaveBeenCalled();
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
