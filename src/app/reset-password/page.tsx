"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
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
      <span className="mb-6 grid size-12 place-items-center rounded-xl bg-accent text-on-accent">
        <Icon name="dumbbell" className="size-7" strokeWidth={2.25} />
      </span>
      <h1 className="mb-1 page-title">Set a new password</h1>
      <p className="mb-8 text-sm text-label-2">Choose a new password for your account.</p>

      {done ? (
        <div className="rounded-xl bg-green/12 p-4 text-sm text-green">
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
            className="field rounded-xl px-4 py-3 text-base"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            placeholder="Confirm new password"
            className="field rounded-xl px-4 py-3 text-base"
          />

          {error && <p className="text-sm text-red">{error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="h-11 rounded-[10px] bg-accent px-4 text-[15px] font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-50"
          >
            {pending ? "Saving..." : "Update password"}
          </button>
        </form>
      )}
    </main>
  );
}
