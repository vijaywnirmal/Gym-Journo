"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isValidIsoDate } from "@/lib/date";
import { FEE_PERIODS, MAX_FEE, PAYMENT_METHODS, type PaymentMethod } from "@/lib/fees";

export type FeeInput = { amount: number; periodMonths: number; startsOn: string };
export type PaymentInput = { amount: number; paidOn: string; method: PaymentMethod; periods: number };

// Who charges the fee: a gym (for one of its members) or the signed-in trainer (for a client).
// Bound by the page; the database checks the caller runs the gym or trains the client.
export type FeePayee = { gymId: string; memberId: string } | { clientId: string };

function amountError(amount: number): string | null {
  return Number.isInteger(amount) && amount >= 1 && amount <= MAX_FEE ? null : "Enter an amount in rupees, up to ₹10,00,000.";
}

function refusal(error: { code?: string; message: string }, fallback: string): string {
  if (error.code === "42501") return "You can't change this fee any more.";
  if (error.message.includes("Not a member")) return "They're no longer a member.";
  if (error.message.includes("has ended")) return "This fee has ended.";
  if (error.message.includes("latest payment")) return "Only the latest payment can be undone.";
  return fallback;
}

type Result = { error?: string; success?: boolean };

function done(): Result {
  revalidatePath("/", "layout");
  return { success: true };
}

export async function saveFee(payee: FeePayee, input: FeeInput): Promise<Result> {
  const error = amountError(input.amount);
  if (error) return { error };
  if (!(FEE_PERIODS as readonly number[]).includes(input.periodMonths)) return { error: "Choose how often they pay." };
  if (!isValidIsoDate(input.startsOn)) return { error: "Choose when the first payment is due." };
  const supabase = await createClient();
  const { error: dbError } =
    "gymId" in payee
      ? await supabase.rpc("set_gym_member_fee", {
          p_gym_id: payee.gymId,
          p_member_id: payee.memberId,
          p_amount: input.amount,
          p_period_months: input.periodMonths,
          p_starts_on: input.startsOn,
        })
      : await supabase.rpc("set_client_fee", {
          p_client_id: payee.clientId,
          p_amount: input.amount,
          p_period_months: input.periodMonths,
          p_starts_on: input.startsOn,
        });
  if (dbError) return { error: refusal(dbError, "Couldn't save the fee. Please try again.") };
  return done();
}

export async function recordPayment(feeId: string, input: PaymentInput): Promise<Result> {
  const error = amountError(input.amount);
  if (error) return { error };
  if (!Number.isInteger(input.periods) || input.periods < 1 || input.periods > 12) return { error: "Pay for 1 to 12 periods." };
  if (!(PAYMENT_METHODS as readonly string[]).includes(input.method)) return { error: "Choose how they paid." };
  if (!isValidIsoDate(input.paidOn)) return { error: "Choose the date they paid." };
  const supabase = await createClient();
  const { error: dbError } = await supabase.rpc("record_fee_payment", {
    p_fee_id: feeId,
    p_amount: input.amount,
    p_paid_on: input.paidOn,
    p_method: input.method,
    p_periods: input.periods,
  });
  if (dbError) {
    if (dbError.message.includes("future")) return { error: "The payment date can't be in the future." };
    return { error: refusal(dbError, "Couldn't record the payment. Please try again.") };
  }
  return done();
}

export async function undoPayment(paymentId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("undo_fee_payment", { p_payment_id: paymentId });
  if (error) return { error: refusal(error, "Couldn't undo the payment. Please try again.") };
  return done();
}

export async function stopFee(feeId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("end_fee", { p_fee_id: feeId });
  if (error) return { error: refusal(error, "Couldn't stop the fee. Please try again.") };
  return done();
}
