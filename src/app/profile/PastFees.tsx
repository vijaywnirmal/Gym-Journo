import { format, parseISO } from "date-fns";
import { feeLine, formatRupees, METHOD_LABEL, type PastFee } from "@/lib/fees";
import type { FeePayment } from "@/lib/fees";

// The latest few for each fee.
const PAYMENTS_SHOWN = 3;

function day(date: string) {
  return format(parseISO(date), "MMM d, yyyy");
}

// Fees that have ended: the member's own record of what they paid, kept after they leave a gym or
// trainer, or after that gym or trainer leaves Gym Journal.
export default function PastFees({ fees }: { fees: { fee: PastFee; payments: FeePayment[] }[] }) {
  if (fees.length === 0) return null;
  return (
    <>
      <h2 className="section-title mt-8">Past fees</h2>
      <section className="card divide-y divide-separator">
        {fees.map(({ fee, payments }) => (
          <div key={fee.id} className="px-4 py-3 text-sm">
            <p className="font-medium">{fee.payee_name ?? "Fee"}</p>
            <p className="text-label-2">
              {feeLine(fee)}
              {fee.paid_until ? ` · paid until ${day(fee.paid_until)}` : " · no payments recorded"}
            </p>
            {payments.length > 0 && (
              <ul className="mt-1.5 text-xs text-label-2">
                {payments.slice(0, PAYMENTS_SHOWN).map((p) => (
                  <li key={p.id}>
                    Paid {formatRupees(p.amount)} on {day(p.paid_on)} · {METHOD_LABEL[p.method]}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </section>
    </>
  );
}
