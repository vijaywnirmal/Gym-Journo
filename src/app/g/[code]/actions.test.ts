import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));

const { acceptGymInvite } = await import("./actions");

describe("acceptGymInvite", () => {
  beforeEach(() => rpc.mockReset());

  it("joins, lowercased, and goes where the role belongs", async () => {
    rpc.mockResolvedValue({ data: "member", error: null });
    expect(await acceptGymInvite(" ABCDE23456 ")).toEqual({ next: "/profile" });
    expect(rpc).toHaveBeenCalledWith("accept_gym_invite", { p_code: "abcde23456" });
    rpc.mockResolvedValue({ data: "trainer", error: null });
    expect(await acceptGymInvite("abcde23456")).toEqual({ next: "/trainer" });
    rpc.mockResolvedValue({ data: "admin", error: null });
    expect(await acceptGymInvite("abcde23456")).toEqual({ next: "/gym" });
  });

  it("refuses a malformed code without calling the database", async () => {
    expect(await acceptGymInvite("nope")).toEqual({ error: expect.stringMatching(/doesn't work/) });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("explains the database's refusals", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "This invite link has expired or doesn't exist" } });
    expect(await acceptGymInvite("abcde23456")).toEqual({ error: expect.stringMatching(/expired/) });
    rpc.mockResolvedValue({ data: null, error: { message: "Set up your trainer account first" } });
    expect(await acceptGymInvite("abcde23456")).toEqual({ error: "Set up your trainer account first." });
    rpc.mockResolvedValue({ data: null, error: { message: "connection reset" } });
    expect(await acceptGymInvite("abcde23456")).toEqual({ error: "Couldn't join the gym. Please try again." });
  });
});
