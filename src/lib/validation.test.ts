import { describe, expect, it } from "vitest";
import {
  isValidEmail,
  safeRedirectPath,
  validateDateOfBirth,
  validatePassword,
  MIN_PASSWORD_LENGTH,
} from "./validation";

describe("safeRedirectPath", () => {
  it("allows a normal relative path", () => {
    expect(safeRedirectPath("/schedule/2026-01-01")).toBe("/schedule/2026-01-01");
  });

  it("falls back for a missing value", () => {
    expect(safeRedirectPath(null)).toBe("/");
    expect(safeRedirectPath(undefined, "/login")).toBe("/login");
  });

  it("rejects protocol-relative URLs used for open redirects", () => {
    expect(safeRedirectPath("//evil.com")).toBe("/");
  });

  it("rejects absolute URLs to other origins", () => {
    expect(safeRedirectPath("https://evil.com")).toBe("/");
    expect(safeRedirectPath("http://evil.com/path")).toBe("/");
  });

  it("rejects paths not starting with a slash", () => {
    expect(safeRedirectPath("evil.com")).toBe("/");
  });

  it("rejects backslash-based redirect tricks", () => {
    expect(safeRedirectPath("/\\evil.com")).toBe("/");
  });
});

describe("isValidEmail", () => {
  it("accepts a normal email", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
  });

  it("rejects strings without an @ or domain", () => {
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("user@")).toBe(false);
    expect(isValidEmail("@example.com")).toBe(false);
  });
});

describe("validateDateOfBirth", () => {
  it("accepts a reasonable past date", () => {
    expect(validateDateOfBirth("1990-05-15")).toBeNull();
  });

  it("rejects an unparseable date", () => {
    expect(validateDateOfBirth("not-a-date")).not.toBeNull();
  });

  it("rejects a future date", () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    expect(validateDateOfBirth(future.toISOString().slice(0, 10))).not.toBeNull();
  });

  it("rejects an implausibly old date", () => {
    expect(validateDateOfBirth("1800-01-01")).not.toBeNull();
  });
});

describe("validatePassword", () => {
  it("rejects passwords shorter than the minimum length", () => {
    expect(validatePassword("a".repeat(MIN_PASSWORD_LENGTH - 1))).not.toBeNull();
  });

  it("accepts passwords at or above the minimum length", () => {
    expect(validatePassword("a".repeat(MIN_PASSWORD_LENGTH))).toBeNull();
  });
});
