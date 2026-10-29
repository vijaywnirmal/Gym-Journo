import { describe, expect, it } from "vitest";
import { friendlyAuthError, GENERIC_AUTH_ERROR } from "./authErrors";

describe("friendlyAuthError", () => {
  it("explains a wrong email or password in the app's words", () => {
    expect(friendlyAuthError({ code: "invalid_credentials", message: "Invalid login credentials" })).toBe(
      "That email and password don't match. Check them, or reset your password."
    );
  });

  it("explains rate limits and password rules", () => {
    expect(friendlyAuthError({ code: "over_email_send_rate_limit" })).toMatch(/Wait a few minutes/);
    expect(friendlyAuthError({ code: "same_password" })).toMatch(/different from your current one/);
  });

  it("never shows Supabase's own message for anything else", () => {
    expect(friendlyAuthError({ code: "unexpected_failure", message: "Database error saving new user" })).toBe(GENERIC_AUTH_ERROR);
    expect(friendlyAuthError({ message: "fetch failed" })).toBe(GENERIC_AUTH_ERROR);
  });
});
