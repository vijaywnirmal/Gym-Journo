import { describe, expect, it, vi, beforeEach } from "vitest";

const deliver = vi.fn();
vi.mock("./send", () => ({
  pushConfigFromEnv: () => ({ publicKey: "pub", privateKey: "priv", subject: "mailto:x@example.test" }),
  webPushTransport: () => vi.fn(),
  deliver: (...args: unknown[]) => deliver(...args),
}));

let subscriptions: { data: unknown; error: unknown } = { data: [], error: null };
const deleted: unknown[] = [];
const admin = {
  from: () => ({
    select: () => ({ eq: async () => subscriptions }),
    delete: () => ({ eq: () => ({ in: async (_c: string, endpoints: string[]) => (deleted.push(endpoints), { error: null }) }) }),
  }),
};
let adminClient: typeof admin | null = admin;
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => adminClient }));

const { notifyUser } = await import("./notifyUser");
const payload = { title: "t", body: "b", url: "/", tag: "trainer-plan" };

describe("notifyUser", () => {
  beforeEach(() => {
    deliver.mockReset();
    deleted.length = 0;
    adminClient = admin;
  });

  it("sends to the person's devices and forgets the ones that are gone", async () => {
    subscriptions = { data: [{ endpoint: "e1", p256dh: "k", auth: "a" }, { endpoint: "e2", p256dh: "k", auth: "a" }], error: null };
    deliver.mockResolvedValue({ delivered: 1, expired: ["e2"], failed: 0 });
    await notifyUser("c1", payload);
    expect(deliver).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ endpoint: "e1" })]), payload, expect.anything());
    expect(deleted).toEqual([["e2"]]);
  });

  it("does nothing without devices or a service role, and never throws", async () => {
    subscriptions = { data: [], error: null };
    await notifyUser("c1", payload);
    expect(deliver).not.toHaveBeenCalled();

    adminClient = null;
    await notifyUser("c1", payload);
    expect(deliver).not.toHaveBeenCalled();

    adminClient = admin;
    subscriptions = { data: [{ endpoint: "e1", p256dh: "k", auth: "a" }], error: null };
    deliver.mockRejectedValue(new Error("push service down"));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(notifyUser("c1", payload)).resolves.toBeUndefined();
    quiet.mockRestore();
  });
});
