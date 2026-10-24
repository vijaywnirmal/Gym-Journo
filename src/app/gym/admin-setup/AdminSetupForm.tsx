"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { saveAdminProfile } from "./actions";

export default function AdminSetupForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initialName);
  const [confirmedAdult, setConfirmedAdult] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await saveAdminProfile({ name, confirmedAdult });
      if (result.error) {
        setError(result.error);
        return;
      }
      // The action revalidates the layout, so no refresh (see TrainerSetupForm).
      router.push(result.next ?? "/");
    });
  }

  return (
    <form
      className="flex flex-col gap-4 pb-6"
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Your name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          placeholder="e.g. Deepa Rao"
          className="field h-11 w-full rounded-[10px] px-3.5 text-base"
        />
      </label>
      <button
        type="button"
        role="checkbox"
        aria-checked={confirmedAdult}
        onClick={() => setConfirmedAdult((value) => !value)}
        className="flex items-center gap-2.5 text-left text-sm font-medium"
      >
        <span
          className={`grid size-5 shrink-0 place-items-center rounded-md border ${
            confirmedAdult ? "border-transparent bg-accent text-on-accent" : "border-label-3 bg-surface"
          }`}
        >
          {confirmedAdult && <Icon name="checkmark" className="size-3.5" strokeWidth={3} />}
        </span>
        I&apos;m 18 or older
      </button>
      {error && (
        <p role="alert" className="text-sm text-red">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending || !confirmedAdult}
        className="h-11 rounded-[10px] bg-accent px-4 text-[15px] font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
