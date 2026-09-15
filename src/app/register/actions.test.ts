import { describe, expect, it, vi, beforeEach } from "vitest";

const { signUpMock } = vi.hoisted(() => ({ signUpMock: vi.fn() }));

vi.mock("next/headers", () => ({
  headers: async () => new Map([["origin", "http://localhost:3000"]]),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signUp: signUpMock } }),
}));

import { registerWithPassword } from "./actions";

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  signUpMock.mockReset();
});

describe("registerWithPassword", () => {
  it("rejects an invalid email before calling Supabase", async () => {
    const result = await registerWithPassword(
      null,
      formData({ email: "not-an-email", password: "longenough12", confirmPassword: "longenough12" })
    );
    expect(result).toHaveProperty("error");
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("rejects mismatched passwords before calling Supabase", async () => {
    const result = await registerWithPassword(
      null,
      formData({ email: "a@b.com", password: "longenough12", confirmPassword: "different123" })
    );
    expect(result).toEqual({ error: "Passwords don't match." });
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("surfaces a Supabase error verbatim", async () => {
    signUpMock.mockResolvedValue({ data: { session: null }, error: { message: "User already registered" } });
    const result = await registerWithPassword(
      null,
      formData({ email: "a@b.com", password: "longenough12", confirmPassword: "longenough12" })
    );
    expect(result).toEqual({ error: "User already registered" });
  });

  it("reports needsEmailConfirmation=true when signUp returns no session", async () => {
    signUpMock.mockResolvedValue({ data: { session: null, user: { id: "u1" } }, error: null });
    const result = await registerWithPassword(
      null,
      formData({ email: "a@b.com", password: "longenough12", confirmPassword: "longenough12" })
    );
    expect(result).toEqual({ success: true, needsEmailConfirmation: true });
  });

  it("reports needsEmailConfirmation=false when signUp returns a session immediately", async () => {
    signUpMock.mockResolvedValue({
      data: { session: { access_token: "t" }, user: { id: "u1" } },
      error: null,
    });
    const result = await registerWithPassword(
      null,
      formData({ email: "a@b.com", password: "longenough12", confirmPassword: "longenough12" })
    );
    expect(result).toEqual({ success: true, needsEmailConfirmation: false });
  });

  it("passes the emailRedirectTo callback URL through to Supabase", async () => {
    signUpMock.mockResolvedValue({ data: { session: null }, error: null });
    await registerWithPassword(
      null,
      formData({ email: "a@b.com", password: "longenough12", confirmPassword: "longenough12" })
    );
    expect(signUpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "a@b.com",
        password: "longenough12",
        options: { emailRedirectTo: "http://localhost:3000/auth/callback" },
      })
    );
  });
});
