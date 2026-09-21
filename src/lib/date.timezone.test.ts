import { describe, expect, it } from "vitest";
import { hourIn, isValidTimeZone, startOfDayIn, todayIn } from "./date";

// 2026-09-20 20:00 UTC — already 01:30 on Sep 21 in India, still Sep 20 in UTC and in New York.
const LATE_EVENING_UTC = new Date("2026-09-20T20:00:00Z");

describe("isValidTimeZone", () => {
  it("accepts IANA names", () => {
    expect(isValidTimeZone("Asia/Kolkata")).toBe(true);
    expect(isValidTimeZone("America/New_York")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
  });

  it("rejects junk", () => {
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone("   ")).toBe(false);
    expect(isValidTimeZone("Mars/Olympus_Mons")).toBe(false);
    expect(isValidTimeZone("not a zone")).toBe(false);
  });
});

describe("todayIn", () => {
  it("gives each timezone its own calendar date for the same instant", () => {
    expect(todayIn("Asia/Kolkata", LATE_EVENING_UTC)).toBe("2026-09-21");
    expect(todayIn("UTC", LATE_EVENING_UTC)).toBe("2026-09-20");
    expect(todayIn("America/New_York", LATE_EVENING_UTC)).toBe("2026-09-20");
    expect(todayIn("Pacific/Auckland", LATE_EVENING_UTC)).toBe("2026-09-21");
  });

  it("rolls over at the person's midnight, not the server's", () => {
    expect(todayIn("Asia/Kolkata", new Date("2026-09-20T18:29:59Z"))).toBe("2026-09-20"); // 23:59:59 IST
    expect(todayIn("Asia/Kolkata", new Date("2026-09-20T18:30:00Z"))).toBe("2026-09-21"); // 00:00:00 IST
  });

  it("handles the year boundary", () => {
    expect(todayIn("Asia/Kolkata", new Date("2026-12-31T19:00:00Z"))).toBe("2027-01-01");
    expect(todayIn("America/Los_Angeles", new Date("2027-01-01T05:00:00Z"))).toBe("2026-12-31");
  });

  it("falls back to the server's local date for a missing or invalid timezone, without throwing", () => {
    const local = todayIn(undefined, LATE_EVENING_UTC);
    expect(todayIn(null, LATE_EVENING_UTC)).toBe(local);
    expect(todayIn("Mars/Olympus_Mons", LATE_EVENING_UTC)).toBe(local);
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("hourIn", () => {
  it("is the hour on the person's clock", () => {
    expect(hourIn("Asia/Kolkata", LATE_EVENING_UTC)).toBe(1);
    expect(hourIn("UTC", LATE_EVENING_UTC)).toBe(20);
    expect(hourIn("America/New_York", LATE_EVENING_UTC)).toBe(16);
  });

  it("reads midnight as 0, not 24", () => {
    expect(hourIn("Asia/Kolkata", new Date("2026-09-20T18:30:00Z"))).toBe(0);
  });
});

describe("startOfDayIn", () => {
  it("is local midnight as an instant", () => {
    expect(startOfDayIn("2026-09-21", "Asia/Kolkata").toISOString()).toBe("2026-09-20T18:30:00.000Z");
    expect(startOfDayIn("2026-09-21", "UTC").toISOString()).toBe("2026-09-21T00:00:00.000Z");
    expect(startOfDayIn("2026-09-21", "America/New_York").toISOString()).toBe("2026-09-21T04:00:00.000Z");
  });

  it("is consistent with todayIn: the start of today is today, and one millisecond earlier is yesterday", () => {
    for (const tz of ["Asia/Kolkata", "America/New_York", "Pacific/Auckland", "UTC"]) {
      const start = startOfDayIn("2026-09-21", tz);
      expect(todayIn(tz, start)).toBe("2026-09-21");
      expect(todayIn(tz, new Date(start.getTime() - 1))).toBe("2026-09-20");
    }
  });

  it("accounts for a daylight-saving change on the day itself", () => {
    // US clocks spring forward on 2026-03-08 (midnight is still UTC-5) and fall back on 2026-11-01
    // (midnight is still UTC-4), so those days are 23 and 25 hours long.
    expect(startOfDayIn("2026-03-08", "America/New_York").toISOString()).toBe("2026-03-08T05:00:00.000Z");
    expect(startOfDayIn("2026-03-09", "America/New_York").toISOString()).toBe("2026-03-09T04:00:00.000Z");
    expect(startOfDayIn("2026-11-01", "America/New_York").toISOString()).toBe("2026-11-01T04:00:00.000Z");
    expect(startOfDayIn("2026-11-02", "America/New_York").toISOString()).toBe("2026-11-02T05:00:00.000Z");
  });

  it("accounts for a DST change east of UTC, where the UTC-midnight guess lands on the wrong side of it", () => {
    // Sydney springs forward at 02:00 local on 2026-10-04, so local midnight that day is still UTC+10
    // (Oct 3, 14:00Z) even though UTC midnight of Oct 4 is already UTC+11. It falls back on 2027-04-04.
    expect(startOfDayIn("2026-10-04", "Australia/Sydney").toISOString()).toBe("2026-10-03T14:00:00.000Z");
    expect(startOfDayIn("2026-10-05", "Australia/Sydney").toISOString()).toBe("2026-10-04T13:00:00.000Z");
    expect(startOfDayIn("2027-04-04", "Australia/Sydney").toISOString()).toBe("2027-04-03T13:00:00.000Z");
    expect(startOfDayIn("2027-04-05", "Australia/Sydney").toISOString()).toBe("2027-04-04T14:00:00.000Z");
  });

  it("falls back to the server's local midnight for a missing or invalid timezone", () => {
    const start = startOfDayIn("2026-09-21", null);
    expect(start.getHours()).toBe(0);
    expect(start.getDate()).toBe(21);
    expect(startOfDayIn("2026-09-21", "Mars/Olympus_Mons").getTime()).toBe(start.getTime());
  });
});
