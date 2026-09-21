import type { CoachReply } from "@/lib/coach/contract";
import type { CoachSource } from "@/lib/coach/presentation";

const KIND_LABEL = {
  fact: "From your records",
  interpretation: "A reading of your records",
} as const;

// A verified Coach reply. Every statement has already been checked against the evidence, so this
// only presents it: which statements restate the records, which are a reading of them, and which
// records they rest on.
export default function CoachReplyView({
  reply,
  sources,
}: {
  reply: CoachReply;
  sources: CoachSource[];
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <ul className="flex flex-col gap-3">
        {reply.statements.map((statement, i) => (
          <li key={i}>
            <p className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
              {KIND_LABEL[statement.kind]}
            </p>
            <p className="text-sm text-neutral-100">{statement.text}</p>
          </li>
        ))}
      </ul>

      {reply.questions.length > 0 && (
        <div className="mt-4 border-t border-neutral-800 pt-3">
          <p className="mb-1 text-xs font-medium text-neutral-300">Coach asks</p>
          <ul className="flex flex-col gap-1 text-sm text-neutral-300">
            {reply.questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </div>
      )}

      {sources.length > 0 && (
        <p className="mt-4 text-xs text-neutral-500">
          Based on: {sources.map((source) => source.label).join(" · ")}
        </p>
      )}
      <p className="mt-1 text-xs text-neutral-600">
        Checked against your records. Records can be edited after the fact, and effort isn&apos;t
        tracked.
      </p>
    </div>
  );
}
