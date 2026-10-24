import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));

const { recordPayment, saveFee, stopFee, undoPayment } = await import("./actions");

const fee = { amount: 1500, periodMonths: 1, startsOn: "2026-11-01" };
const payment = { amount: 1500, paidOn: "2026-10-24", method: "upi" as const, periods: 1 };

describe("fee actions", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: null, error: null });
  });

  it("sets a gym member's fee or a client's fee", async () => {
    expect(await saveFee({ gymId: "g", memberId: "m" }, fee)).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("set_gym_member_fee", {
      p_gym_id: "g",
      p_member_id: "m",
      p_amount: 1500,
      p_period_months: 1,
      p_starts_on: "2026-11-01",
    });
    expect(await saveFee({ clientId: "c" }, { ...fee, periodMonths: 3 })).toEqual({ success: true });
    expect(rpc).toHaveBeenLastCalledWith("set_client_fee", {
      p_client_id: "c",
      p_amount: 1500,
      p_period_months: 3,
      p_starts_on: "2026-11-01",
    });
  });

  it("checks a fee before saving it", async () => {
    for (const amount of [0, 1.5, 1_000_001, NaN]) {
      expect((await saveFee({ clientId: "c" }, { ...fee, amount })).error).toMatch(/amount/);
    }
    expect((await saveFee({ clientId: "c" }, { ...fee, periodMonths: 2 })).error).toBe("Choose how often they pay.");
    expect((await saveFee({ clientId: "c" }, { ...fee, startsOn: "2026-02-30" })).error).toMatch(/first payment/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("records a payment, and checks it first", async () => {
    expect(await recordPayment("f", payment)).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("record_fee_payment", {
      p_fee_id: "f",
      p_amount: 1500,
      p_paid_on: "2026-10-24",
      p_method: "upi",
      p_periods: 1,
    });
    rpc.mockClear();
    expect((await recordPayment("f", { ...payment, periods: 13 })).error).toBe("Pay for 1 to 12 periods.");
    expect((await recordPayment("f", { ...payment, method: "cheque" as never })).error).toBe("Choose how they paid.");
    expect((await recordPayment("f", { ...payment, paidOn: "" })).error).toBe("Choose the date they paid.");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("explains what the database refused", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "The payment date can't be in the future" } });
    expect((await recordPayment("f", payment)).error).toBe("The payment date can't be in the future.");
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Not your fee to change" } });
    expect((await stopFee("f")).error).toBe("You can't change this fee any more.");
    rpc.mockResolvedValue({ data: null, error: { message: "Not a member of this gym" } });
    expect((await saveFee({ gymId: "g", memberId: "m" }, fee)).error).toBe("They're no longer a member.");
    rpc.mockResolvedValue({ data: null, error: { message: "Only the latest payment can be undone" } });
    expect((await undoPayment("p")).error).toBe("Only the latest payment can be undone.");
    rpc.mockResolvedValue({ data: null, error: { message: "connection reset" } });
    expect((await undoPayment("p")).error).toBe("Couldn't undo the payment. Please try again.");
  });

  it("undoes a payment and stops a fee", async () => {
    expect(await undoPayment("p")).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("undo_fee_payment", { p_payment_id: "p" });
    expect(await stopFee("f")).toEqual({ success: true });
    expect(rpc).toHaveBeenLastCalledWith("end_fee", { p_fee_id: "f" });
  });
});
