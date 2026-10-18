"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { decideSuggestion } from "./actions";

type Props = {
  plannedExerciseId: string;
  exerciseName: string;
  planLabel: string;
  planHref: string;
  kind: "increase" | "deload";
  change: string;
  reason: string;
};

export default function SuggestionCard(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [decided, setDecided] = useState<"accepted" | "rejected" | null>(null);

  function decide(accept: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await decideSuggestion(props.plannedExerciseId, accept);
      if ("error" in result) {
        setError(result.error);
        router.refresh();
        return;
      }
      setDecided(accept ? "accepted" : "rejected");
      router.refresh();
    });
  }

  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-semibold text-label">{props.exerciseName}</p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
            props.kind === "increase" ? "bg-green/12 text-green" : "bg-accent/10 text-link"
          }`}
        >
          {props.kind === "increase" ? "Increase" : "Deload"}
        </span>
      </div>
      <Link href={props.planHref} className="text-xs text-link">
        {props.planLabel}
      </Link>
      <p className="mt-2 text-xl font-semibold text-label">{props.change}</p>
      <p className="mt-1 text-sm text-label">{props.reason}</p>

      {error && <p className="mt-2 text-sm text-red">{error}</p>}
      {decided ? (
        <p className="mt-3 text-sm text-label-2" role="status">
          {decided === "accepted" ? "Accepted — the plan's target weight is updated." : "Rejected — the plan is unchanged."}
        </p>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => decide(true)}
            disabled={pending}
            className="flex-1 h-9 rounded-lg bg-accent px-3 text-sm font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-40"
          >
            Accept
          </button>
          <button
            type="button"
            onClick={() => decide(false)}
            disabled={pending}
            className="flex-1 h-9 rounded-lg border border-separator px-3 text-sm font-semibold hover:bg-fill disabled:opacity-40"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
