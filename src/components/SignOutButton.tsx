"use client";

import { useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function SignOutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await createClient().auth.signOut();
          router.push("/login");
          router.refresh();
        })
      }
      className="h-8 shrink-0 rounded-lg border border-separator px-3 text-sm font-semibold hover:bg-fill disabled:opacity-50"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
