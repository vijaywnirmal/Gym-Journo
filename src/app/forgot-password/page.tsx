"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { requestPasswordReset } from "./actions";

export default function ForgotPasswordPage() {
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("email", email);
      const result = await requestPasswordReset(null, formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setSent(true);
    });
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="mb-1 text-2xl font-bold text-neutral-100">Reset your password</h1>
      <p className="mb-8 text-sm text-neutral-400">
        Enter your email and we&apos;ll send you a link to reset your password.
      </p>

      {sent ? (
        <div className="rounded-xl border border-green-900 bg-green-950 p-4 text-sm text-green-300">
          If an account exists for <span className="font-medium">{email}</span>, a reset link has
          been sent.
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
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            className="rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-base text-neutral-100 placeholder-neutral-500"
          />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-white px-4 py-3 font-medium text-neutral-900 disabled:opacity-50"
          >
            {pending ? "Sending..." : "Send reset link"}
          </button>

          <Link href="/login" className="text-center text-sm text-neutral-400 underline">
            Back to sign in
          </Link>
        </form>
      )}
    </main>
  );
}
