import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));

const { acceptInvite } = await import("./actions");

describe("acceptInvite", () => {
  beforeEach(() => rpc.mockReset());

  it("accepts a code, lowercased", async () => {
    rpc.mockResolvedValue({ data: { id: "link-1" }, error: null });
    expect(await acceptInvite(" ABCDE23456 ")).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("accept_trainer_invite", { p_code: "abcde23456" });
  });

  it("refuses a malformed code without calling the database", async () => {
    expect((await acceptInvite("nope")).error).toMatch(/doesn't work/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("explains the database's refusals", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "This invite link has expired or doesn't exist" } });
    expect((await acceptInvite("abcde23456")).error).toMatch(/expired/);
    rpc.mockResolvedValue({ data: null, error: { message: "This is your own invite link" } });
    expect((await acceptInvite("abcde23456")).error).toBe("This is your own invite link.");
    rpc.mockResolvedValue({ data: null, error: { message: "connection reset" } });
    expect((await acceptInvite("abcde23456")).error).toBe("Couldn't accept the invite. Please try again.");
  });
});
