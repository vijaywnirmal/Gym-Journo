"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteAccount } from "./actions";

// Account deletion is permanent, so it asks the person to type DELETE before it runs.
export default function DeleteAccountSection() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteAccount();
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-red">Delete account</p>
          <p className="text-sm text-label-2">Removes all your workouts, plans and Coach history.</p>
        </div>
        {!confirming && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="h-8 shrink-0 rounded-lg border border-red/40 px-3 text-sm font-semibold text-red hover:bg-red/10"
          >
            Delete…
          </button>
        )}
      </div>

      {confirming && (
        <div className="mt-3 flex flex-col gap-2 rounded-[10px] border border-red/30 bg-red/5 p-3">
          <label htmlFor="confirm-delete" className="text-sm">
            This can&apos;t be undone. Type <span className="font-mono font-semibold text-red">DELETE</span> to confirm.
          </label>
          <input
            id="confirm-delete"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            autoComplete="off"
            className="field h-10 rounded-lg px-3 text-sm"
          />
          {error && <p className="text-sm text-red">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending || confirmText !== "DELETE"}
              className="h-9 rounded-lg bg-red px-4 text-sm font-semibold text-white disabled:opacity-40"
            >
              {pending ? "Deleting…" : "Permanently delete"}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                setConfirmText("");
                setError(null);
              }}
              className="h-9 rounded-lg border border-separator px-4 text-sm font-semibold hover:bg-fill"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
