import { describe, expect, it } from "vitest";
import { isWorkAccount, workHome } from "./workAccount";

describe("work accounts", () => {
  it("are trainers and people who run a gym", () => {
    expect(isWorkAccount({ trainer: false, gym: false })).toBe(false);
    expect(isWorkAccount({ trainer: true, gym: false })).toBe(true);
    expect(isWorkAccount({ trainer: false, gym: true })).toBe(true);
  });

  it("land on the trainer's Today, else the gym's dashboard", () => {
    expect(workHome({ trainer: true, gym: false })).toBe("/trainer");
    expect(workHome({ trainer: true, gym: true })).toBe("/trainer");
    expect(workHome({ trainer: false, gym: true })).toBe("/gym");
  });
});
