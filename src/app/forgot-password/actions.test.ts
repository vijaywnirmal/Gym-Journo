import { describe, expect, it, vi, beforeEach } from "vitest";

const { resetMock } = vi.hoisted(() => ({ resetMock: vi.fn() }));

vi.mock("next/headers", () => ({
  headers: async () => new Map([["origin", "http://localhost:3000"]]),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { resetPasswordForEmail: resetMock } }),
}));

import { requestPasswordReset } from "./actions";

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  resetMock.mockReset();
  resetMock.mockResolvedValue({ error: null });
});

describe("requestPasswordReset", () => {
  it("rejects an invalid email before calling Supabase", async () => {
    const result = await requestPasswordReset(null, formData({ email: "nope" }));
    expect(result).toHaveProperty("error");
    expect(resetMock).not.toHaveBeenCalled();
  });

  it("returns generic success for a registered-looking email", async () => {
    const result = await requestPasswordReset(null, formData({ email: "real@user.com" }));
    expect(result).toEqual({ success: true });
  });

  it("returns the SAME generic success even when Supabase reports an error (no enumeration)", async () => {
    resetMock.mockResolvedValue({ error: { message: "User not found" } });
    const result = await requestPasswordReset(null, formData({ email: "nobody@user.com" }));
    expect(result).toEqual({ success: true });
  });

  it("redirects into /auth/callback with next=/reset-password", async () => {
    await requestPasswordReset(null, formData({ email: "real@user.com" }));
    expect(resetMock).toHaveBeenCalledWith(
      "real@user.com",
      expect.objectContaining({
        redirectTo: "http://localhost:3000/auth/callback?next=/reset-password",
      })
    );
  });
});
