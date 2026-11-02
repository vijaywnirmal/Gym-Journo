"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { disableAccount } from "./accountActions";

// In place of deleting: a gym owner whose gym has members can't delete their account (that would
// delete the gym), so they can disable it, or remove their members first.
export default function DisableAccountSection({ gymName, memberCount }: { gymName: string; memberCount: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const members = memberCount === 1 ? "1 member" : `${memberCount} members`;

  function handleDisable() {
    setError(null);
    startTransition(async () => {
      const result = await disableAccount();
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
          <p className="text-sm font-semibold">Disable account</p>
          <p className="text-sm text-label-2">
            Pauses your account. {gymName} and its {members} carry on, and nothing is deleted. To delete your account
            for good, remove your members first.
          </p>
        </div>
        {!confirming && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="h-8 shrink-0 rounded-lg border border-separator px-3 text-sm font-semibold hover:bg-fill"
          >
            Disable…
          </button>
        )}
      </div>

      {confirming && (
        <div className="mt-3 flex flex-col gap-2 rounded-[10px] border border-separator bg-fill p-3">
          <p className="text-sm">
            You&apos;ll be signed out and your reminders will stop. While it&apos;s disabled, only your gym&apos;s admins
            can invite people or record fees. Sign in any time to turn it back on, then switch reminders on again in
            Profile.
          </p>
          {error && (
            <p role="alert" className="text-sm text-red">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDisable}
              disabled={pending}
              className="h-9 rounded-lg bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-50"
            >
              {pending ? "Disabling…" : "Disable account"}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
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
