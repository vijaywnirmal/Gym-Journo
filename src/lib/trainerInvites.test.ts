import { describe, expect, it } from "vitest";
import {
  inviteUrl,
  joinCodeOf,
  normalizeWhatsapp,
  pendingRedirect,
  whatsappChatUrl,
  whatsappShareUrl,
} from "./trainerInvites";

describe("joinCodeOf", () => {
  it("reads a 10-character code from a join path, lowercased", () => {
    expect(joinCodeOf("/join/abcde23456")).toBe("abcde23456");
    expect(joinCodeOf("/join/ABCDE23456/")).toBe("abcde23456");
  });

  it("ignores anything else", () => {
    expect(joinCodeOf("/join/short")).toBeNull();
    expect(joinCodeOf("/join/abcde23456/extra")).toBeNull();
    expect(joinCodeOf("/join/abcde2345%")).toBeNull();
    expect(joinCodeOf("/profile")).toBeNull();
  });
});

describe("normalizeWhatsapp", () => {
  it("adds +91 to a bare 10-digit Indian number", () => {
    expect(normalizeWhatsapp("98765 43210")).toBe("+919876543210");
    expect(normalizeWhatsapp("(987) 654-3210")).toBe("+919876543210");
  });

  it("keeps an international number with its +", () => {
    expect(normalizeWhatsapp("+91-98765-43210")).toBe("+919876543210");
    expect(normalizeWhatsapp("+44 7700 900123")).toBe("+447700900123");
    expect(normalizeWhatsapp("919876543210")).toBe("+919876543210");
  });

  it("is null when blank and invalid when it isn't a phone number", () => {
    expect(normalizeWhatsapp("  ")).toBeNull();
    expect(normalizeWhatsapp("12345")).toBe("invalid");
    expect(normalizeWhatsapp("call me")).toBe("invalid");
    expect(normalizeWhatsapp("+1234567890123456")).toBe("invalid");
  });
});

describe("links", () => {
  it("builds the invite and WhatsApp links", () => {
    expect(inviteUrl("https://www.gymjourno.fit/", "abcde23456")).toBe("https://www.gymjourno.fit/join/abcde23456");
    expect(whatsappShareUrl("Join me: https://x.test/join/a")).toBe("https://wa.me/?text=Join%20me%3A%20https%3A%2F%2Fx.test%2Fjoin%2Fa");
    expect(whatsappChatUrl("+919876543210")).toBe("https://wa.me/919876543210");
  });
});

describe("pendingRedirect", () => {
  it("sends someone back to their invite, then to trainer setup, from the home page only", () => {
    expect(pendingRedirect({ pathname: "/", joinCookie: "abcde23456", signupCookie: "trainer" })).toBe("/join/abcde23456");
    expect(pendingRedirect({ pathname: "/", joinCookie: undefined, signupCookie: "trainer" })).toBe("/trainer/setup");
    expect(pendingRedirect({ pathname: "/calendar", joinCookie: "abcde23456", signupCookie: undefined })).toBeNull();
    expect(pendingRedirect({ pathname: "/", joinCookie: undefined, signupCookie: undefined })).toBeNull();
  });

  it("never redirects to a malformed code", () => {
    expect(pendingRedirect({ pathname: "/", joinCookie: "//evil.test", signupCookie: undefined })).toBeNull();
  });
});
