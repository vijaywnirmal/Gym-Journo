// Membership fees (migration 0040): how the screens describe them. Pure, so the rules are tested in
// one place. Gym Journal tracks fees; money changes hands outside it.

import { addMonths, format, parseISO } from "date-fns";
import { DATE_FMT, daysBetween, shiftDate } from "@/lib/date";

export type Fee = {
  id: string;
  gym_id: string | null;
  trainer_id: string | null;
  payer_id: string;
  amount: number;
  period_months: number;
  starts_on: string;
  paid_until: string | null;
  status: "active" | "ended";
};

export type FeePayment = {
  id: string;
  fee_id: string;
  amount: number;
  paid_on: string;
  method: PaymentMethod;
  covers_from: string;
  covers_until: string;
};

export const FEE_PERIODS = [1, 3, 6, 12] as const;
export const PAYMENT_METHODS = ["cash", "upi", "card", "bank", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  bank: "Bank transfer",
  other: "Other",
};
export const MAX_FEE = 1_000_000;
// Due within this many days counts as due soon (on the dashboard and in lists).
export const DUE_SOON_DAYS = 7;

const rupees = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export function formatRupees(amount: number): string {
  return `₹${rupees.format(amount)}`;
}

export function periodLabel(months: number): string {
  if (months === 1) return "a month";
  if (months === 12) return "a year";
  return `every ${months} months`;
}

// How long n periods last: "2 months", "6 months", "1 year".
export function periodsLabel(periodMonths: number, n: number): string {
  const months = periodMonths * n;
  if (months % 12 === 0) return `${months / 12} year${months === 12 ? "" : "s"}`;
  return `${months} month${months === 1 ? "" : "s"}`;
}

// "₹1,500 a month"
export function feeLine(fee: Pick<Fee, "amount" | "period_months">): string {
  return `${formatRupees(fee.amount)} ${periodLabel(fee.period_months)}`;
}

// The first day not yet paid for.
export function nextDue(fee: Pick<Fee, "starts_on" | "paid_until">): string {
  return fee.paid_until ? shiftDate(fee.paid_until, 1) : fee.starts_on;
}

// The last day a payment of `periods` periods from `from` covers, as the database works it out.
export function coversUntil(from: string, periodMonths: number, periods: number): string {
  return shiftDate(format(addMonths(parseISO(from), periodMonths * periods), DATE_FMT), -1);
}

export type FeeState =
  | { kind: "paid"; until: string }
  | { kind: "starts"; on: string }
  | { kind: "due-soon"; on: string; days: number }
  | { kind: "due-today"; on: string }
  | { kind: "overdue"; since: string; days: number };

export function feeState(fee: Pick<Fee, "starts_on" | "paid_until">, today: string): FeeState {
  const due = nextDue(fee);
  const days = daysBetween(today, due);
  if (days < 0) return { kind: "overdue", since: due, days: -days };
  if (days === 0) return { kind: "due-today", on: due };
  if (days <= DUE_SOON_DAYS) return { kind: "due-soon", on: due, days };
  return fee.paid_until ? { kind: "paid", until: fee.paid_until } : { kind: "starts", on: due };
}

// Due now, overdue, or due within a week: what the gym or trainer should chase.
export function needsPayment(state: FeeState): boolean {
  return state.kind === "overdue" || state.kind === "due-today" || state.kind === "due-soon";
}

// The fees to chase (see needsPayment), by who pays them.
export function feesDue(fees: Map<string, Fee>, today: string): Map<string, FeeState> {
  const due = new Map<string, FeeState>();
  for (const [payerId, fee] of fees) {
    const state = feeState(fee, today);
    if (needsPayment(state)) due.set(payerId, state);
  }
  return due;
}

function day(date: string): string {
  return format(parseISO(date), "MMM d");
}

export function feeStateLabel(state: FeeState): string {
  switch (state.kind) {
    case "paid":
      return `Paid until ${day(state.until)}`;
    case "starts":
      return `First payment due ${day(state.on)}`;
    case "due-soon":
      return `Due in ${state.days} day${state.days === 1 ? "" : "s"} (${day(state.on)})`;
    case "due-today":
      return "Due today";
    case "overdue":
      return `Overdue since ${day(state.since)}`;
  }
}

// For a line in a list of members or clients: "Fee overdue since Oct 1".
export function feeDueLabel(state: FeeState): string {
  const label = feeStateLabel(state);
  return `Fee ${label[0].toLowerCase()}${label.slice(1)}`;
}

// A WhatsApp reminder the gym or trainer sends from their own phone.
export function reminderText({
  firstName,
  from,
  fee,
  state,
}: {
  firstName: string;
  from: string;
  fee: Pick<Fee, "amount" | "period_months">;
  state: FeeState;
}): string {
  const due = state.kind === "overdue" ? state.since : "on" in state ? state.on : null;
  const when = due ? (state.kind === "overdue" ? `was due on ${day(due)}` : `is due on ${day(due)}`) : "is coming up";
  return `Hi ${firstName}, a reminder from ${from}: your fee of ${formatRupees(fee.amount)} ${when}. Thank you!`;
}

// Total of payments made in the month that `today` is in.
export function collectedThisMonth(payments: Pick<FeePayment, "amount" | "paid_on">[], today: string): number {
  const month = today.slice(0, 7);
  return payments.filter((p) => p.paid_on.slice(0, 7) === month).reduce((sum, p) => sum + p.amount, 0);
}
