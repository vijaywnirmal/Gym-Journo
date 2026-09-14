"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendMagicLink, signInWithPassword } from "./actions";

export default function LoginPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"password" | "magic-link">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  function handlePasswordSubmit() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("email", email);
      formData.set("password", password);
      const result = await signInWithPassword(null, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push("/");
      router.refresh();
    });
  }

  function handleMagicLinkSubmit() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("email", email);
      const result = await sendMagicLink(null, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMagicLinkSent(true);
    });
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="mb-1 text-2xl font-bold text-neutral-100">Gym Journal</h1>
      <p className="mb-8 text-sm text-neutral-400">
        {mode === "password"
          ? "Sign in with your email and password."
          : "Sign in with your email — we'll send you a magic link, no password needed."}
      </p>

      {mode === "magic-link" && magicLinkSent ? (
        <div className="rounded-xl border border-green-900 bg-green-950 p-4 text-sm text-green-300">
          Check your email for a sign-in link.
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (mode === "password") handlePasswordSubmit();
            else handleMagicLinkSubmit();
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

          {mode === "password" && (
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Password"
              className="rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-base text-neutral-100 placeholder-neutral-500"
            />
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-white px-4 py-3 font-medium text-neutral-900 disabled:opacity-50"
          >
            {pending ? "Signing in..." : mode === "password" ? "Sign in" : "Send magic link"}
          </button>

          <button
            type="button"
            onClick={() => {
              setError(null);
              setMode(mode === "password" ? "magic-link" : "password");
            }}
            className="text-center text-sm text-neutral-400 underline"
          >
            {mode === "password" ? "Sign in with a magic link instead" : "Sign in with a password instead"}
          </button>
        </form>
      )}
    </main>
  );
}
