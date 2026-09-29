import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";

const sendDueWorkoutReminders = vi.fn();
vi.mock("@/lib/push/reminders", () => ({ sendDueWorkoutReminders: (...args: unknown[]) => sendDueWorkoutReminders(...args) }));
const createAdminClient = vi.fn(() => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => createAdminClient() }));

const { POST } = await import("./route");

const SECRET = "a-long-random-cron-secret";
const call = (authorization?: string) =>
  POST(new Request("http://localhost/api/cron/reminders", { method: "POST", headers: authorization ? { authorization } : {} }));

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", SECRET);
  vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "pub");
  vi.stubEnv("VAPID_PRIVATE_KEY", "priv");
  vi.stubEnv("VAPID_SUBJECT", "mailto:a@b.c");
  sendDueWorkoutReminders.mockReset();
  sendDueWorkoutReminders.mockResolvedValue({ due: 2, notified: 2, expiredDevices: 0, failedDevices: 0 });
  createAdminClient.mockReturnValue({});
});
afterEach(() => vi.unstubAllEnvs());

describe("isAuthorizedCronRequest", () => {
  const request = (authorization?: string) =>
    new Request("http://localhost/", { headers: authorization ? { authorization } : {} });

  it("accepts only the exact bearer secret", () => {
    expect(isAuthorizedCronRequest(request(`Bearer ${SECRET}`), SECRET)).toBe(true);
    expect(isAuthorizedCronRequest(request(`Bearer ${SECRET}x`), SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(request(SECRET), SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(request("Bearer "), SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(request(), SECRET)).toBe(false);
  });

  it("rejects everything when no secret is configured", () => {
    expect(isAuthorizedCronRequest(request("Bearer "), undefined)).toBe(false);
    expect(isAuthorizedCronRequest(request("Bearer anything"), "")).toBe(false);
  });
});

describe("POST /api/cron/reminders", () => {
  it("is 401 without the right secret, and runs nothing", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
    expect(sendDueWorkoutReminders).not.toHaveBeenCalled();
  });

  it("is 503 when push or the service role isn't configured", async () => {
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    expect((await call(`Bearer ${SECRET}`)).status).toBe(503);
    vi.stubEnv("VAPID_PRIVATE_KEY", "priv");
    createAdminClient.mockReturnValue(null as never);
    expect((await call(`Bearer ${SECRET}`)).status).toBe(503);
    expect(sendDueWorkoutReminders).not.toHaveBeenCalled();
  });

  it("runs the job and returns its summary", async () => {
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ due: 2, notified: 2, expiredDevices: 0, failedDevices: 0 });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("is 500 when the job fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    sendDueWorkoutReminders.mockRejectedValue(new Error("db down"));
    expect((await call(`Bearer ${SECRET}`)).status).toBe(500);
  });
});
