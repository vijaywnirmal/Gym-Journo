"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { registerWithPassword } from "./actions";

export default function RegisterPage() {
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ needsEmailConfirmation: boolean } | null>(null);

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("email", email);
      formData.set("password", password);
      formData.set("confirmPassword", confirmPassword);
      const res = await registerWithPassword(null, formData);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setResult({ needsEmailConfirmation: res.needsEmailConfirmation });
    });
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="mb-1 text-2xl font-bold text-neutral-100">Create your account</h1>
      <p className="mb-8 text-sm text-neutral-400">
        Set an email and password to get started with Gym Journal.
      </p>

      {result ? (
        <div className="rounded-xl border border-green-900 bg-green-950 p-4 text-sm text-green-300">
          {result.needsEmailConfirmation ? (
            <>
              Account created. Check <span className="font-medium">{email}</span> for a
              confirmation link before signing in.
            </>
          ) : (
            <>
              Account created and signed in. <Link href="/" className="underline">Continue</Link>
            </>
          )}
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
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Password (min. 8 characters)"
            className="rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-base text-neutral-100 placeholder-neutral-500"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            placeholder="Confirm password"
            className="rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-base text-neutral-100 placeholder-neutral-500"
          />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-white px-4 py-3 font-medium text-neutral-900 disabled:opacity-50"
          >
            {pending ? "Creating account..." : "Create account"}
          </button>

          <Link href="/login" className="text-center text-sm text-neutral-400 underline">
            Already have an account? Sign in
          </Link>
        </form>
      )}
    </main>
  );
}
