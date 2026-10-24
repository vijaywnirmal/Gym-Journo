"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { endCoaching } from "./actions";

export default function EndCoaching({ linkId, name }: { linkId: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function end() {
    setError(null);
    startTransition(async () => {
      const result = await endCoaching(linkId);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push("/trainer/clients");
    });
  }

  return (
    <section className="card px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">End coaching</p>
          <p className="text-sm text-label-2">You&apos;ll stop seeing {name}&apos;s plans and workouts. Plans you made stay with them.</p>
        </div>
        {!confirming && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="h-8 shrink-0 rounded-lg border border-red/40 px-3 text-sm font-semibold text-red hover:bg-red/10"
          >
            End…
          </button>
        )}
      </div>
      {confirming && (
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="h-8 rounded-lg px-2.5 text-sm font-medium hover:bg-fill"
          >
            Keep
          </button>
          <button
            type="button"
            onClick={end}
            disabled={pending}
            className="h-8 rounded-lg bg-red px-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            End coaching
          </button>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-red">{error}</p>}
    </section>
  );
}
