import { describe, expect, it } from "vitest";
import { tabsFor } from "./AppNav";

const labels = (isTrainer: boolean, isGymAdmin: boolean, phone: boolean) =>
  tabsFor(isTrainer, isGymAdmin, phone).map((t) => t.label);

describe("tabsFor", () => {
  it("adds Gym and Clients after Calendar", () => {
    expect(labels(false, false, false)).toEqual(["Today", "Calendar", "History", "Progress", "Exercises", "Profile"]);
    expect(labels(true, true, false)).toEqual(["Today", "Calendar", "Gym", "Clients", "History", "Progress", "Exercises", "Profile"]);
  });

  it("keeps the phone bar to six tabs", () => {
    expect(labels(true, false, true)).toEqual(["Today", "Calendar", "Clients", "History", "Progress", "Profile"]);
    expect(labels(false, true, true)).toEqual(["Today", "Calendar", "Gym", "History", "Progress", "Profile"]);
    expect(labels(true, true, true)).toEqual(["Today", "Calendar", "Gym", "Clients", "Progress", "Profile"]);
  });
});
