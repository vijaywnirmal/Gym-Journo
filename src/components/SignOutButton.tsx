"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function SignOutButton() {
  const router = useRouter();
  const supabase = createClient();

  return (
    <button
      onClick={async () => {
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
      }}
      className="shrink-0 whitespace-nowrap rounded-full bg-fill px-3 py-1.5 text-xs font-medium text-label-2"
    >
      Sign out
    </button>
  );
}
