"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteAccount } from "./actions";

export default function DeleteAccountSection() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("confirmation", confirmation);
      const result = await deleteAccount(null, formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.push("/login");
      router.refresh();
    });
  }

  if (!open) {
    return (
      <div className="border-t border-neutral-800 pt-5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm text-red-400 underline"
        >
          Delete account
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-red-900 bg-red-950/40 p-4">
      <p className="mb-1 text-sm font-semibold text-red-300">Delete your account</p>
      <p className="mb-3 text-sm text-red-200/80">
        This permanently deletes your account and all data you own — profile, exercises,
        schedules, and logged workouts. This cannot be undone.
      </p>
      <label className="mb-1 block text-xs font-medium text-red-200/80">
        Type DELETE to confirm
      </label>
      <input
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
        className="mb-3 w-full rounded-lg border border-red-900 bg-neutral-900 px-3 py-2 text-base text-neutral-100"
      />

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending || confirmation !== "DELETE"}
          className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Deleting..." : "Permanently delete account"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setConfirmation("");
            setError(null);
          }}
          className="rounded-lg border border-neutral-700 px-4 py-2.5 text-sm text-neutral-100"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
