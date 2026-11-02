"use client";

import { useState, useTransition } from "react";
import { reactivateAccount } from "@/app/profile/accountActions";

export default function ReactivateButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await reactivateAccount();
            if (result?.error) setError(result.error);
          })
        }
        className="h-10 rounded-[10px] bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Turning on…" : "Turn my account back on"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red">
          {error}
        </p>
      )}
    </div>
  );
}
