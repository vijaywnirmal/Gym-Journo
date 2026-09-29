import { describe, expect, it, vi } from "vitest";
import { WebPushError } from "web-push";
import { TEST_NOTIFICATION, workoutReminderPayload } from "./reminderMessage";
import { deliver, pushConfigFromEnv, type StoredSubscription } from "./send";
import { sendDueWorkoutReminders } from "./reminders";

const device = (n: number): StoredSubscription => ({ endpoint: `https://push.example.test/${n}`, p256dh: "k", auth: "a" });
const pushError = (status: number) => new WebPushError("push failed", status, {}, "", "");

describe("workoutReminderPayload", () => {
  it("names the planned workout, counts its exercises and opens today's log", () => {
    expect(workoutReminderPayload({ localDate: "2026-10-01", planTitle: "Push day", exerciseCount: 3 })).toEqual({
      title: "Push day is planned for today",
      body: "3 exercises. Tap to start when you're ready.",
      url: "/log/2026-10-01",
      tag: "workout-reminder-2026-10-01",
    });
  });

  it("works without a title or exercises", () => {
    const payload = workoutReminderPayload({ localDate: "2026-10-01", planTitle: "  ", exerciseCount: 0 });
    expect(payload.title).toBe("Workout is planned for today");
    expect(payload.body).toBe("Tap to start when you're ready.");
    expect(workoutReminderPayload({ localDate: "2026-10-01", planTitle: null, exerciseCount: 1 }).body).toBe(
      "1 exercise. Tap to start when you're ready."
    );
  });
});

describe("pushConfigFromEnv", () => {
  it("needs all three VAPID settings", () => {
    const env = { NEXT_PUBLIC_VAPID_PUBLIC_KEY: "pub", VAPID_PRIVATE_KEY: "priv", VAPID_SUBJECT: "mailto:a@b.c" };
    expect(pushConfigFromEnv(env)).toEqual({ publicKey: "pub", privateKey: "priv", subject: "mailto:a@b.c" });
    expect(pushConfigFromEnv({ ...env, VAPID_PRIVATE_KEY: undefined })).toBeNull();
    expect(pushConfigFromEnv({})).toBeNull();
  });
});

describe("deliver", () => {
  it("counts deliveries, marks 404/410 devices expired, and keeps going after failures", async () => {
    const transport = vi.fn(async (subscription: StoredSubscription) => {
      if (subscription.endpoint.endsWith("/2")) throw pushError(410);
      if (subscription.endpoint.endsWith("/3")) throw pushError(404);
      if (subscription.endpoint.endsWith("/4")) throw pushError(500);
      if (subscription.endpoint.endsWith("/5")) throw new Error("network down");
      return 201;
    });
    const result = await deliver([1, 2, 3, 4, 5].map(device), TEST_NOTIFICATION, transport);
    expect(transport).toHaveBeenCalledTimes(5);
    expect(result.delivered).toBe(1);
    expect(result.expired.sort()).toEqual([device(2).endpoint, device(3).endpoint]);
    expect(result.failed).toBe(2);
  });
});

// A stand-in for the service-role client covering exactly what the job calls.
function fakeAdmin(due: unknown[], devicesByUser: Record<string, StoredSubscription[]>) {
  const marked: { id: string; date: string }[] = [];
  const deleted: string[][] = [];
  const admin = {
    rpc: vi.fn(async () => ({ data: due, error: null })),
    from: vi.fn((table: string) => ({
      select: () => ({
        eq: async (_column: string, userId: string) => ({ data: devicesByUser[userId] ?? [], error: null }),
      }),
      delete: () => ({
        in: async (_column: string, endpoints: string[]) => {
          deleted.push(endpoints);
          return { error: null };
        },
      }),
      update: (values: { reminder_last_sent_on: string }) => ({
        eq: async (_column: string, id: string) => {
          if (table === "profiles") marked.push({ id, date: values.reminder_last_sent_on });
          return { error: null };
        },
      }),
    })),
  };
  return { admin: admin as never, marked, deleted };
}

describe("sendDueWorkoutReminders", () => {
  const due = (userId: string) => ({ user_id: userId, local_date: "2026-10-01", plan_title: "Push", exercise_count: 2 });

  it("sends the reminder to each device, drops expired ones, and records the day", async () => {
    const { admin, marked, deleted } = fakeAdmin([due("a")], { a: [device(1), device(2)] });
    const transport = vi.fn(async (subscription: StoredSubscription) => {
      if (subscription.endpoint.endsWith("/2")) throw pushError(410);
      return 201;
    });
    const now = new Date("2026-10-01T18:30:00Z");

    const summary = await sendDueWorkoutReminders(admin, transport, now);

    expect((admin as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc).toHaveBeenCalledWith("due_workout_reminders", {
      p_now: now.toISOString(),
    });
    expect(transport).toHaveBeenCalledWith(device(1), expect.objectContaining({ url: "/log/2026-10-01" }));
    expect(deleted).toEqual([[device(2).endpoint]]);
    expect(marked).toEqual([{ id: "a", date: "2026-10-01" }]);
    expect(summary).toEqual({ due: 1, notified: 1, expiredDevices: 1, failedDevices: 0 });
  });

  it("doesn't record the day when every delivery failed for a transient reason, so the next run retries", async () => {
    const { admin, marked } = fakeAdmin([due("a")], { a: [device(1)] });
    const summary = await sendDueWorkoutReminders(admin, async () => {
      throw pushError(503);
    });
    expect(marked).toEqual([]);
    expect(summary).toMatchObject({ notified: 0, failedDevices: 1 });
  });

  it("records the day when the only devices turned out to be gone", async () => {
    const { admin, marked } = fakeAdmin([due("a")], { a: [device(1)] });
    await sendDueWorkoutReminders(admin, async () => {
      throw pushError(410);
    });
    expect(marked).toEqual([{ id: "a", date: "2026-10-01" }]);
  });

  it("does nothing when nobody is due", async () => {
    const { admin, marked } = fakeAdmin([], {});
    const transport = vi.fn();
    expect(await sendDueWorkoutReminders(admin, transport)).toEqual({ due: 0, notified: 0, expiredDevices: 0, failedDevices: 0 });
    expect(transport).not.toHaveBeenCalled();
    expect(marked).toEqual([]);
  });

  it("throws when the due list can't be read", async () => {
    const admin = { rpc: async () => ({ data: null, error: { message: "boom" } }) } as never;
    await expect(sendDueWorkoutReminders(admin, vi.fn())).rejects.toThrow("due_workout_reminders failed");
  });
});
