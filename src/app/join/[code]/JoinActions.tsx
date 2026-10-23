"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { acceptInvite } from "./actions";

// switchingFrom: the trainer they'll stop training with, named on the button so it's a clear choice.
export default function JoinActions({ code, name, switchingFrom }: { code: string; name: string; switchingFrom: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function accept() {
    setError(null);
    startTransition(async () => {
      const result = await acceptInvite(code);
      if (result.error) {
        setError(result.error);
        return;
      }
      // Profile shows the new trainer, confirming it worked. The action revalidated the layout, so
      // no refresh (which made this slow).
      router.push("/profile");
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="text-sm text-red">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={accept}
          disabled={pending}
          className="h-11 flex-1 rounded-[10px] bg-accent px-4 text-[15px] font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-50"
        >
          {pending ? "Accepting…" : switchingFrom ? `Switch to ${name}` : "Accept"}
        </button>
        <Link
          href="/"
          className="grid h-11 flex-1 place-items-center rounded-[10px] border border-separator px-4 text-[15px] font-semibold hover:bg-fill"
        >
          Not now
        </Link>
      </div>
    </div>
  );
}
