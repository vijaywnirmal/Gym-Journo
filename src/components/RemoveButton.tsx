"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// A destructive row with a confirm step: shows the warning, then runs the action and goes to done
// (or refreshes when there's nowhere to go).
export default function RemoveButton({
  label,
  warning,
  action,
  done,
  confirmLabel = "Remove",
}: {
  label: string;
  warning: string;
  confirmLabel?: "Remove" | "Leave";
  action: () => Promise<{ error?: string }>;
  done?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
      setConfirming(false);
      if (done) router.push(done);
    });
  }

  return (
    <div className="px-4 py-3">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-40 flex-1 text-sm text-label-2">{warning}</p>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="h-8 rounded-lg px-2.5 text-sm font-medium hover:bg-fill"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={run}
            disabled={pending}
            className="h-8 rounded-lg bg-red px-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? (confirmLabel === "Leave" ? "Leaving…" : "Removing…") : confirmLabel}
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="text-sm font-semibold text-red">
          {label}
        </button>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red">
          {error}
        </p>
      )}
    </div>
  );
}
