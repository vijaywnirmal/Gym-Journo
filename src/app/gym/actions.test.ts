import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const afterCallbacks: (() => Promise<void>)[] = [];
vi.mock("next/server", () => ({ after: (fn: () => Promise<void>) => afterCallbacks.push(fn) }));
const runAfter = async () => {
  for (const fn of afterCallbacks.splice(0)) await fn();
};
const notifyUser = vi.fn();
vi.mock("@/lib/push/notifyUser", () => ({ notifyUser: (...args: unknown[]) => notifyUser(...args) }));
vi.mock("@/lib/gyms", () => ({
  getAdminGym: async () => ({ id: "gym-1", name: "Iron Gym" }),
  getGymTrainers: async () => [{ trainer_id: "t-1", display_name: "Ravi" }],
}));

const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));

const { suggestTrainer, unassignTrainer, removeMember, removeStaff } = await import("./actions");

describe("gym actions", () => {
  beforeEach(() => {
    rpc.mockReset();
    notifyUser.mockClear();
    afterCallbacks.length = 0;
  });

  it("suggests a trainer and tells the member who", async () => {
    rpc.mockResolvedValue({ data: { id: "offer-1" }, error: null });
    expect(await suggestTrainer("gym-1", "m-1", "t-1")).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("offer_gym_trainer", { p_gym_id: "gym-1", p_member_id: "m-1", p_trainer_id: "t-1" });
    await runAfter();
    expect(notifyUser).toHaveBeenCalledWith("m-1", expect.objectContaining({ title: "Iron Gym suggests Ravi as your trainer", url: "/profile" }));
  });

  it("doesn't notify when the member already trains with that trainer", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await suggestTrainer("gym-1", "m-1", "t-1")).toEqual({ success: true });
    await runAfter();
    expect(notifyUser).not.toHaveBeenCalled();
  });

  it("explains the database's refusals", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "This member has their own trainer" } });
    expect((await suggestTrainer("gym-1", "m-1", "t-1")).error).toBe("This member has their own trainer.");
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Not an admin of this gym" } });
    expect((await unassignTrainer("gym-1", "m-1")).error).toBe("You no longer run this gym.");
    rpc.mockResolvedValue({ data: null, error: { message: "connection reset" } });
    expect((await removeMember("gym-1", "m-1")).error).toBe("Couldn't remove the member. Please try again.");
    await runAfter();
    expect(notifyUser).not.toHaveBeenCalled();
  });

  it("removes staff by role, and only those roles", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await removeStaff("gym-1", "t-1", "trainer")).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("end_gym_staff", { p_gym_id: "gym-1", p_user_id: "t-1", p_role: "trainer" });
    rpc.mockClear();
    expect((await removeStaff("gym-1", "t-1", "member" as "trainer")).error).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
  });
});
