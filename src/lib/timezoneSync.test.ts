import { describe, expect, it } from "vitest";
import { isDefinitiveOutcome, shouldSyncTimeZone } from "./timezoneSync";

describe("shouldSyncTimeZone", () => {
  const base = {
    stored: null as string | null,
    browser: "Asia/Kolkata" as string | null,
    attemptedThisSession: null as string | null,
  };

  it("syncs when nothing is stored yet", () => {
    expect(shouldSyncTimeZone(base)).toBe(true);
  });

  it("syncs when the device timezone differs from the stored one (travel, new device)", () => {
    expect(shouldSyncTimeZone({ ...base, stored: "America/New_York" })).toBe(true);
  });

  it("does nothing when they already match", () => {
    expect(shouldSyncTimeZone({ ...base, stored: "Asia/Kolkata" })).toBe(false);
  });

  it("does nothing when the device reports no timezone", () => {
    expect(shouldSyncTimeZone({ ...base, browser: null })).toBe(false);
  });

  it("does not retry the same timezone in one session, but does for a new one", () => {
    expect(shouldSyncTimeZone({ ...base, attemptedThisSession: "Asia/Kolkata" })).toBe(false);
    expect(shouldSyncTimeZone({ ...base, attemptedThisSession: "America/New_York" })).toBe(true);
  });
});

describe("isDefinitiveOutcome", () => {
  it("retries only when the profile row doesn't exist yet", () => {
    expect(isDefinitiveOutcome("updated")).toBe(true);
    expect(isDefinitiveOutcome("failed")).toBe(true);
    expect(isDefinitiveOutcome("no_profile")).toBe(false);
  });
});
