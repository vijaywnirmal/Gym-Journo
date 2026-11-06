import { describe, expect, it } from "vitest";
import { placeOf, toInvitePreview } from "./invitePreview";

const row = { state: "open", role: null, name: null, gym_name: null, city: null, area: null };

describe("toInvitePreview", () => {
  it("reads a trainer's link", () => {
    expect(toInvitePreview("trainer", { ...row, role: "trainer", name: "Ravi", gym_name: "Iron House", city: "Pune" })).toEqual({
      state: "open",
      kind: "trainer",
      name: "Ravi",
      gymName: "Iron House",
      city: "Pune",
    });
  });

  it("reads a gym's link with its role", () => {
    expect(toInvitePreview("gym", { ...row, role: "trainer", name: "Iron House", city: "Pune", area: "Baner" })).toEqual({
      state: "open",
      kind: "gym",
      role: "trainer",
      name: "Iron House",
      city: "Pune",
      area: "Baner",
    });
    expect(toInvitePreview("gym", { ...row, role: "member", name: "Iron House" })).toMatchObject({ role: "member" });
  });

  it("passes on dead links without details", () => {
    expect(toInvitePreview("trainer", { ...row, state: "expired" })).toEqual({ state: "expired" });
    expect(toInvitePreview("gym", { ...row, state: "not_found" })).toEqual({ state: "not_found" });
  });

  it("gives up on anything it doesn't recognise", () => {
    expect(toInvitePreview("trainer", undefined)).toBeNull();
    expect(toInvitePreview("trainer", { ...row, state: "open" })).toBeNull();
    expect(toInvitePreview("trainer", { ...row, state: "weird", name: "x" })).toBeNull();
  });
});

describe("placeOf", () => {
  it("joins what's there", () => {
    expect(placeOf("Baner", "Pune")).toBe("Baner, Pune");
    expect(placeOf(null, "Pune")).toBe("Pune");
    expect(placeOf(null, " ")).toBeNull();
  });
});
