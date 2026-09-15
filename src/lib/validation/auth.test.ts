import { describe, expect, it } from "vitest";
import { registerSchema, signInSchema, forgotPasswordSchema, resetPasswordSchema } from "./auth";

describe("registerSchema", () => {
  it("accepts a valid email + password", () => {
    const result = registerSchema.safeParse({ email: "a@b.com", password: "longenough" });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = registerSchema.safeParse({ email: "not-an-email", password: "longenough" });
    expect(result.success).toBe(false);
  });

  it("rejects a too-short password", () => {
    const result = registerSchema.safeParse({ email: "a@b.com", password: "short" });
    expect(result.success).toBe(false);
  });

  it("trims and lowercases-preserves email without mutating case", () => {
    const result = registerSchema.safeParse({ email: "  a@b.com  ", password: "longenough" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("a@b.com");
  });
});

describe("signInSchema", () => {
  it("requires a non-empty password but does not enforce length rules", () => {
    expect(signInSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true);
    expect(signInSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false);
  });
});

describe("forgotPasswordSchema", () => {
  it("requires a valid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "a@b.com" }).success).toBe(true);
    expect(forgotPasswordSchema.safeParse({ email: "" }).success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("enforces the same password strength rule as registration", () => {
    expect(resetPasswordSchema.safeParse({ password: "longenough" }).success).toBe(true);
    expect(resetPasswordSchema.safeParse({ password: "short" }).success).toBe(false);
  });
});
