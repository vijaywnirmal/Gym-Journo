import { describe, expect, it } from "vitest";
import { isOpenToSignedOut, isPublicPage } from "./publicPages";

describe("isPublicPage", () => {
  it("treats / as the public home page only when signed out", () => {
    expect(isPublicPage("/", false)).toBe(true);
    expect(isPublicPage("/", true)).toBe(false);
  });

  it("treats invite links as public welcome pages only when signed out", () => {
    expect(isPublicPage("/join/abcdef1234", false)).toBe(true);
    expect(isPublicPage("/g/abcdef1234", false)).toBe(true);
    expect(isPublicPage("/join/abcdef1234", true)).toBe(false);
    expect(isPublicPage("/g/abcdef1234", true)).toBe(false);
    expect(isPublicPage("/join/short", false)).toBe(false);
  });

  it("covers the trainer, gym and demo pages for everyone", () => {
    for (const signedIn of [true, false]) {
      expect(isPublicPage("/trainers", signedIn)).toBe(true);
      expect(isPublicPage("/gyms", signedIn)).toBe(true);
      expect(isPublicPage("/demo", signedIn)).toBe(true);
    }
  });

  it("doesn't catch the app's own trainer and gym screens", () => {
    expect(isPublicPage("/trainer", false)).toBe(false);
    expect(isPublicPage("/trainer/clients", false)).toBe(false);
    expect(isPublicPage("/gym", false)).toBe(false);
    expect(isPublicPage("/gym/members", false)).toBe(false);
    expect(isPublicPage("/gymsx", false)).toBe(false);
  });
});

describe("isOpenToSignedOut", () => {
  it("lets link-preview images through", () => {
    expect(isOpenToSignedOut("/opengraph-image")).toBe(true);
    expect(isOpenToSignedOut("/trainers/opengraph-image")).toBe(true);
    expect(isOpenToSignedOut("/twitter-image-abc123")).toBe(true);
  });

  it("keeps the app's pages behind sign-in", () => {
    expect(isOpenToSignedOut("/calendar")).toBe(false);
    expect(isOpenToSignedOut("/trainer")).toBe(false);
    expect(isOpenToSignedOut("/profile/opengraph")).toBe(false);
  });
});
