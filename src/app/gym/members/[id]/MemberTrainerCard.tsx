"use client";

import { useState, useTransition } from "react";

type Trainer = { id: string; name: string };

// The member's trainer, from the gym's side: suggest one (the member accepts or declines), withdraw
// a suggestion, or take back the trainer the gym arranged.
export default function MemberTrainerCard({
  firstName,
  trainers,
  current,
  offered,
  suggest,
  unassign,
}: {
  firstName: string;
  trainers: Trainer[];
  current: Trainer | null;
  offered: Trainer | null;
  suggest: (trainerId: string) => Promise<{ error?: string }>;
  unassign: () => Promise<{ error?: string }>;
}) {
  const [pending, startTransition] = useTransition();
  const choices = trainers.filter((t) => t.id !== current?.id && t.id !== offered?.id);
  const [choice, setChoice] = useState(choices[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function run(action: () => Promise<{ error?: string }>, message: string) {
    setError(null);
    setDone(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
      setDone(message);
    });
  }

  const chosen = choices.find((t) => t.id === choice) ?? choices[0];

  return (
    <section className="card divide-y divide-separator">
      {(current || offered) && (
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{current ? current.name : `Suggested ${offered!.name}`}</p>
            <p className="text-sm text-label-2">
              {current ? `Trains ${firstName}` : `Waiting for ${firstName} to accept`}
              {current && offered && ` · suggested ${offered.name}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => run(unassign, current ? "Trainer removed." : "Suggestion withdrawn.")}
            disabled={pending}
            className="h-8 shrink-0 rounded-lg border border-separator px-2.5 text-sm font-semibold hover:bg-fill disabled:opacity-50"
          >
            {current ? "Remove" : "Withdraw"}
          </button>
        </div>
      )}

      {chosen && (
        <div className="flex flex-col gap-2 px-4 py-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">
              {current || offered ? "Suggest a different trainer" : "Suggest a trainer"}
            </span>
            <select
              value={chosen.id}
              onChange={(e) => setChoice(e.target.value)}
              className="field h-11 w-full rounded-[10px] px-3 text-base"
            >
              {choices.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => run(() => suggest(chosen.id), `Suggested ${chosen.name}. ${firstName} can accept in the app.`)}
            disabled={pending}
            className="h-10 rounded-[10px] bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-50"
          >
            {pending ? "Saving…" : `Suggest ${chosen.name}`}
          </button>
          <p className="text-xs text-label-2">
            {firstName} chooses whether to accept. Once they do, their trainer sees their plans, workouts and body weight.
          </p>
        </div>
      )}

      {(error || done) && (
        <p role={error ? "alert" : "status"} className={`px-4 py-3 text-sm ${error ? "text-red" : "text-label-2"}`}>
          {error ?? done}
        </p>
      )}
    </section>
  );
}
