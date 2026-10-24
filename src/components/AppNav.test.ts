import { describe, expect, it } from "vitest";
import { activeTab, tabsFor } from "./AppNav";

const labels = (isTrainer: boolean, isGymAdmin: boolean) => tabsFor(isTrainer, isGymAdmin).map((t) => t.label);

describe("tabsFor", () => {
  it("gives members the journal and work accounts their own tabs", () => {
    expect(labels(false, false)).toEqual(["Today", "Calendar", "History", "Progress", "Exercises", "Profile"]);
    expect(labels(true, false)).toEqual(["Today", "Clients", "Plans", "Exercises", "Profile"]);
    expect(labels(false, true)).toEqual(["Dashboard", "Members", "Trainers", "Invite", "Profile"]);
    expect(labels(true, true)).toEqual(["Today", "Clients", "Plans", "Gym", "Profile"]);
  });
});

describe("activeTab", () => {
  it("picks the tab a page sits under, the most specific one first", () => {
    const trainer = tabsFor(true, false);
    expect(activeTab("/trainer", trainer)).toBe("/trainer");
    expect(activeTab("/trainer/clients/abc/plan/2026-10-24", trainer)).toBe("/trainer/clients");
    expect(activeTab("/trainer/invite", trainer)).toBe("/trainer/clients");
    expect(activeTab("/trainer/plans", trainer)).toBe("/trainer/plans");
    const gym = tabsFor(false, true);
    expect(activeTab("/gym", gym)).toBe("/gym");
    expect(activeTab("/gym/members/abc", gym)).toBe("/gym/members");
    expect(activeTab("/gym/members/abc", tabsFor(true, true))).toBe("/gym");
    const member = tabsFor(false, false);
    expect(activeTab("/", member)).toBe("/");
    expect(activeTab("/log/2026-10-24", member)).toBe("/calendar");
    expect(activeTab("/g/abcdefgh23", member)).toBe("/profile");
  });
});
