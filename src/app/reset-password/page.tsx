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
    <main className="screen-enter mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <span className="mb-6 grid size-16 place-items-center rounded-[22%] bg-tint text-white shadow-raised">
        <Icon name="dumbbell" className="size-9" strokeWidth={2.25} />
      </span>
      <h1 className="mb-1 large-title">Set a new password</h1>
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
            className="rounded-xl bg-fill px-4 py-3 text-base text-label placeholder-label-3"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            placeholder="Confirm new password"
            className="rounded-xl bg-fill px-4 py-3 text-base text-label placeholder-label-3"
          />

          {error && <p className="text-sm text-red">{error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-tint px-4 py-3 font-medium text-white disabled:opacity-50"
          >
            {pending ? "Saving..." : "Update password"}
          </button>
        </form>
      )}
    </main>
  );
}
