import { describe, expect, it } from "vitest";
import { isDefinitiveOutcome, sameTimeZone, timeZoneAction } from "./timezoneSync";

describe("timeZoneAction", () => {
  const base = {
    stored: null as string | null,
    browser: "Asia/Kolkata" as string | null,
    attemptedThisSession: null as string | null,
    keptOnThisDevice: null as string | null,
  };

  it("stores the zone without asking when nothing is stored yet", () => {
    expect(timeZoneAction(base)).toBe("sync");
  });

  it("asks when the device is in a different zone than the account (travel, second device)", () => {
    expect(timeZoneAction({ ...base, stored: "America/New_York" })).toBe("ask");
  });

  it("does nothing when they match, including another name for the same zone", () => {
    expect(timeZoneAction({ ...base, stored: "Asia/Kolkata" })).toBe("none");
    expect(timeZoneAction({ ...base, stored: "Asia/Calcutta" })).toBe("none");
  });

  it("does nothing when the device reports no timezone", () => {
    expect(timeZoneAction({ ...base, browser: null })).toBe("none");
  });

  it("does not retry the same timezone in one session, but does for a new one", () => {
    expect(timeZoneAction({ ...base, attemptedThisSession: "Asia/Kolkata" })).toBe("none");
    expect(timeZoneAction({ ...base, attemptedThisSession: "America/New_York" })).toBe("sync");
  });

  it("stops asking on a device where the person kept the account's zone", () => {
    expect(timeZoneAction({ ...base, stored: "America/New_York", keptOnThisDevice: "Asia/Kolkata" })).toBe("none");
    expect(timeZoneAction({ ...base, stored: "America/New_York", keptOnThisDevice: "Europe/London" })).toBe("ask");
  });
});

describe("sameTimeZone", () => {
  it("treats aliases as one zone and different zones as different", () => {
    expect(sameTimeZone("Asia/Calcutta", "Asia/Kolkata")).toBe(true);
    expect(sameTimeZone("Asia/Kolkata", "Asia/Dhaka")).toBe(false);
    expect(sameTimeZone("Not/AZone", "Not/AZone")).toBe(true);
  });
});

describe("isDefinitiveOutcome", () => {
  it("retries only when the profile row doesn't exist yet", () => {
    expect(isDefinitiveOutcome("updated")).toBe(true);
    expect(isDefinitiveOutcome("failed")).toBe(true);
    expect(isDefinitiveOutcome("no_profile")).toBe(false);
  });
});
