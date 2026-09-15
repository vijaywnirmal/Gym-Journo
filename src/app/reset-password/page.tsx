import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ResetPasswordForm from "./ResetPasswordForm";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="mb-1 text-2xl font-bold text-neutral-100">Set a new password</h1>

      {!user ? (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-sm text-neutral-400">
            This reset link is invalid or has expired. Request a new one.
          </p>
          <Link
            href="/forgot-password"
            className="rounded-xl bg-white px-4 py-3 text-center font-medium text-neutral-900"
          >
            Request a new link
          </Link>
        </div>
      ) : (
        <>
          <p className="mb-8 text-sm text-neutral-400">Choose a new password for your account.</p>
          <ResetPasswordForm />
        </>
      )}
    </main>
  );
}
