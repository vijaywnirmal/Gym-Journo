"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import Icon from "@/components/Icon";
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
      if (result.error) {
        setError(result.error);
        return;
      }
      setSent(true);
    });
  }

  return (
    <main className="screen-enter mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <span className="mb-6 grid size-16 place-items-center rounded-[22%] bg-tint text-white shadow-raised">
        <Icon name="dumbbell" className="size-9" strokeWidth={2.25} />
      </span>
      <h1 className="mb-1 large-title">Reset your password</h1>
      <p className="mb-8 text-sm text-label-2">
        Enter your email and we&apos;ll send you a link to reset your password.
      </p>

      {sent ? (
        <div className="rounded-xl bg-green/12 p-4 text-sm text-green">
          If an account exists for that email, a reset link is on its way. Check your inbox.
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
            className="rounded-xl bg-fill px-4 py-3 text-base text-label placeholder-label-3"
          />

          {error && <p className="text-sm text-red">{error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-tint px-4 py-3 font-medium text-white disabled:opacity-50"
          >
            {pending ? "Sending..." : "Send reset link"}
          </button>
        </form>
      )}

      <Link href="/login" className="mt-6 text-center text-sm text-tint">
        Back to sign in
      </Link>
    </main>
  );
}
