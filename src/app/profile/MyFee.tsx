import { format, parseISO } from "date-fns";
import { feeLine, feeState, feeStateLabel, formatRupees, METHOD_LABEL, type Fee, type FeePayment } from "@/lib/fees";

// The latest few; the gym or trainer has the full list.
const PAYMENTS_SHOWN = 3;

function day(date: string) {
  return format(parseISO(date), "MMM d");
}

// The member's own fee with their gym or trainer, as recorded there: what it is, whether it's paid,
// and the latest payments. today is the member's, from the server.
export default function MyFee({ fee, payments, today }: { fee: Fee; payments: FeePayment[]; today: string }) {
  const state = feeState(fee, today);
  return (
    <div className="text-sm">
      <p className="font-medium">Fee: {feeLine(fee)}</p>
      <p className={state.kind === "overdue" ? "font-medium text-orange" : "text-label-2"}>{feeStateLabel(state)}</p>
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
  );
}
