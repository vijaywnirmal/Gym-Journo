"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { acceptInvite } from "./actions";

export default function JoinActions({ code }: { code: string }) {
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
      router.push("/");
      router.refresh();
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
          {pending ? "Accepting…" : "Accept"}
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
