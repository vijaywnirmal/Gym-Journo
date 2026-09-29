import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const getUser = vi.fn();
const rpc = vi.fn();
const updateEq = vi.fn();
const deleteEq = vi.fn();
const from = vi.fn(() => ({
  update: (values: unknown) => ({ eq: (...args: unknown[]) => updateEq(values, ...args) }),
  delete: () => ({ eq: (...args: unknown[]) => deleteEq(...args) }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser }, rpc, from }) }));

const { savePushSubscription, removePushSubscription, updateReminderSettings } = await import("./reminderActions");

const subscription = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc",
  keys: { p256dh: "BNcR", auth: "tBHI" },
};

beforeEach(() => {
  getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  rpc.mockReset();
  rpc.mockResolvedValue({ error: null });
  updateEq.mockReset();
  updateEq.mockReturnValue({ select: async () => ({ data: [{ id: "user-1" }], error: null }) });
  deleteEq.mockReset();
  deleteEq.mockResolvedValue({ error: null });
});

describe("savePushSubscription", () => {
  it("registers a valid subscription through the database function", async () => {
    expect(await savePushSubscription(subscription, "Test browser")).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("register_push_subscription", {
      p_endpoint: subscription.endpoint,
      p_p256dh: "BNcR",
      p_auth: "tBHI",
      p_user_agent: "Test browser",
    });
  });

  it("rejects non-https endpoints and malformed subscriptions", async () => {
    expect(await savePushSubscription({ ...subscription, endpoint: "http://insecure.test/x" }, "")).toHaveProperty("error");
    expect(await savePushSubscription({ endpoint: subscription.endpoint }, "")).toHaveProperty("error");
    expect(await savePushSubscription("nope", "")).toHaveProperty("error");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("requires a signed-in person", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await savePushSubscription(subscription, "")).toEqual({ error: "Not signed in" });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("removePushSubscription", () => {
  it("deletes this device's row (row-level security limits it to the person's own)", async () => {
    expect(await removePushSubscription(subscription.endpoint)).toEqual({ success: true });
    expect(deleteEq).toHaveBeenCalledWith("endpoint", subscription.endpoint);
  });
});

describe("updateReminderSettings", () => {
  it("saves on/off and a 24h HH:MM time", async () => {
    expect(await updateReminderSettings({ enabled: true, time: "07:30" })).toEqual({ success: true });
    expect(updateEq).toHaveBeenCalledWith({ workout_reminders: true, reminder_time: "07:30" }, "id", "user-1");
  });

  it("rejects times that aren't HH:MM", async () => {
    for (const time of ["7:30", "24:00", "12:60", "noon", ""]) {
      expect(await updateReminderSettings({ enabled: true, time })).toEqual({ error: "Choose a valid reminder time." });
    }
    expect(updateEq).not.toHaveBeenCalled();
  });

  it("reports a failed save", async () => {
    updateEq.mockReturnValue({ select: async () => ({ data: [], error: null }) });
    expect(await updateReminderSettings({ enabled: false, time: "18:00" })).toHaveProperty("error");
  });
});
