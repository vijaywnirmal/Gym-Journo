import { describe, expect, it, vi, beforeEach } from "vitest";

const deliver = vi.fn();
vi.mock("./send", () => ({
  pushConfigFromEnv: () => ({ publicKey: "pub", privateKey: "priv", subject: "mailto:x@example.test" }),
  webPushTransport: () => vi.fn(),
  deliver: (...args: unknown[]) => deliver(...args),
}));

// The service role bypasses row-level security, so these filters are what pick the recipient:
// every query records the filters it was given.
const filters: string[] = [];
let remindersOn = true;
let subscriptions: unknown[] = [];
const admin = {
  from: (table: string) => ({
    select: () => ({
      eq: (column: string, value: string) => {
        filters.push(`${table}.select ${column}=${value}`);
        if (table === "profiles") return { maybeSingle: async () => ({ data: { workout_reminders: remindersOn }, error: null }) };
        return Promise.resolve({ data: subscriptions, error: null });
      },
    }),
    delete: () => ({
      eq: (column: string, value: string) => ({
        in: async (_c: string, endpoints: string[]) => {
          filters.push(`${table}.delete ${column}=${value} ${endpoints.join(",")}`);
          return { error: null };
        },
      }),
    }),
  }),
};
let adminClient: typeof admin | null = admin;
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => adminClient }));

const { notifyUser } = await import("./notifyUser");
const payload = { title: "t", body: "b", url: "/", tag: "trainer-plan" };
const device = (endpoint: string) => ({ endpoint, p256dh: "k", auth: "a" });

describe("notifyUser", () => {
  beforeEach(() => {
    deliver.mockReset();
    filters.length = 0;
    adminClient = admin;
    remindersOn = true;
    subscriptions = [];
  });

  it("sends only to that person's devices and forgets only their dead ones", async () => {
    subscriptions = [device("e1"), device("e2")];
    deliver.mockResolvedValue({ delivered: 1, expired: ["e2"], failed: 0 });
    await notifyUser("c1", payload);
    expect(deliver).toHaveBeenCalledWith([device("e1"), device("e2")], payload, expect.anything());
    expect(filters).toEqual([
      "profiles.select id=c1",
      "push_subscriptions.select user_id=c1",
      "push_subscriptions.delete user_id=c1 e2",
    ]);
  });

  it("sends nothing while their notifications are off, even to devices still subscribed", async () => {
    remindersOn = false;
    subscriptions = [device("e1")];
    await notifyUser("c1", payload);
    expect(deliver).not.toHaveBeenCalled();
  });

  it("does nothing without devices or a service role, and never throws", async () => {
    await notifyUser("c1", payload);
    expect(deliver).not.toHaveBeenCalled();

    adminClient = null;
    await notifyUser("c1", payload);
    expect(deliver).not.toHaveBeenCalled();

    adminClient = admin;
    subscriptions = [device("e1")];
    deliver.mockRejectedValue(new Error("push service down"));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(notifyUser("c1", payload)).resolves.toBeUndefined();
    quiet.mockRestore();
  });
});
