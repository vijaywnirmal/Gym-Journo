"use client";

import { Suspense, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/Icon";
import { registerWithPassword, resendConfirmation, sendMagicLink, signInWithPassword } from "./actions";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"password" | "magic-link" | "register">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "invalid_link"
      ? "That link has expired or already been used. Request a new one."
      : null
  );
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resent, setResent] = useState(false);
  const [registerState, setRegisterState] = useState<"idle" | "needs-confirmation" | "done">(
    "idle"
  );

  function handlePasswordSubmit() {
    setError(null);
    setNeedsConfirmation(false);
    setResent(false);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("email", email);
      formData.set("password", password);
      const result = await signInWithPassword(null, formData);
      if (result.error) {
        setError(result.error);
        if (result.needsConfirmation) setNeedsConfirmation(true);
        return;
      }
      router.push("/");
      router.refresh();
    });
  }

  function handleResend() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("email", email);
      const result = await resendConfirmation(null, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setResent(true);
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

  function handleRegisterSubmit() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("email", email);
      formData.set("password", password);
      const result = await registerWithPassword(null, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.needsConfirmation) {
        setRegisterState("needs-confirmation");
      } else {
        router.push("/");
        router.refresh();
      }
    });
  }

  const title = mode === "register" ? "Create your account" : "Gym Journal";
  const subtitle =
    mode === "password"
      ? "Sign in with your email and password."
      : mode === "register"
        ? "Sign up with your email and a password."
        : "Sign in with your email — we'll send you a magic link, no password needed.";

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <span className="mb-6 grid size-12 place-items-center rounded-xl bg-accent text-on-accent">
        <Icon name="dumbbell" className="size-7" strokeWidth={2.25} />
      </span>
      <h1 className="mb-1 page-title">{title}</h1>
      <p className="mb-8 text-sm text-label-2">{subtitle}</p>

      {mode === "magic-link" && magicLinkSent ? (
        <div className="rounded-xl bg-green/12 p-4 text-sm text-green">
          Check your email for a sign-in link.
        </div>
      ) : mode === "register" && registerState === "needs-confirmation" ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-xl bg-green/12 p-4 text-sm text-green">
            Check your email to confirm your account before signing in.
          </div>
          {resent ? (
            <p className="text-center text-sm text-green">Confirmation email sent.</p>
          ) : (
            <button type="button" onClick={handleResend} disabled={pending} className="text-center text-sm text-link">
              Didn&apos;t get it? Resend confirmation email
            </button>
          )}
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (mode === "password") handlePasswordSubmit();
            else if (mode === "register") handleRegisterSubmit();
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
            className="field rounded-xl px-4 py-3 text-base"
          />

          {(mode === "password" || mode === "register") && (
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder={mode === "register" ? "Password (at least 8 characters)" : "Password"}
              className="field rounded-xl px-4 py-3 text-base"
            />
          )}

          {mode === "password" && (
            <Link href="/forgot-password" className="-mt-1 text-right text-xs text-link">
              Forgot password?
            </Link>
          )}

          {error && <p className="text-sm text-red">{error}</p>}
          {needsConfirmation && !resent && (
            <button
              type="button"
              onClick={handleResend}
              disabled={pending}
              className="text-left text-sm text-link"
            >
              Resend confirmation email
            </button>
          )}
          {resent && <p className="text-sm text-green">Confirmation email sent.</p>}

          <button
            type="submit"
            disabled={pending}
            className="h-11 rounded-[10px] bg-accent px-4 text-[15px] font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-50"
          >
            {pending
              ? mode === "register"
                ? "Creating account..."
                : "Signing in..."
              : mode === "password"
                ? "Sign in"
                : mode === "register"
                  ? "Create account"
                  : "Send magic link"}
          </button>

          <div className="flex flex-col gap-2">
            {mode !== "magic-link" && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode("magic-link");
                }}
                className="text-center text-sm text-link"
              >
                Sign in with a magic link instead
              </button>
            )}
            {mode !== "password" && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode("password");
                }}
                className="text-center text-sm text-link"
              >
                Sign in with a password instead
              </button>
            )}
            {mode !== "register" && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode("register");
                }}
                className="text-center text-sm text-link"
              >
                Create a new account
              </button>
            )}
          </div>
        </form>
      )}
    </main>
  );
}
