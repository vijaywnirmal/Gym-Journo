import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePath(p) }));

const getUser = vi.fn();
let updateResult: { data: unknown; error: unknown } = { data: [{ id: "user-1" }], error: null };
const updateCalls: { values: unknown; eqs: unknown[][] }[] = [];
const deleteOrder: string[] = [];

const from = vi.fn((table: string) => ({
  update: (values: unknown) => {
    const call = { values, eqs: [] as unknown[][] };
    updateCalls.push(call);
    const builder = {
      eq: (...args: unknown[]) => (call.eqs.push(args), builder),
      select: () => Promise.resolve(updateResult),
    };
    return builder;
  },
  delete: () => ({
    eq: () => {
      deleteOrder.push(table);
      return Promise.resolve({ error: null });
    },
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser, signOut: vi.fn().mockResolvedValue({ error: null }) },
    from,
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => null }));

const { setCoachConsent, deleteAccount } = await import("./actions");

beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "user-1" } } });
  updateResult = { data: [{ id: "user-1" }], error: null };
  updateCalls.length = 0;
  deleteOrder.length = 0;
  revalidatePath.mockClear();
});

describe("setCoachConsent", () => {
  it("records consent as a timestamp on the person's own profile row", async () => {
    const before = Date.now();
    expect(await setCoachConsent(true)).toEqual({ success: true });
    expect(updateCalls).toHaveLength(1);
    const { coach_consent_at } = updateCalls[0].values as { coach_consent_at: string };
    expect(Date.parse(coach_consent_at)).toBeGreaterThanOrEqual(before - 1000);
    expect(updateCalls[0].eqs).toEqual([["id", "user-1"]]);
    expect(revalidatePath).toHaveBeenCalledWith("/profile");
    expect(revalidatePath).toHaveBeenCalledWith("/coach");
  });

  it("withdrawing sets it back to null", async () => {
    expect(await setCoachConsent(false)).toEqual({ success: true });
    expect(updateCalls[0].values).toEqual({ coach_consent_at: null });
  });

  it("requires a signed-in user", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await setCoachConsent(true)).toEqual({ error: "Not signed in" });
    expect(updateCalls).toHaveLength(0);
  });

  it("reports failure when the update errors (e.g. the column doesn't exist yet), without leaking the database message", async () => {
    updateResult = { data: null, error: { message: 'column "coach_consent_at" does not exist' } };
    const result = await setCoachConsent(true);
    expect(result).toEqual({ error: "Couldn't update your Coach setting. Please try again." });
    expect(JSON.stringify(result)).not.toContain("column");
  });

  it("reports failure when no profile row was updated", async () => {
    updateResult = { data: [], error: null };
    expect(await setCoachConsent(true)).toHaveProperty("error");
  });
});

describe("deleteAccount removes Coach history", () => {
  it("deletes the person's coach_replies along with their other data", async () => {
    await deleteAccount();
    expect(deleteOrder).toContain("coach_replies");
    expect(deleteOrder).toContain("ai_plans");
  });
});
