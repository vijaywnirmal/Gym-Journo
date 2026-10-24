"use client";

import { useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import DateField from "@/components/ui/DateField";
import { recordPayment, saveFee, stopFee, undoPayment, type FeePayee } from "@/app/fees/actions";
import { whatsappShareUrl } from "@/lib/trainerInvites";
import {
  coversUntil,
  FEE_PERIODS,
  feeLine,
  feeState,
  feeStateLabel,
  formatRupees,
  METHOD_LABEL,
  needsPayment,
  nextDue,
  PAYMENT_METHODS,
  periodsLabel,
  reminderText,
  type Fee,
  type FeePayment,
  type PaymentMethod,
} from "@/lib/fees";

type Mode = "view" | "edit" | "pay" | "stop";

function day(date: string) {
  return format(parseISO(date), "MMM d");
}

// A member's (or client's) fee, from the gym's or trainer's side: set it, record payments as they
// come in, undo the latest, remind on WhatsApp, or stop charging. today is the payee's, from the
// server, so dates render the same in the browser.
export default function FeeCard({
  payee,
  fee,
  payments,
  today,
  payerFirstName,
  payeeName,
}: {
  payee: FeePayee;
  fee: Fee | null;
  payments: FeePayment[];
  today: string;
  payerFirstName: string;
  payeeName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>("view");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const [amount, setAmount] = useState(String(fee?.amount ?? ""));
  const [period, setPeriod] = useState(fee?.period_months ?? 1);
  const [startsOn, setStartsOn] = useState(fee ? nextDue(fee) : today);
  const [periods, setPeriods] = useState(1);
  const [paid, setPaid] = useState(String(fee?.amount ?? ""));
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [paidOn, setPaidOn] = useState(today);

  // Opening a form or going back clears the last message.
  function open(next: Mode) {
    setError(null);
    setDone(null);
    setMode(next);
  }

  function run(action: () => Promise<{ error?: string }>, message: string) {
    setError(null);
    setDone(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
      setMode("view");
      setDone(message);
    });
  }

  const state = fee ? feeState(fee, today) : null;
  const latest = payments[0];

  return (
    <section className="card divide-y divide-separator">
      {(error || done) && (
        <p role={error ? "alert" : "status"} className={`px-4 py-3 text-sm ${error ? "text-red" : "font-medium"}`}>
          {error ?? done}
        </p>
      )}

      {mode === "edit" ? (
        <form
          className="flex flex-col gap-3 px-4 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => saveFee(payee, { amount: Number(amount), periodMonths: period, startsOn }),
              fee ? "Fee changed." : "Fee set."
            );
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Amount (₹)</span>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                placeholder="1500"
                className="field h-11 w-full rounded-[10px] px-3 text-base"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Every</span>
              <select
                value={period}
                onChange={(e) => setPeriod(Number(e.target.value))}
                className="field h-11 w-full rounded-[10px] px-3 text-base"
              >
                {FEE_PERIODS.map((m) => (
                  <option key={m} value={m}>
                    {m === 1 ? "Month" : m === 12 ? "Year" : `${m} months`}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {/* Once something is paid, the next due date follows the payments. */}
          {!fee?.paid_until && (
            <div>
              <span className="mb-1.5 block text-sm font-medium">First payment due</span>
              <DateField value={startsOn} onChange={setStartsOn} ariaLabel="First payment due" />
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => open("view")}
              className="h-10 flex-1 rounded-[10px] border border-separator px-4 text-sm font-semibold hover:bg-fill"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || !amount}
              className="h-10 flex-1 rounded-[10px] bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      ) : !fee || !state ? (
        <div className="flex items-center gap-3 px-4 py-3">
          <p className="flex-1 text-sm text-label-2">No fee set</p>
          <button
            type="button"
            onClick={() => open("edit")}
            className="h-8 shrink-0 rounded-lg border border-separator px-3 text-sm font-semibold hover:bg-fill"
          >
            Set fee
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{feeLine(fee)}</p>
              <p className={`text-sm ${state.kind === "overdue" ? "font-medium text-orange" : "text-label-2"}`}>
                {feeStateLabel(state)}
              </p>
            </div>
            {mode === "view" && (
              <button
                type="button"
                onClick={() => {
                  setAmount(String(fee.amount));
                  setPeriod(fee.period_months);
                  setStartsOn(nextDue(fee));
                  open("edit");
                }}
                className="h-8 shrink-0 rounded-lg border border-separator px-3 text-sm font-semibold hover:bg-fill"
              >
                Edit
              </button>
            )}
          </div>

          {mode === "pay" ? (
            <form
              className="flex flex-col gap-3 px-4 py-3"
              onSubmit={(e) => {
                e.preventDefault();
                run(
                  () => recordPayment(fee.id, { amount: Number(paid), paidOn, method, periods }),
                  `Payment recorded. Paid until ${day(coversUntil(nextDue(fee), fee.period_months, periods))}.`
                );
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Amount (₹)</span>
                  <input
                    value={paid}
                    onChange={(e) => setPaid(e.target.value.replace(/\D/g, ""))}
                    inputMode="numeric"
                    className="field h-11 w-full rounded-[10px] px-3 text-base"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">For</span>
                  <select
                    value={periods}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setPeriods(n);
                      setPaid(String(fee.amount * n));
                    }}
                    className="field h-11 w-full rounded-[10px] px-3 text-base"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {periodsLabel(fee.period_months, n)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Paid by</span>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                    className="field h-11 w-full rounded-[10px] px-3 text-base"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {METHOD_LABEL[m]}
                      </option>
                    ))}
                  </select>
                </label>
                <div>
                  <span className="mb-1.5 block text-sm font-medium">Paid on</span>
                  <DateField value={paidOn} onChange={setPaidOn} max={today} ariaLabel="Paid on" />
                </div>
              </div>
              <p className="text-xs text-label-2">
                Covers {day(nextDue(fee))} – {day(coversUntil(nextDue(fee), fee.period_months, periods))}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => open("view")}
                  className="h-10 flex-1 rounded-[10px] border border-separator px-4 text-sm font-semibold hover:bg-fill"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending || !paid}
                  className="h-10 flex-1 rounded-[10px] bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-50"
                >
                  {pending ? "Saving…" : "Record"}
                </button>
              </div>
            </form>
          ) : mode === "stop" ? (
            <div className="flex flex-wrap items-center gap-2 px-4 py-3">
              <p className="min-w-40 flex-1 text-sm text-label-2">
                {payerFirstName} won&apos;t be charged from now on. Their payments stay recorded.
              </p>
              <button
                type="button"
                onClick={() => open("view")}
                className="h-8 rounded-lg px-2.5 text-sm font-medium hover:bg-fill"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => run(() => stopFee(fee.id), "Fee stopped.")}
                disabled={pending}
                className="h-8 rounded-lg bg-red px-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {pending ? "Stopping…" : "Stop fee"}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 px-4 py-3">
              <button
                type="button"
                onClick={() => {
                  setPeriods(1);
                  setPaid(String(fee.amount));
                  setPaidOn(today);
                  open("pay");
                }}
                className="h-9 rounded-[10px] bg-accent px-3 text-sm font-semibold text-on-accent hover:bg-accent-hover"
              >
                Record payment
              </button>
              {needsPayment(state) && (
                <a
                  href={whatsappShareUrl(reminderText({ firstName: payerFirstName, from: payeeName, fee, state }))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 items-center rounded-[10px] border border-separator px-3 text-sm font-semibold hover:bg-fill"
                >
                  Remind on WhatsApp
                </a>
              )}
            </div>
          )}

          {payments.length > 0 && (
            <ul className="px-4 py-3 text-sm">
              <li className="mb-1 text-xs font-medium text-label-2">Payments</li>
              {payments.map((p) => (
                <li key={p.id} className="flex items-center gap-2 py-1">
                  <span className="min-w-0 flex-1">
                    {day(p.paid_on)} · {formatRupees(p.amount)} · {METHOD_LABEL[p.method]}
                    <span className="block text-xs text-label-2">
                      Covers {day(p.covers_from)} – {day(p.covers_until)}
                    </span>
                  </span>
                  {p.id === latest?.id && mode === "view" && (
                    <button
                      type="button"
                      onClick={() => run(() => undoPayment(p.id), "Payment undone.")}
                      disabled={pending}
                      className="h-8 shrink-0 rounded-lg px-2 text-sm font-medium text-label-2 hover:bg-fill disabled:opacity-50"
                    >
                      Undo
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {mode === "view" && (
            <div className="px-4 py-3">
              <button
                type="button"
                onClick={() => open("stop")}
                className="text-sm font-medium text-label-2 hover:text-red"
              >
                Stop fee
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
