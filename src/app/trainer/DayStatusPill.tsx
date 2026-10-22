import { DAY_STATUS_LABEL, type DayStatus } from "@/lib/clientStatus";

const TONE: Record<DayStatus, string> = {
  done: "bg-green/12 text-green",
  today: "bg-accent/12 text-link",
  planned: "bg-fill text-label-2",
  missed: "bg-orange/12 text-orange",
  rest: "bg-fill text-label-2",
  absence: "bg-fill text-label-2",
  none: "bg-fill text-label-3",
};

export default function DayStatusPill({ status }: { status: DayStatus }) {
  return (
    <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${TONE[status]}`}>
      {DAY_STATUS_LABEL[status]}
    </span>
  );
}
