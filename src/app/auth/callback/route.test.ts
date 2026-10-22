import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyOtp = vi.fn();
const exchangeCodeForSession = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { verifyOtp, exchangeCodeForSession } }),
}));

const { GET } = await import("./route");

const callback = (query: string) => GET(new Request(`https://gym.example.com/auth/callback?${query}`));
const location = (response: Response) => response.headers.get("location");

describe("auth callback", () => {
  beforeEach(() => {
    verifyOtp.mockReset().mockResolvedValue({ error: null });
    exchangeCodeForSession.mockReset().mockResolvedValue({ error: null });
  });

  it("verifies a token_hash link without needing the requesting browser's cookies", async () => {
    const response = await callback("token_hash=abc&type=email");
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "abc", type: "email" });
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(location(response)).toBe("https://gym.example.com/");
  });

  it("sends a password-reset link on to its next page", async () => {
    const response = await callback("token_hash=abc&type=recovery&next=/reset-password");
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "abc", type: "recovery" });
    expect(location(response)).toBe("https://gym.example.com/reset-password");
  });

  it("still accepts Supabase's default code links", async () => {
    const response = await callback("code=xyz");
    expect(exchangeCodeForSession).toHaveBeenCalledWith("xyz");
    expect(location(response)).toBe("https://gym.example.com/");
  });

  it("never redirects off-site through next", async () => {
    const response = await callback("token_hash=abc&type=email&next=//evil.example");
    expect(location(response)).toBe("https://gym.example.com/");
  });

  it("returns to login with an error when the link is expired, used or incomplete", async () => {
    verifyOtp.mockResolvedValue({ error: new Error("Email link is invalid or has expired") });
    expect(location(await callback("token_hash=abc&type=email"))).toBe(
      "https://gym.example.com/login?error=invalid_link",
    );

    exchangeCodeForSession.mockResolvedValue({ error: new Error("code verifier not found") });
    expect(location(await callback("code=xyz"))).toBe("https://gym.example.com/login?error=invalid_link");

    expect(location(await callback("token_hash=abc"))).toBe("https://gym.example.com/login?error=invalid_link");
  });
});
