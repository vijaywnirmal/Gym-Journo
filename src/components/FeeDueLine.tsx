import { feeDueLabel, type FeeState } from "@/lib/fees";

// A fee to chase, under a member's or client's name in a list; orange once overdue.
export default function FeeDueLine({ state }: { state: FeeState | undefined }) {
  if (!state) return null;
  return (
    <span className={`block text-xs ${state.kind === "overdue" ? "font-medium text-orange" : "text-label-2"}`}>
      {feeDueLabel(state)}
    </span>
  );
}
