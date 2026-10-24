import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/currentUser";
import type { Fee, FeePayment } from "@/lib/fees";

const FEE_COLUMNS = "id, gym_id, trainer_id, payer_id, amount, period_months, starts_on, paid_until, status";
const PAYMENT_COLUMNS = "id, fee_id, amount, paid_on, method, covers_from, covers_until";
// Enough history to read on a phone.
const PAYMENTS_SHOWN = 12;

// A gym's active fees, by member (gym admins read them; RLS in 0040).
export async function getGymFees(gymId: string): Promise<Map<string, Fee>> {
  const supabase = await createClient();
  const { data } = await supabase.from("fees").select(FEE_COLUMNS).eq("gym_id", gymId).eq("status", "active");
  return new Map(((data ?? []) as Fee[]).map((f) => [f.payer_id, f]));
}

// The signed-in trainer's active fees, by client.
export async function getTrainerFees(): Promise<Map<string, Fee>> {
  const user = await getCurrentUser();
  if (!user) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.from("fees").select(FEE_COLUMNS).eq("trainer_id", user.id).eq("status", "active");
  return new Map(((data ?? []) as Fee[]).map((f) => [f.payer_id, f]));
}

// One person's active fee with a gym or the signed-in trainer, and its latest payments.
export async function getFeeFor(
  payee: { gymId: string } | { trainerId: string },
  payerId: string
): Promise<{ fee: Fee | null; payments: FeePayment[] }> {
  const supabase = await createClient();
  const query = supabase.from("fees").select(FEE_COLUMNS).eq("payer_id", payerId).eq("status", "active");
  const { data } = await ("gymId" in payee ? query.eq("gym_id", payee.gymId) : query.eq("trainer_id", payee.trainerId)).maybeSingle();
  const fee = (data as Fee | null) ?? null;
  return { fee, payments: fee ? await getPayments(fee.id) : [] };
}

async function getPayments(feeId: string): Promise<FeePayment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("fee_payments")
    .select(PAYMENT_COLUMNS)
    .eq("fee_id", feeId)
    .order("covers_until", { ascending: false })
    .limit(PAYMENTS_SHOWN);
  return (data ?? []) as FeePayment[];
}

// Payments a gym received in the month `today` is in, for its dashboard.
export async function getGymPaymentsSince(gymId: string, from: string): Promise<Pick<FeePayment, "amount" | "paid_on">[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("fee_payments")
    .select("amount, paid_on, fee:fees!inner(gym_id)")
    .eq("fee.gym_id", gymId)
    .gte("paid_on", from);
  return (data ?? []).map((p) => ({ amount: p.amount as number, paid_on: p.paid_on as string }));
}

// The signed-in person's own active fees (to a gym, to a trainer), with their latest payments.
export const getMyFees = cache(async (): Promise<{ fee: Fee; payments: FeePayment[] }[]> => {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("fees").select(FEE_COLUMNS).eq("payer_id", user.id).eq("status", "active");
  if (error || !data) return [];
  return Promise.all((data as Fee[]).map(async (fee) => ({ fee, payments: await getPayments(fee.id) })));
});
