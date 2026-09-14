"use client";

import { useActionState } from "react";
import { sendMagicLink } from "./actions";

const initialState: { error?: string; success?: boolean } = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(sendMagicLink, initialState);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="mb-1 text-2xl font-bold text-neutral-100">Gym Journal</h1>
      <p className="mb-8 text-sm text-neutral-400">
        Sign in with your email — we&apos;ll send you a magic link, no password needed.
      </p>

      {state.success ? (
        <div className="rounded-xl border border-green-900 bg-green-950 p-4 text-sm text-green-300">
          Check your email for a sign-in link.
        </div>
      ) : (
        <form action={formAction} className="flex flex-col gap-3">
          <input
            type="email"
            name="email"
            required
            placeholder="you@example.com"
            className="rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-base text-neutral-100 placeholder-neutral-500"
          />
          {state.error && <p className="text-sm text-red-400">{state.error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-white px-4 py-3 font-medium text-neutral-900 disabled:opacity-50"
          >
            {pending ? "Sending..." : "Send magic link"}
          </button>
        </form>
      )}
    </main>
  );
}
