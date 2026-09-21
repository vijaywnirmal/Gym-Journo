"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteAccount } from "./actions";

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
    <div className="border-t border-red-950 pt-5">
      <h2 className="mb-1 text-sm font-semibold text-red-400">Danger zone</h2>
      <p className="mb-3 text-xs text-neutral-500">
        Permanently delete your account and all your data — exercises, workout plans, logs, AI
        plans, and Coach history. This cannot be undone.
      </p>

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-lg border border-red-900 px-4 py-2 text-sm font-medium text-red-400"
        >
          Delete my account
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-neutral-400">
            Type <span className="font-mono text-red-400">DELETE</span> to confirm.
          </p>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending || confirmText !== "DELETE"}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {pending ? "Deleting..." : "Permanently delete"}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                setConfirmText("");
                setError(null);
              }}
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
