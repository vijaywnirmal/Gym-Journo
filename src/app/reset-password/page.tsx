"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetPassword } from "./actions";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function handleSubmit() {
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    startTransition(async () => {
      const formData = new FormData();
      formData.set("password", password);
      const result = await resetPassword(null, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setDone(true);
      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 1500);
    });
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="mb-1 text-2xl font-bold text-neutral-100">Set a new password</h1>
      <p className="mb-8 text-sm text-neutral-400">Choose a new password for your account.</p>

      {done ? (
        <div className="rounded-xl border border-green-900 bg-green-950 p-4 text-sm text-green-300">
          Password updated. Redirecting...
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="flex flex-col gap-3"
        >
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="New password (at least 8 characters)"
            className="rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-base text-neutral-100 placeholder-neutral-500"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            placeholder="Confirm new password"
            className="rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-base text-neutral-100 placeholder-neutral-500"
          />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-white px-4 py-3 font-medium text-neutral-900 disabled:opacity-50"
          >
            {pending ? "Saving..." : "Update password"}
          </button>
        </form>
      )}
    </main>
  );
}
