import { describe, expect, it } from "vitest";
import {
  collectedThisMonth,
  coversUntil,
  feeDueLabel,
  feeLine,
  feesDue,
  periodsLabel,
  feeState,
  feeStateLabel,
  formatRupees,
  needsPayment,
  nextDue,
  reminderText,
} from "./fees";

const fee = (over: { starts_on?: string; paid_until?: string | null } = {}) => ({
  amount: 1500,
  period_months: 1,
  starts_on: "2026-10-01",
  paid_until: null,
  ...over,
});

describe("fees", () => {
  it("reads amounts and periods the Indian way", () => {
    expect(formatRupees(150000)).toBe("₹1,50,000");
    expect(feeLine({ amount: 1500, period_months: 1 })).toBe("₹1,500 a month");
    expect(feeLine({ amount: 4000, period_months: 3 })).toBe("₹4,000 every 3 months");
    expect(feeLine({ amount: 12000, period_months: 12 })).toBe("₹12,000 a year");
    expect(periodsLabel(1, 1)).toBe("1 month");
    expect(periodsLabel(3, 2)).toBe("6 months");
    expect(periodsLabel(6, 2)).toBe("1 year");
    expect(periodsLabel(12, 3)).toBe("3 years");
  });

  it("covers whole periods from the first unpaid day, as the database does", () => {
    expect(nextDue(fee())).toBe("2026-10-01");
    expect(nextDue(fee({ paid_until: "2026-10-31" }))).toBe("2026-11-01");
    expect(coversUntil("2026-10-01", 1, 1)).toBe("2026-10-31");
    expect(coversUntil("2026-02-01", 1, 3)).toBe("2026-04-30");
    expect(coversUntil("2026-01-15", 3, 1)).toBe("2026-04-14");
  });

  it("says when a fee is paid, due or overdue", () => {
    const today = "2026-10-24";
    expect(feeStateLabel(feeState(fee({ paid_until: "2026-11-30" }), today))).toBe("Paid until Nov 30");
    expect(feeStateLabel(feeState(fee({ paid_until: "2026-10-26" }), today))).toBe("Due in 3 days (Oct 27)");
    expect(feeStateLabel(feeState(fee({ paid_until: "2026-10-23" }), today))).toBe("Due today");
    expect(feeStateLabel(feeState(fee({ paid_until: "2026-09-30" }), today))).toBe("Overdue since Oct 1");
    expect(feeStateLabel(feeState(fee({ starts_on: "2026-12-01" }), today))).toBe("First payment due Dec 1");
    expect(needsPayment(feeState(fee({ paid_until: "2026-11-30" }), today))).toBe(false);
    expect(needsPayment(feeState(fee({ paid_until: "2026-09-30" }), today))).toBe(true);
  });

  it("lists the fees to chase", () => {
    const today = "2026-10-24";
    const fees = new Map([
      ["paid", { ...fee({ paid_until: "2026-11-30" }), id: "a", gym_id: "g", trainer_id: null, payer_id: "paid", status: "active" as const }],
      ["late", { ...fee({ paid_until: "2026-09-30" }), id: "b", gym_id: "g", trainer_id: null, payer_id: "late", status: "active" as const }],
      ["soon", { ...fee({ paid_until: "2026-10-26" }), id: "c", gym_id: "g", trainer_id: null, payer_id: "soon", status: "active" as const }],
    ]);
    const due = feesDue(fees, today);
    expect([...due.keys()]).toEqual(["late", "soon"]);
    expect(feeDueLabel(due.get("late")!)).toBe("Fee overdue since Oct 1");
    expect(feeDueLabel(due.get("soon")!)).toBe("Fee due in 3 days (Oct 27)");
  });

  it("writes a reminder and adds up the month", () => {
    const state = feeState(fee({ paid_until: "2026-09-30" }), "2026-10-24");
    expect(reminderText({ firstName: "Mina", from: "2n", fee: fee(), state })).toBe(
      "Hi Mina, a reminder from 2n: your fee of ₹1,500 was due on Oct 1. Thank you!"
    );
    expect(
      collectedThisMonth(
        [
          { amount: 1500, paid_on: "2026-10-03" },
          { amount: 4000, paid_on: "2026-10-20" },
          { amount: 1500, paid_on: "2026-09-30" },
        ],
        "2026-10-24"
      )
    ).toBe(5500);
  });
});
