import { describe, expect, it, vi } from "vitest";
import { emailConfigFromEnv, sendEmails, type OutgoingEmail } from "./send";

const config = { apiKey: "test-key", from: "Gym Journal <hello@example.test>" };
const email = (to: string): OutgoingEmail => ({ to, subject: "s", html: "h", text: "t" });

describe("emailConfigFromEnv", () => {
  it("needs both settings", () => {
    expect(emailConfigFromEnv({ RESEND_API_KEY: "k", EMAIL_FROM: "f" })).toEqual({ apiKey: "k", from: "f" });
    expect(emailConfigFromEnv({ RESEND_API_KEY: "k" })).toBeNull();
    expect(emailConfigFromEnv({ EMAIL_FROM: "f" })).toBeNull();
  });
});

describe("sendEmails", () => {
  it("sends with the sender on each email, 100 at a time", async () => {
    const send = vi.fn(async () => new Response("{}", { status: 200 }));
    await sendEmails(Array.from({ length: 101 }, (_, i) => email(`p${i}@example.test`)), config, send as typeof fetch);
    expect(send).toHaveBeenCalledTimes(2);
    const [url, init] = send.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails/batch");
    const body = JSON.parse(init.body as string);
    expect(body).toHaveLength(100);
    expect(body[0]).toMatchObject({ to: "p0@example.test", from: config.from, subject: "s" });
  });

  it("carries on, without throwing or logging addresses, when sending fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const send = vi.fn(async () => new Response("{}", { status: 429 }));
    await expect(sendEmails([email("private@example.test")], config, send as typeof fetch)).resolves.toBeUndefined();
    expect(log.mock.calls.join(" ")).toContain("429");
    expect(log.mock.calls.join(" ")).not.toContain("private@example.test");
    send.mockRejectedValueOnce(new Error("network"));
    await expect(sendEmails([email("a@example.test")], config, send as typeof fetch)).resolves.toBeUndefined();
    log.mockRestore();
  });
});
